// background.js - Gestión con puertos y timeout de heartbeat
let ws = null;
let reconnectTimeout = null;
let pendingMessage = null;
let heartbeatTimeout = null;

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  ws = new WebSocket('ws://localhost:9876');

  ws.onopen = () => {
    console.log('✅ Background: WebSocket conectado a la app');
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;  
    }
    if (pendingMessage) {
      ws.send(JSON.stringify(pendingMessage));
      console.log('Background: mensaje pendiente enviado', pendingMessage);
      pendingMessage = null;
    }
  };

  ws.onclose = () => {
    console.log('❌ Background: WebSocket desconectado, reconectando en 2s...');
    ws = null;
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(connectWebSocket, 2000);
    }
  };

  ws.onerror = (err) => console.error('Background: WebSocket error', err);
}

function sendDataToApp(data) {
  const message = { type: 'update', payload: data };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    pendingMessage = message;
    connectWebSocket();
  }
}

function clearPresence() {
  const message = { type: 'clear' };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    pendingMessage = message;
    connectWebSocket();
  }
}

function resetHeartbeatTimeout() {
  if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
  heartbeatTimeout = setTimeout(() => {
    console.log('Background: heartbeat timeout (35s), limpiando presencia');
    clearPresence();
  }, 35000);
}

// Manejar conexiones de puerto desde content scripts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'anime-page') {
    console.log('📞 Puerto conectado desde content script');
    port.onMessage.addListener((message) => {
      if (message.type === 'update') {
        sendDataToApp(message.payload);
        resetHeartbeatTimeout();
      } else if (message.type === 'heartbeat') {
        console.log('💓 Heartbeat recibido');
        resetHeartbeatTimeout();
      } else if (message.type === 'clear') {
        clearPresence();
        if (heartbeatTimeout) {
          clearTimeout(heartbeatTimeout);
          heartbeatTimeout = null;
        }
      }
    });
    port.onDisconnect.addListener(() => {
      console.log('🔌 Puerto desconectado');
    });
  }
});

// Iniciar WebSocket
connectWebSocket();