# RIPPA

Sistema que muestra en Discord el anime que estás viendo actualmente en [animeav1.com](https://animeav1.com), con portada, título, episodio y géneros, ya estoy preparando para hacerlo compatible con AnimeFLV y AnimeYT. Consta de una aplicación de escritorio y una extensión para navegadores basados en Chromium.

![Banner del proyecto](https://i.imgur.com/FOugpeN.png)  

## Características

- Detecta automáticamente el anime y episodio desde la página de reproducción.
- Extrae título, número de episodio, géneros y portada del anime.
- Actualiza tu perfil de Discord con Rich Presence (detalles, estado, botones e imagen).
- Interfaz minimalista en la bandeja del sistema (Windows) con información en tiempo real.
- Popup de la extensión con estado de la app y último anime visto.
- Compatible con Chrome, Edge, Brave, OperaGX y demás navegadores Chromium.
- Se limpia automáticamente la presencia al cerrar la pestaña o navegar fuera del sitio.

## Requisitos previos

- Windows (para la aplicación de escritorio, aunque al estar en electron y Node se puede compilar o ejecutar el codigo del repo en Linux).
- Navegador basado en Chromium (Chrome, Edge, Brave, OperaGX, etc.).
- Discord instalado y ejecutándose en segundo plano.
- Conexión a Internet.

## Descarga e instalación

### Aplicación de escritorio

Puedes descargar el instalador desde la sección [Releases](https://github.com/Vicemi/Rippa/releases). Busca el archivo `AnimeRichPresence-Setup-x.x.x.exe`.

1. Ejecuta el instalador y sigue los pasos.
2. Una vez instalada, la aplicación se iniciará automáticamente y se agregará al inicio de Windows.
3. Aparecerá un icono en la bandeja del sistema (junto al reloj). Al hacer clic, se abre la ventana de estado.

### Extensión del navegador

Descarga el archivo `extension.zip` desde la misma sección de [Releases](https://github.com/Vicemi/Rippa/releases).

#### Instalación manual (modo desarrollador)

1. Descomprime el archivo ZIP en una carpeta (ej. `C:\anime-richpresence-extension`).
2. Abre tu navegador y ve a la página de extensiones:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`
3. Activa el **modo desarrollador** (esquina superior derecha).
4. Haz clic en **Cargar extensión descomprimida** y selecciona la carpeta donde descomprimiste los archivos.
5. La extensión aparecerá en la lista. Asegúrate de que esté habilitada.

## Uso

1. Asegúrate de que la aplicación de escritorio esté ejecutándose (icono en la bandeja).
2. Abre Discord.
3. Ve a [animeav1.com](https://animeav1.com) y navega hasta la página de un anime (por ejemplo, `https://animeav1.com/media/vigilante-boku-no-hero-academia-illegals-2nd-season/11`).
4. Automáticamente, la extensión detectará el contenido y enviará los datos a la app.
5. En tu perfil de Discord aparecerá la Rich Presence con la información del anime.
6. Puedes abrir la ventana de la app (clic en el icono de bandeja) para ver los detalles actuales.
7. El popup de la extensión (clic en el icono de la extensión) te mostrará el estado de la app y el último anime detectado.

## Compilación desde el código fuente

Si deseas compilar la aplicación por ti mismo:

1. Clona el repositorio:

```bash
git clone https://github.com/Vicemi/Rippa.git
cd Rippa
```

2. Instala las dependencias:

```bash
npm install
```

3. Compila el instalador de Windows:

```bash
npm run dist
```

El instalador se generará en la carpeta `dist`.

Para la extensión, los archivos fuente están en `src/extension`. Puedes empaquetarlos manualmente (ZIP) para distribuir.

## Compatibilidad con navegadores

✅ Google Chrome  
✅ Microsoft Edge  
✅ Brave  
✅ Opera / OperaGX  
✅ Vivaldi  
✅ Cualquier navegador basado en Chromium  

❌ No es compatible con Firefox ni Safari (requieren adaptaciones específicas, esto por ahora ya que estoy trabajando en la extension de Firefox).


## Solución de problemas

**La extensión no conecta con la app:**  
Asegúrate de que la app esté corriendo. En Brave, puede que necesites desactivar los escudos para el sitio o añadir una excepción en `brave://adblock`, he testeado con los escudos y tambien funciona, y tambien con adblock, pero a veces adblock y los escudos de brave suelen bloquear las peticiones debido a ser un servidor local.

**No aparece la presencia en Discord:**  
Verifica que Discord esté abierto y que el Client ID sea correcto, en la aplicacion compilada ya viene con un id que yo ofresco, si deseas cambiarlo por otro puedes hacerlo sin problemas. Comprueba que la imagen `logo` esté subida.

**La portada no se muestra:**  
Discord puede tardar unos segundos en cargar imágenes externas. Si persiste, usa un fallback a `logo`.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios importantes antes de enviar un pull request.

## Licencia

Este proyecto está bajo la licencia ISC. Consulta el archivo `LICENSE` para más detalles.

## Enlaces

- Repositorio en GitHub  
- Descargar última versión  
- Sitio web del autor  

---
