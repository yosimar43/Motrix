// =====================================
// 🚀 Extensión Motrix Downloader Redirect
// Intercepta descargas y las envía a Motrix vía RPC
// =====================================

const MOTRIX_RPC_URL = "http://localhost:16800/jsonrpc";

// Notificación al instalar la extensión
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Extensión de Descarga",
    message: "Extensión lista para enviar archivos a Motrix ✅",
  });
  console.log("Extensión cargada y lista.");
});

// Listener: cada vez que inicia una descarga
chrome.downloads.onCreated.addListener((downloadItem) => {
  if (!downloadItem || !downloadItem.url) return;

  console.log("Interceptada nueva descarga:", downloadItem.url);

  // Cancelar la descarga normal
  chrome.downloads.cancel(downloadItem.id, () => {
    console.log("Descarga cancelada en el navegador, comprobando Motrix...");
    comprobarMotrix()
      .then(() => enviarAMotrix(downloadItem.url))
      .catch(() => {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "Motrix no detectado ⚠️",
          message: "Asegúrate de que Motrix esté abierto con el RPC activado.",
        });
        console.error("Motrix no responde. ¿Está abierto?");
      });
  });
});

// =====================================
// 🔎 Función: comprobar si Motrix está activo
// =====================================
function comprobarMotrix() {
  return fetch(MOTRIX_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "ping",
      method: "aria2.getVersion",
      params: []
    }),
  }).then((res) => {
    if (!res.ok) throw new Error("Motrix RPC no disponible");
    return res.json();
  });
}

// =====================================
// 🚀 Función: enviar enlace a Motrix
// =====================================
function enviarAMotrix(url) {
  fetch(MOTRIX_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "aria2.addUri",
      id: new Date().getTime().toString(),
      params: [[url]],
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Motrix aceptó la descarga:", data);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Motrix",
        message: "Descarga enviada correctamente ✅",
      });
    })
    .catch((err) => {
      console.error("Error al enviar a Motrix:", err);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Motrix",
        message: "❌ Error: no se pudo enviar a Motrix",
      });
    });
}
