# Motrix Downloader Redirect

Extensión de navegador (Chrome/Edge) que **redirige automáticamente todas las descargas a Motrix**, usando su API **JSON-RPC**.  
De esta manera, cada vez que inicies una descarga en el navegador, será cancelada y añadida directamente a Motrix 🚀.

---

## 📌 Características

- Intercepta cualquier descarga iniciada desde el navegador.
- Cancela la descarga normal y la envía a **Motrix**.
- Se conecta al servidor **RPC de Motrix** (por defecto: `http://localhost:16800/jsonrpc`).
- Muestra notificaciones cuando la descarga se envía correctamente.
- Ligera y sin configuración complicada.

---

## ⚙️ Cómo funciona

1. El navegador detecta el inicio de una descarga con la API `chrome.downloads.onCreated`.
2. La extensión **cancela** la descarga interna del navegador (`chrome.downloads.cancel`).
3. Se construye una petición **JSON-RPC** con el método `aria2.addUri`.
4. Se envía la URL de descarga a Motrix mediante `fetch` → `http://localhost:16800/jsonrpc`.
5. Motrix recibe el enlace y comienza a descargarlo.
6. El usuario recibe una notificación confirmando que la tarea fue añadida.

---

## 📂 Estructura del proyecto

