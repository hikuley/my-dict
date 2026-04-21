import { useEffect, useRef } from 'react';

export default function useWebSocket(onMessage) {
  var wsRef = useRef(null);
  var onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(function () {
    if (wsRef.current) return;

    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = protocol + '//' + window.location.host + '/ws';
    var ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = function (event) {
      var msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      onMessageRef.current(msg);
    };

    ws.onerror = function () {
      console.log('[ws] Connection error');
    };

    ws.onclose = function () {
      console.log('[ws] Connection closed');
      wsRef.current = null;
    };

    return function () {
      ws.close();
      wsRef.current = null;
    };
  }, []);
}
