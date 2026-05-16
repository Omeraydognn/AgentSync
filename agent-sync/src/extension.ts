import * as vscode from 'vscode';
import * as Y from 'yjs';
import * as fs from 'fs';
import { WebsocketProvider } from 'y-websocket';
import { WebSocket } from 'ws';

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

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('AgentSync');
	outputChannel.show();
	outputChannel.appendLine('🔄 AgentSync başlıyor...');

	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.text = '🟢 AgentSync: Idle';
	statusBar.show();
	context.subscriptions.push(statusBar);

	ydoc = new Y.Doc();
	const fileLocks = ydoc.getMap<number>('file-locks');

	provider = new WebsocketProvider('ws://localhost:1234', 'agentsync-global', ydoc, { connect: true });

	provider.on('status', ({ status }: { status: string }) => {
		if (status === 'connected') {
			vscode.window.showInformationMessage('🟢 AgentSync: Sunucuya başarıyla bağlanıldı!');
			outputChannel.appendLine('✓ Sunucuya bağlandı');
		} else if (status === 'disconnected') {
			outputChannel.appendLine('✗ Sunucudan koptu');
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
			outputChannel.appendLine(`[+] Takibe alındı: ${event.document.fileName}`);
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
		}, 2000);
		lockTimers.set(uri, timer);

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
				statusBar.text = `🔴 LOCKED: ${name} (By Teammate)`;
				statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
				outputChannel.appendLine(`🔴 Kilitlendi: ${name}`);
			} catch (err) {
				outputChannel.appendLine(`✗ chmod hatası: ${err}`);
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
				outputChannel.appendLine(`🟢 Kilit açıldı: ${fsPath.split('/').pop()}`);
			} catch (err) {
				outputChannel.appendLine(`✗ chmod hatası: ${err}`);
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
				outputChannel.appendLine(`✗ Force unlock hatası: ${err}`);
			}
		}
		for (const timer of lockTimers.values()) { clearTimeout(timer); }
		lockTimers.clear();
		statusBar.text = '🟢 AgentSync: Idle';
		statusBar.backgroundColor = undefined;
		vscode.window.showInformationMessage('🚨 AgentSync: Tüm dosya kilitleri zorla açıldı!');
		outputChannel.appendLine('🚨 Force Unlock: Tüm kilitler temizlendi');
	});
	context.subscriptions.push(forceUnlockCmd);

	outputChannel.appendLine('✓ AgentSync hazır');
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
			.catch((err) => { outputChannel.appendLine(`✗ Uzak değişiklik hatası: ${err}`); });
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
	outputChannel.appendLine('✓ AgentSync kapatıldı');
}
