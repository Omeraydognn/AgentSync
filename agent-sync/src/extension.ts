import * as vscode from 'vscode';
import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';
import { WebsocketProvider } from 'y-websocket';
import { WebSocket } from 'ws';
import { ethers } from 'ethers';

// @ts-ignore
global.WebSocket = WebSocket;

let provider: WebsocketProvider;
let ydoc: Y.Doc;
let outputChannel: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;

const fileTexts = new Map<string, Y.Text>();
let isApplyingRemoteChange = false;
const lockTimers = new Map<string, NodeJS.Timeout>();
const lockedFiles = new Set<string>();

// Akıllı trafik ajanı kontrol kanalı (port 1235)
let controlWs: WebSocket | null = null;
let controlUsername = '';

function sendControl(obj: object) {
	if (controlWs?.readyState === 1) {
		controlWs.send(JSON.stringify(obj));
	}
}

function logToOutput(message: string, fileUriString?: string) {
	const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
	let fileName = '';
	if (fileUriString) {
		try {
			const parsedUri = vscode.Uri.parse(fileUriString);
			fileName = ' (' + path.basename(parsedUri.fsPath) + ')';
		} catch (e) {}
	}
	outputChannel.appendLine(`[${time}] ${message}${fileName}`);
}

export async function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('AgentSync');
	outputChannel.show();
	logToOutput('🔄 AgentSync başlıyor...');

	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.text = '🟢 AgentSync: Idle';
	statusBar.show();
	context.subscriptions.push(statusBar);

	// GitHub kimlik doğrulaması
	let session: vscode.AuthenticationSession;
	try {
		session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: true });
	} catch (error) {
		vscode.window.showErrorMessage('AgentSync: Çalışmak için GitHub ile giriş yapmanız zorunludur.');
		logToOutput('✗ GitHub girişi başarısız, eklenti durduruluyor');
		return;
	}

	const githubUsername = session.account.label;
	vscode.window.showInformationMessage(`🟢 AgentSync: ${githubUsername} olarak giriş yapıldı.`);
	logToOutput(`✓ GitHub girişi başarılı: ${githubUsername}`);

	ydoc = new Y.Doc();
	const fileLocks = ydoc.getMap<number>('file-locks');

	provider = new WebsocketProvider('ws://localhost:1234', 'agentsync-global', ydoc, { connect: true });

	provider.awareness.setLocalStateField('user', { name: githubUsername });
	controlUsername = githubUsername;

	// Kontrol kanalı bağlantısı (port 1235) — cüzdan varsa auth ile
	const privateKey = await context.secrets.get('agentsync.walletPrivateKey');
	if (privateKey) {
		try {
			const wallet    = new ethers.Wallet(privateKey);
			const challenge = `agentsync-${Date.now()}`;
			const sig       = await wallet.signMessage(challenge);

			controlWs = new WebSocket('ws://localhost:1235');

			controlWs.on('open', () => {
				sendControl({ type: 'auth', wallet: wallet.address, sig, challenge, username: githubUsername, room: 'agentsync-global' });
				logToOutput(`⛓ Kontrol kanalı bağlandı (${wallet.address.slice(0, 8)}...)`);
			});

			controlWs.on('message', (data) => {
				try {
					const msg = JSON.parse(data.toString());
					if (msg.type === 'suggestion') {
						const short = msg.msg.length > 50 ? msg.msg.slice(0, 50) + '…' : msg.msg;
						statusBar.text = `💡 ${short}`;
						setTimeout(() => { statusBar.text = '🟢 AgentSync: Idle'; }, 6000);
						logToOutput(`💡 Ajan önerisi: ${msg.msg}`);
					}
					if (msg.type === 'access_denied') {
						vscode.window.showErrorMessage(`AgentSync: ${msg.msg}`);
						logToOutput(`✗ Erisim reddedildi: ${msg.msg}`);
					}
					if (msg.type === 'auth_ok') {
						logToOutput('✓ Kontrol kanalı kimlik doğrulaması başarılı');
					}
				} catch { /* binary veya hatalı mesaj */ }
			});

			controlWs.on('error', (err) => logToOutput(`✗ Kontrol kanalı hatası: ${err.message}`));
			controlWs.on('close', () => logToOutput('✗ Kontrol kanalı bağlantısı kesildi'));
		} catch (err) {
			logToOutput(`⚠ Cüzdan başlatılamadı: ${err}`);
		}
	} else {
		logToOutput('⚠ Cüzdan anahtarı yok — "AgentSync: Cüzdan Anahtarı Ayarla" komutunu çalıştırın');
	}

	provider.on('status', ({ status }: { status: string }) => {
		if (status === 'connected') {
			vscode.window.showInformationMessage('🟢 AgentSync: Sunucuya başarıyla bağlanıldı!');
			logToOutput('✓ Sunucuya bağlandı');
		} else if (status === 'disconnected') {
			logToOutput('✗ Sunucudan koptu');
		}
	});

	// A) LOKAL -> UZAK
	vscode.workspace.onDidChangeTextDocument((event) => {
		// Output/Terminal/Git panellerini yoksay
		if (event.document.uri.scheme !== 'file') { return; }
		if (isApplyingRemoteChange) { return; }

		const uri = event.document.uri.toString();
		let ytext = fileTexts.get(uri);

		if (!ytext) {
			ytext = new Y.Text();
			fileTexts.set(uri, ytext);
			setupRemoteListener(ytext, uri);
			logToOutput('[+] Takibe alındı', uri);
		}

		const localYText = ytext;
		ydoc.transact(() => {
			for (const change of event.contentChanges) {
				const { rangeOffset, rangeLength, text } = change;
				if (rangeLength > 0) { localYText.delete(rangeOffset, rangeLength); }
				if (text.length > 0) { localYText.insert(rangeOffset, text); }
			}
		});

		// Debounce: 2sn yazma durduğunda kilidi kaldır
		const existing = lockTimers.get(uri);
		if (existing) { clearTimeout(existing); }

		// Kilit henüz set edilmemişse set et
		const clientID = provider.awareness.clientID;
		if (fileLocks.get(uri) !== clientID) {
			fileLocks.set(uri, clientID);
		}

		const timer = setTimeout(() => {
			fileLocks.delete(uri);
			lockTimers.delete(uri);
			// Kilit süresi doldu → kontrol kanalına unlock sinyali
			sendControl({ type: 'unlock', fileUri: uri, username: controlUsername });
		}, 2000);
		lockTimers.set(uri, timer);

		// Kontrol kanalına lock sinyali (Yjs'e ek olarak)
		sendControl({ type: 'lock', fileUri: uri, username: controlUsername });

	}, null, context.subscriptions);

	// Uzak kilitleri dinle — sadece STATE DEĞİŞİKLİĞİNDE işlem yap
	fileLocks.observe(() => {
		const myClientID = provider.awareness.clientID;

		// Yeni kilitlenen dosyaları bul
		for (const [uri, lockOwner] of fileLocks.entries()) {
			if (lockOwner === myClientID) { continue; }

			const fsPath = vscode.Uri.parse(uri).fsPath;
			if (!fs.existsSync(fsPath)) { continue; }

			// Zaten kilitliyse tekrar yapma (spam engeli)
			if (lockedFiles.has(fsPath)) { continue; }

			try {
				fs.chmodSync(fsPath, 0o444);
				lockedFiles.add(fsPath);
				const name = fsPath.split('/').pop() ?? fsPath;
				const userState = provider.awareness.getStates().get(lockOwner) as any;
				const lockOwnerName = userState?.user?.name || 'Teammate';
				statusBar.text = `🔴 LOCKED: ${name} (${lockOwnerName})`;
				statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
				logToOutput(`🔒 KİLİTLENDİ: ${lockOwnerName} şu an yazıyor`, uri);
			} catch (err) {
				logToOutput(`✗ chmod hatası: ${err}`);
			}
		}

		// Kilidi kalkan dosyaları bul
		for (const fsPath of [...lockedFiles]) {
			const uri = vscode.Uri.file(fsPath).toString();
			if (fileLocks.has(uri)) { continue; }

			// Zaten açıksa tekrar yapma
			try {
				if (fs.existsSync(fsPath)) { fs.chmodSync(fsPath, 0o666); }
				lockedFiles.delete(fsPath);
				statusBar.text = '🟢 AgentSync: Idle';
				statusBar.backgroundColor = undefined;
				logToOutput('🔓 Kilit açıldı ve serbest bırakıldı', uri);
			} catch (err) {
				logToOutput(`✗ chmod hatası: ${err}`);
			}
		}
	});

	// Panik butonu
	const forceUnlockCmd = vscode.commands.registerCommand('agentsync.forceUnlock', () => {
		for (const key of [...fileLocks.keys()]) { fileLocks.delete(key); }
		for (const fsPath of [...lockedFiles]) {
			try {
				if (fs.existsSync(fsPath)) { fs.chmodSync(fsPath, 0o666); }
				lockedFiles.delete(fsPath);
			} catch (err) {
				logToOutput(`✗ Force unlock hatası: ${err}`);
			}
		}
		for (const timer of lockTimers.values()) { clearTimeout(timer); }
		lockTimers.clear();
		statusBar.text = '🟢 AgentSync: Idle';
		statusBar.backgroundColor = undefined;
		vscode.window.showInformationMessage('🚨 AgentSync: Tüm dosya kilitleri zorla açıldı!');
		logToOutput('🚨 Force Unlock: Tüm kilitler temizlendi');
	});
	context.subscriptions.push(forceUnlockCmd);

	// Cüzdan private key kaydetme komutu
	const setWalletCmd = vscode.commands.registerCommand('agentsync.setWalletKey', async () => {
		const key = await vscode.window.showInputBox({
			prompt: 'Monad testnet cüzdan private key (0x ile başlayan)',
			password: true,
			placeHolder: '0x...',
			validateInput: (v) => v.startsWith('0x') && v.length === 66 ? null : 'Geçersiz private key formatı',
		});
		if (!key) { return; }
		await context.secrets.store('agentsync.walletPrivateKey', key);
		const wallet = new ethers.Wallet(key);
		vscode.window.showInformationMessage(`✅ Cüzdan kaydedildi: ${wallet.address}`);
		logToOutput(`✓ Cüzdan ayarlandı: ${wallet.address}`);
	});
	context.subscriptions.push(setWalletCmd);

	logToOutput('✓ AgentSync hazır');
}

