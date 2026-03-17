document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const animeContainer = document.getElementById('anime-container');
  let ws = null;
  let reconnectTimeout = null;

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    ws = new WebSocket('ws://localhost:9876');

    ws.onopen = () => {
      console.log('Popup: WebSocket conectado');
      statusDot.classList.add('online');
      statusText.textContent = 'App conectada';
      ws.send(JSON.stringify({ type: 'status' }));
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Popup: mensaje recibido', data);

        if (data.currentAnime) {
          const anime = data.currentAnime;
          const genresHtml = anime.generos.slice(0, 5).map(g => 
            `<span class="genre-tag">${g}</span>`
          ).join('');

          animeContainer.innerHTML = `
            <div class="anime-card">
              <div class="anime-backdrop" style="background-image: url('${anime.imagen}');"></div>
              <div class="anime-content">
                <div class="anime-title">${anime.titulo}</div>
                <div class="anime-episode">Episodio ${anime.episodio}</div>
                <div class="anime-genres">${genresHtml}</div>
              </div>
            </div>
          `;
        } else {
          animeContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">😴</div>
              <div class="empty-title">No hay anime activo</div>
              <div class="empty-desc">Abre una página de animeav1.com</div>
            </div>
          `;
        }
      } catch (e) {
        console.error('Popup: error al parsear mensaje', e);
      }
    };

    ws.onclose = (event) => {
      console.log('Popup: WebSocket desconectado', event.reason);
      statusDot.classList.remove('online');
      statusText.textContent = 'App desconectada';
      animeContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔌</div>
          <div class="empty-title">App no disponible</div>
          <div class="empty-desc">Asegúrate de que la app esté abierta</div>
        </div>
      `;

      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectWebSocket();
        }, 2000);
      }
    };

    ws.onerror = (err) => {
      console.error('Popup: WebSocket error', err);
    };
  }

  connectWebSocket();

  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close();
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
  });
});