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

        // Limpiar contenedor
        while (animeContainer.firstChild) {
          animeContainer.removeChild(animeContainer.firstChild);
        }

        if (data.currentAnime) {
          const anime = data.currentAnime;

          // Crear elementos de forma segura
          const card = document.createElement('div');
          card.className = 'anime-card';

          const backdrop = document.createElement('div');
          backdrop.className = 'anime-backdrop';
          backdrop.style.backgroundImage = `url('${anime.imagen}')`;

          const content = document.createElement('div');
          content.className = 'anime-content';

          const title = document.createElement('div');
          title.className = 'anime-title';
          title.textContent = anime.titulo;

          const episode = document.createElement('div');
          episode.className = 'anime-episode';
          episode.textContent = `Episodio ${anime.episodio}`;

          const genresDiv = document.createElement('div');
          genresDiv.className = 'anime-genres';

          // Mostrar hasta 5 géneros
          anime.generos.slice(0, 5).forEach(g => {
            const tag = document.createElement('span');
            tag.className = 'genre-tag';
            tag.textContent = g;
            genresDiv.appendChild(tag);
          });

          content.appendChild(title);
          content.appendChild(episode);
          content.appendChild(genresDiv);
          card.appendChild(backdrop);
          card.appendChild(content);
          animeContainer.appendChild(card);
        } else {
          const emptyState = document.createElement('div');
          emptyState.className = 'empty-state';

          const icon = document.createElement('div');
          icon.className = 'empty-icon';
          icon.textContent = '😴';

          const title = document.createElement('div');
          title.className = 'empty-title';
          title.textContent = 'No hay anime activo';

          const desc = document.createElement('div');
          desc.className = 'empty-desc';
          desc.textContent = 'Abre una página de animeav1.com';

          emptyState.appendChild(icon);
          emptyState.appendChild(title);
          emptyState.appendChild(desc);
          animeContainer.appendChild(emptyState);
        }
      } catch (e) {
        console.error('Popup: error al parsear mensaje', e);
      }
    };

    ws.onclose = (event) => {
      console.log('Popup: WebSocket desconectado', event.reason);
      statusDot.classList.remove('online');
      statusText.textContent = 'App desconectada';

      // Limpiar contenedor
      while (animeContainer.firstChild) {
        animeContainer.removeChild(animeContainer.firstChild);
      }

      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.textContent = '🔌';

      const title = document.createElement('div');
      title.className = 'empty-title';
      title.textContent = 'App no disponible';

      const desc = document.createElement('div');
      desc.className = 'empty-desc';
      desc.textContent = 'Asegúrate de que la app esté abierta';

      emptyState.appendChild(icon);
      emptyState.appendChild(title);
      emptyState.appendChild(desc);
      animeContainer.appendChild(emptyState);

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