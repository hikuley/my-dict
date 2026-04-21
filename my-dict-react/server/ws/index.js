import { WebSocketServer } from 'ws';

let wss = null;
const processingWords = new Map(); // slug -> { word, slug, status, startedAt }

export function createWSServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', function (ws) {
    console.log('[ws] Client connected');

    // Send current processing state to newly connected client
    if (processingWords.size > 0) {
      processingWords.forEach(function (data) {
        ws.send(JSON.stringify({ type: 'word-processing', data }));
      });
    }

    ws.on('close', function () {
      console.log('[ws] Client disconnected');
    });
  });

  console.log('[ws] WebSocket server started on /ws');
  return wss;
}

export function trackProcessing(slug, word) {
  processingWords.set(slug, { word, slug, status: 'processing', startedAt: Date.now() });
}

export function clearProcessing(slug) {
  processingWords.delete(slug);
}

export function broadcastMessage(type, data) {
  if (!wss) return;
  var msg = JSON.stringify({ type, data });
  wss.clients.forEach(function (client) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}
