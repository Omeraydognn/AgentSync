import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { ethers } from 'ethers';

const YJS_PORT      = process.env.PORT             || 1234;
const CTRL_PORT     = process.env.CTRL_PORT        || 1235;
const MONAD_RPC     = process.env.MONAD_RPC_URL    || 'https://testnet-rpc.monad.xyz';
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS || '';
const OPENROUTER_KEY = process.env.ANTHROPIC_API_KEY || '';  // OpenRouter key (sk-or-v1-...)
const AI_MODEL       = process.env.AI_MODEL          || 'anthropic/claude-3.5-haiku';

// ── Monad erişim kontratı ───────────────────────────────────────────────────
const ACCESS_ABI = ['function hasAccess(address user) external view returns (bool)'];
let accessContract = null;
if (CONTRACT_ADDR) {
  const provider = new ethers.JsonRpcProvider(MONAD_RPC);
  accessContract = new ethers.Contract(CONTRACT_ADDR, ACCESS_ABI, provider);
}

// ── OpenRouter (Claude erişimi) ─────────────────────────────────────────────
const aiEnabled = !!OPENROUTER_KEY;

// ── Oda durumu: Map<room, Map<wallet, { ws, username, filesLocked: Set }>> ──
const roomState = new Map();

function getRoom(room) {
  if (!roomState.has(room)) roomState.set(room, new Map());
  return roomState.get(room);
}

function findLockOwner(clients, fileUri) {
  for (const [wallet, client] of clients) {
    if (client.filesLocked.has(fileUri)) return { wallet, username: client.username };
  }
  return null;
}

function summarizeLocks(clients) {
  const lines = [];
  for (const [, c] of clients) {
    if (c.filesLocked.size > 0) lines.push(`${c.username}: ${[...c.filesLocked].join(', ')}`);
  }
  return lines.join('\n') || 'Kilitli dosya yok';
}

function broadcast(clients, obj, exceptWallet = null) {
  const msg = JSON.stringify(obj);
  for (const [wallet, { ws }] of clients) {
    if (wallet !== exceptWallet && ws.readyState === 1) ws.send(msg);
  }
}

