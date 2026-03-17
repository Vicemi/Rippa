import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/shell';

// Escuchar eventos de actualización de anime desde Rust
listen('anime-data', (event) => {
  const data = event.payload;
  console.log('🖥️ Renderer: datos recibidos', data);
  const animeInfo = document.getElementById('anime-info');
  const noData = document.getElementById('no-data');

  if (!data || !data.titulo) {
    animeInfo.classList.add('hidden');
    noData.classList.remove('hidden');
    return;
  }

  const animeImage = document.getElementById('anime-image');
  const animeTitle = document.getElementById('anime-title');
  const animeEpisode = document.getElementById('anime-episode');
  const animeGenres = document.getElementById('anime-genres');

  // Guardamos la URL en un atributo data
  animeInfo.dataset.url = data.url || '';
  animeImage.src = data.imagen || '';
  animeTitle.textContent = data.titulo;
  animeEpisode.textContent = `Episodio ${data.episodio || '?'}`;
  animeGenres.innerHTML = (data.generos || []).map(g => `<span>${g}</span>`).join('');

  animeInfo.classList.remove('hidden');
  noData.classList.add('hidden');
});

// Cerrar ventana (ocultar)
document.getElementById('close-btn').addEventListener('click', () => {
  invoke('hide_window');
});

// Abrir anime en el navegador
document.getElementById('view-anime').addEventListener('click', () => {
  const url = document.getElementById('anime-info').dataset.url;
  if (url) open(url);
});

// Abrir enlace de descarga
document.getElementById('download-app').addEventListener('click', () => {
  open('https://vicemi.dev');
});