// content.js - Envía datos al background con heartbeat y manejo robusto de errores (Si funciona no lo toques, esto se hizo para una mejor compatibilidad con Brave)
let heartbeatInterval = null;
let currentAnimeData = null;
let port = null;

// Conecta o reutiliza el puerto con el background
function connectPort() {
  if (port) return;
  try {
    port = chrome.runtime.connect({ name: 'anime-page' });
    port.onDisconnect.addListener(() => {
      console.log('Port disconnected, intentando reconectar...');
      port = null;
      // Si la página sigue activa, reconectar para próximos envíos
      if (currentAnimeData) {
        setTimeout(connectPort, 1000);
      }
    });
  } catch (e) {
    console.error('Error al conectar puerto:', e);
  }
}

// Envía un mensaje, usando puerto si es posible, con try-catch
function sendMessage(message) {
  try {
    if (port) {
      port.postMessage(message);
    } else {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('sendMessage error:', chrome.runtime.lastError.message);
        }
      });
    }
  } catch (e) {
    console.error('Error enviando mensaje:', e);
  }
}

// Extrae datos de la página
function sendData() {
  console.log('🔍 sendData called, URL:', window.location.href);
  const currentUrl = window.location.href;
  const isAnimePage = /https:\/\/animeav1\.com\/media\//.test(currentUrl);

  if (!isAnimePage) {
    clearPresence();
    return;
  }

  const isInfoPage = /\/media\/[^\/]+$/.test(currentUrl);
  console.log('isInfoPage:', isInfoPage);

  let titulo = null;
  let episodio = null;
  let generos = [];
  let imagen = null;
  let urlAnime = null;

  if (isInfoPage) {
    titulo = document.querySelector('.text-main.font-medium a')?.textContent.trim();
    episodio = null;
    generos = [...document.querySelectorAll('.flex.flex-wrap.items-center.gap-2 a')]
      .map(a => a.textContent)
      .filter(g => !g.includes('Términos') && !g.includes('Política') && !g.includes('Condiciones'));
    imagen = document.querySelector('figure.dark img')?.src;
    urlAnime = document.querySelector('.text-main.font-medium a')?.href;
    console.log('📄 Info page data:', { titulo, generos, imagen, urlAnime });
    enviarAApp(titulo, episodio, generos, imagen, urlAnime);
  } else {
    titulo = document.querySelector('.text-main.font-medium a')?.textContent.trim();
    episodio = document.querySelector('h1.text-lead.text-2xl')?.textContent.replace('Episodio', '').trim();
    console.log('🔎 Direct selectors:', { titulo, episodio });

    if (!titulo || !episodio) {
      const title = document.title;
      const match = title.match(/Ver (.*?) Episodio (\d+)/i);
      if (match) {
        titulo = match[1];
        episodio = match[2];
        console.log('📌 From title:', { titulo, episodio });
      }
    }

    urlAnime = currentUrl.replace(/\/\d+$/, '');
    console.log('🌐 urlAnime base:', urlAnime);

    fetch(urlAnime)
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const generosNodes = doc.querySelectorAll('.flex.flex-wrap.items-center.gap-2 a');
        generos = [...generosNodes]
          .map(a => a.textContent)
          .filter(g => !g.includes('Términos') && !g.includes('Política') && !g.includes('Condiciones'));
        const imgNode = doc.querySelector('figure.dark img');
        imagen = imgNode ? imgNode.src : null;
        console.log('📦 Fetched data:', { titulo, episodio, generos, imagen, urlAnime });
        enviarAApp(titulo, episodio, generos, imagen, urlAnime);
      })
      .catch(err => {
        console.error('❌ Error al obtener la página de información:', err);
        enviarAApp(titulo, episodio, [], null, urlAnime);
      });
  }
}

function enviarAApp(titulo, episodio, generos, imagen, urlAnime) {
  if (!titulo || !urlAnime) {
    console.warn('⚠️ Faltan datos esenciales', { titulo, urlAnime });
    return;
  }

  const data = {
    titulo,
    episodio: episodio || '?',
    generos: generos || [],
    imagen: imagen || 'https://via.placeholder.com/300x425?text=No+Image',
    url: urlAnime
  };

  currentAnimeData = data;
  connectPort(); // Asegura puerto activo
  sendMessage({ type: 'update', payload: data });
  startHeartbeat();
}

function startHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    if (currentAnimeData) {
      console.log('💓 Enviando heartbeat');
      sendMessage({ type: 'heartbeat', payload: currentAnimeData });
    }
  }, 10000);
}

function stopHeartbeat() {
  try {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  } catch (e) {
    console.error('Error en stopHeartbeat:', e);
  }
}

function clearPresence() {
  try {
    console.log('🧹 Limpiando presencia');
    stopHeartbeat();
    currentAnimeData = null;
    sendMessage({ type: 'clear' });
    if (port) {
      port.disconnect();
      port = null;
    }
  } catch (e) {
    console.error('Error en clearPresence:', e);
  }
}

// Observar cambios de URL
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const url = window.location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    sendData();
  }
});
observer.observe(document, { subtree: true, childList: true });

window.addEventListener('popstate', sendData);
window.addEventListener('pushstate', sendData);

// Eventos de cierre de página con try-catch
window.addEventListener('beforeunload', () => {
  try {
    console.log('beforeunload');
    clearPresence();
  } catch (e) {
    console.error('Error en beforeunload:', e);
  }
});
window.addEventListener('pagehide', () => {
  try {
    console.log('pagehide');
    clearPresence();
  } catch (e) {
    console.error('Error en pagehide:', e);
  }
});

if (document.readyState === 'complete') {
  sendData();
} else {
  window.addEventListener('load', sendData);
}