// ── Claude'dan öneri (OpenRouter üzerinden) ────────────────────────────────
async function askClaude(clients, requestingUser, conflictFile) {
  if (!aiEnabled) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/agentsync',
        'X-Title': 'AgentSync Traffic Agent',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `Sen bir kod isbirligi trafik polisisin. Odadaki kilitli dosyalar:\n${summarizeLocks(clients)}\n\n${requestingUser} simdi kilitli "${conflictFile}" dosyasina yazmak istiyor. Ona 1 kisa alternatif oner. Turkce yaz.`,
        }],
      }),
    });
    if (!res.ok) {
      console.warn(`[AI] OpenRouter HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn('[AI] Cagri basarisiz:', e.message);
    return null;
  }
}

// ── PORT 1234: Saf Yjs relay ────────────────────────────────────────────────
const yjsWss = new WebSocketServer({ port: YJS_PORT });

yjsWss.on('connection', (ws, req) => {
  const room = new URL(req.url, 'http://x').pathname.slice(1) || 'agentsync-global';
  ws.on('message', (data) => {
    yjsWss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) client.send(data);
    });
  });
  ws.on('error', (e) => console.error('[Yjs]', e.message));
});

console.log(`🔄 Yjs relay           ws://localhost:${YJS_PORT}`);

// ── PORT 1235: Akıllı kontrol kanalı ───────────────────────────────────────
const ctrlWss = new WebSocketServer({ port: CTRL_PORT });

ctrlWss.on('connection', (ws) => {
  let authenticated = false;
  let clientWallet  = null;
  let clientRoom    = 'agentsync-global';

  // İlk mesaj auth olmalı
  ws.once('message', async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch {
      ws.close(1008, 'Invalid message'); return;
    }
    if (msg.type !== 'auth') { ws.close(1008, 'Expected auth'); return; }

    // İmza doğrula
    try {
      const recovered = ethers.verifyMessage(msg.challenge, msg.sig);
      if (recovered.toLowerCase() !== msg.wallet.toLowerCase()) {
        ws.send(JSON.stringify({ type: 'auth_error', msg: 'Imza gecersiz' }));
        ws.close(); return;
      }
    } catch {
      ws.send(JSON.stringify({ type: 'auth_error', msg: 'Imza dogrulanamadi' }));
      ws.close(); return;
    }

    // Monad erişim kontrolü
    if (accessContract) {
      try {
        const ok = await accessContract.hasAccess(msg.wallet);
        if (!ok) {
          ws.send(JSON.stringify({ type: 'access_denied', msg: 'AgentSync erisimi yok. Monad testnet uzerinden erisim satin alin.' }));
          ws.close(); return;
        }
      } catch (e) {
        console.warn('[Monad] Erisim kontrolu basarisiz, gecici izin verildi:', e.message);
      }
    }

    // Kabul
    clientWallet = msg.wallet;
    clientRoom   = msg.room || 'agentsync-global';
    authenticated = true;

    const clients = getRoom(clientRoom);
    clients.set(clientWallet, { ws, username: msg.username || 'Teammate', filesLocked: new Set() });

    ws.send(JSON.stringify({ type: 'auth_ok' }));
    console.log(`✓ [Kontrol] ${msg.username} (${msg.wallet.slice(0, 8)}...) katildi`);

    // Sonraki mesajları işle
    ws.on('message', async (raw) => {
      if (!authenticated) return;
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }

      const clients = getRoom(clientRoom);
      const me = clients.get(clientWallet);
      if (!me) return;

      if (m.type === 'lock') {
        const owner = findLockOwner(clients, m.fileUri);
        if (owner && owner.wallet !== clientWallet) {
          // Çakışma algılandı → Claude'a sor
          console.log(`⚡ [Kontrol] Catisma: ${me.username} → ${m.fileUri}`);
          const suggestion = await askClaude(clients, me.username, m.fileUri);
          const text = suggestion || `${owner.username} su an bu dosyada calisiyor. Baska bir dosyaya gec.`;
          ws.send(JSON.stringify({ type: 'suggestion', msg: text }));
        } else {
          me.filesLocked.add(m.fileUri);
          broadcast(clients, { type: 'lock_ack', fileUri: m.fileUri, username: me.username }, clientWallet);
          console.log(`🔒 [Kontrol] ${me.username} kilitledi: ${m.fileUri}`);
        }
      }

      if (m.type === 'unlock') {
        me.filesLocked.delete(m.fileUri);
        broadcast(clients, { type: 'unlock_ack', fileUri: m.fileUri, username: me.username }, clientWallet);
        console.log(`🔓 [Kontrol] ${me.username} kilidi acti: ${m.fileUri}`);
      }

      if (m.type === 'log') {
        // Paylaşılan output: bir istemcinin log'unu diğer tüm istemcilere yansıt
        broadcast(clients, {
          type: 'log_broadcast',
          message: m.message,
          fileName: m.fileName,
          username: me.username,
        }, clientWallet);
      }
    });

    ws.on('close', () => {
      if (clientWallet) {
        const clients = getRoom(clientRoom);
        clients.delete(clientWallet);
        console.log(`✗ [Kontrol] ${msg.username} ayrildi`);
      }
    });
  });

  ws.on('error', (e) => console.error('[Kontrol]', e.message));
});

console.log(`🤖 Trafik Ajan Kontrolu ws://localhost:${CTRL_PORT}`);
if (accessContract) console.log(`⛓  Monad erisim kontrolu AKTIF  (${CONTRACT_ADDR})`);
if (aiEnabled)       console.log(`🧠 AI oneri sistemi AKTIF (model: ${AI_MODEL})`);
