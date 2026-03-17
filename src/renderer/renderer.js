window.electronAPI.onAnimeData((data) => {
  console.log('🖥️ Renderer: datos recibidos', data);
  const animeInfo = document.getElementById('anime-info');
  const noData = document.getElementById('no-data');
  
  // Si no hay datos válidos (null, undefined, o sin título), mostrar pantalla de espera
  if (!data || !data.titulo) {
    animeInfo.classList.add('hidden');
    noData.classList.remove('hidden');
    return;
  }

  const animeImage = document.getElementById('anime-image');
  const animeTitle = document.getElementById('anime-title');
  const animeEpisode = document.getElementById('anime-episode');
  const animeGenres = document.getElementById('anime-genres');

  animeInfo.dataset.url = data.url;
  animeImage.src = data.imagen;
  animeTitle.textContent = data.titulo;
  animeEpisode.textContent = `Episodio ${data.episodio}`;
  animeGenres.innerHTML = data.generos.map(g => `<span>${g}</span>`).join('');

  animeInfo.classList.remove('hidden');
  noData.classList.add('hidden');
});

document.getElementById('close-btn').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

document.getElementById('view-anime').addEventListener('click', () => {
  const url = document.getElementById('anime-info').dataset.url;
  if (url) window.open(url, '_blank');
});

document.getElementById('download-app').addEventListener('click', () => {
  window.open('https://vicemi.dev', '_blank');
});