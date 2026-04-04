const WebSocket = require('ws');

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
const MODEL = 'gpt-4o-realtime-preview-2025-12-17';

/**
 * Attach WebSocket relay to an HTTP server.
 * Client connects to /voice/ws, backend opens a parallel WS to OpenAI
 * and bridges all messages bidirectionally.
 */
function attachVoiceRelay(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/voice/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs) => {
    console.log('[VoiceRelay] Client connected');

    // Open WebSocket to OpenAI Realtime API
    const openaiWs = new WebSocket(`${OPENAI_REALTIME_URL}?model=${MODEL}`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    let openaiReady = false;
    const pendingMessages = [];

    openaiWs.on('open', () => {
      console.log('[VoiceRelay] Connected to OpenAI Realtime');
      openaiReady = true;
      // Flush any messages that arrived while connecting
      for (const msg of pendingMessages) {
        openaiWs.send(msg);
      }
      pendingMessages.length = 0;
    });

    // Relay: OpenAI → Client
    openaiWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    openaiWs.on('error', (err) => {
      console.error('[VoiceRelay] OpenAI WS error:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'error', error: { message: 'Backend relay error: ' + err.message } }));
      }
    });

    openaiWs.on('close', (code, reason) => {
      console.log(`[VoiceRelay] OpenAI WS closed: ${code} ${reason}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, 'OpenAI session ended');
      }
    });

    // Relay: Client → OpenAI
    clientWs.on('message', (data) => {
      const msg = data.toString();
      if (openaiReady && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(msg);
      } else {
        // Buffer until OpenAI connection is ready
        pendingMessages.push(msg);
      }
    });

    clientWs.on('close', () => {
      console.log('[VoiceRelay] Client disconnected');
      if (openaiWs.readyState === WebSocket.OPEN || openaiWs.readyState === WebSocket.CONNECTING) {
        openaiWs.close();
      }
    });

    clientWs.on('error', (err) => {
      console.error('[VoiceRelay] Client WS error:', err.message);
    });
  });

  return wss;
}

module.exports = { attachVoiceRelay };