// B) UZAK -> LOKAL
function setupRemoteListener(ytext: Y.Text, fileUri: string) {
	ytext.observe((event: Y.YTextEvent) => {
		if (event.transaction.local) { return; }
		if (event.delta.length === 0) { return; }

		// Flag'i HEMEN set et — async başlamadan önce (race condition engeli)
		isApplyingRemoteChange = true;
		applyRemoteChanges(fileUri, event)
			.finally(() => { isApplyingRemoteChange = false; })
			.catch((err) => { logToOutput(`✗ Uzak değişiklik hatası: ${err}`, fileUri); });
	});
}

async function applyRemoteChanges(fileUri: string, event: Y.YTextEvent): Promise<void> {
	const editor = vscode.window.visibleTextEditors.find(
		(e) => e.document.uri.toString() === fileUri
	);
	if (!editor) { return; }

	const edit = new vscode.WorkspaceEdit();
	const uri = editor.document.uri;
	const doc = editor.document;
	let index = 0;

	for (const delta of event.delta) {
		if (delta.retain !== undefined) {
			index += delta.retain;
		} else if (delta.delete !== undefined) {
			const startPos = doc.positionAt(index);
			const endPos = doc.positionAt(index + delta.delete);
			edit.delete(uri, new vscode.Range(startPos, endPos));
		} else if (delta.insert !== undefined) {
			edit.insert(uri, doc.positionAt(index), delta.insert as string);
		}
	}

	await vscode.workspace.applyEdit(edit);
}

export function deactivate() {
	for (const fsPath of lockedFiles) {
		try {
			if (fs.existsSync(fsPath)) { fs.chmodSync(fsPath, 0o666); }
		} catch { /* ignore */ }
	}
	lockedFiles.clear();
	for (const timer of lockTimers.values()) { clearTimeout(timer); }
	lockTimers.clear();
	if (provider) { provider.disconnect(); }
	if (controlWs) { controlWs.close(); controlWs = null; }
	logToOutput('✓ AgentSync kapatıldı');
}
