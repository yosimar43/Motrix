// =====================================
// 🚀 Extensión Motrix Downloader Redirect
// Intercepta descargas y las envía a Motrix vía RPC
// =====================================

const MOTRIX_RPC_URL = "http://localhost:16800/jsonrpc";

// Valores por defecto (si storage está vacío)
const DEFAULT_MIN_MB = 5;
const DEFAULT_EXCLUDED = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".wav", ".ogg"
];

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

  // Leemos skipNext y la configuración actual desde storage
  chrome.storage.local.get(["skipNext", "minSizeMB", "excludedExt"], (data) => {
    // Si skipNext está activo: lo consumimos y dejamos que la descarga prosiga normalmente
    if (data.skipNext) {
      chrome.storage.local.remove("skipNext", () => {
        console.log("SkipNext activado: esta descarga no será interceptada.");
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "Extensión omitida (1 descarga)",
          message: "La próxima descarga se dejó al navegador.",
        });
      });
      return; // no cancelar ni enviar a Motrix
    }

    // Configuración (valores por defecto si no existen)
    const minMB = (data.minSizeMB || DEFAULT_MIN_MB);
    const minBytes = minMB * 1024 * 1024;
    const excludedExt = Array.isArray(data.excludedExt) && data.excludedExt.length
      ? data.excludedExt.map(e => e.toLowerCase())
      : DEFAULT_EXCLUDED;

    // Validar por extensión
    const urlLower = downloadItem.url.toLowerCase();
    if (excludedExt.some(ext => urlLower.endsWith(ext))) {
      console.log("Descarga ignorada (extensión excluida):", downloadItem.url);
      return;
    }

    // Validar por tamaño si está disponible
    if (downloadItem.fileSize && downloadItem.fileSize < minBytes) {
      console.log("Descarga ignorada (muy pequeña):", downloadItem.fileSize, "bytes");
      return;
    }

    // Cancelar la descarga normal y redirigir a Motrix
    chrome.downloads.cancel(downloadItem.id, () => {
      console.log("Descarga cancelada en navegador, comprobando Motrix...");
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

