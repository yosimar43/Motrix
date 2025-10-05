// background.js (mejorado para evitar duplicados y loops)
// =====================================
const MOTRIX_RPC_URL = "http://localhost:16800/jsonrpc";

// Defaults
const DEFAULT_MIN_MB = 5;
const DEFAULT_EXCLUDED = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".wav", ".ogg"
];

// Protección contra duplicados
const processedIds = new Set();      // id de descarga ya procesados
const recentUrls = new Map();        // url -> timestamp última procesada

// Umbrales
const URL_DUPLICATE_WINDOW = 5000;   // ms: si la misma URL fue procesada < 5s atrás, la ignoramos
const ID_TTL = 60 * 1000;            // ms: cuánto mantenemos processedIds antes de limpiar

// Notificación al instalar (solo una vez)
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.create("motrix_ext_installed", {
    type: "basic",
    iconUrl: "icon.png",
    title: "Extensión Motrix",
    message: "Extensión lista para enviar archivos a Motrix ✅",
  });
  console.log("Extensión cargada y lista.");
});

// Listener: cada vez que inicia una descarga
chrome.downloads.onCreated.addListener((downloadItem) => {
  try {
    if (!downloadItem || !downloadItem.url) return;
    const now = Date.now();

    // 1) Evitar procesar varias veces el mismo downloadId
    if (processedIds.has(downloadItem.id)) {
      console.log("[skip] downloadId ya procesado:", downloadItem.id);
      return;
    }

    // 2) Evitar procesar la misma URL muy seguido (p. ej. reintentos)
    const last = recentUrls.get(downloadItem.url);
    if (last && (now - last) < URL_DUPLICATE_WINDOW) {
      console.log("[skip] misma URL procesada muy recientemente:", downloadItem.url);
      return;
    }

    // Marcar como procesado y programar limpieza
    processedIds.add(downloadItem.id);
    recentUrls.set(downloadItem.url, now);
    setTimeout(() => processedIds.delete(downloadItem.id), ID_TTL);

    console.log("Interceptada nueva descarga:", downloadItem.url, "id:", downloadItem.id);

    // Leer configuración + flag skipNext
    chrome.storage.local.get(["skipNext", "minSizeMB", "excludedExt"], (data) => {
      // Si skipNext está activo, lo consumimos y dejamos pasar esta descarga
      if (data && data.skipNext) {
        chrome.storage.local.remove("skipNext", () => {
          console.log("skipNext consumido: permitiendo esta descarga (id):", downloadItem.id);
          chrome.notifications.create(`motrix_skip_${downloadItem.id}`, {
            type: "basic",
            iconUrl: "icon.png",
            title: "Extensión omitida (1 descarga)",
            message: "La próxima descarga se dejó al navegador.",
          });
        });
        return;
      }

      // Obtener configuración
      const minMB = (data && data.minSizeMB) ? data.minSizeMB : DEFAULT_MIN_MB;
      const minBytes = minMB * 1024 * 1024;
      const excludedExt = (data && Array.isArray(data.excludedExt) && data.excludedExt.length)
        ? data.excludedExt.map(e => e.toLowerCase())
        : DEFAULT_EXCLUDED;

      // Validar extensión (si coincide, no enviamos)
      const urlLower = downloadItem.url.toLowerCase();
      if (excludedExt.some(ext => urlLower.endsWith(ext))) {
        console.log("Descarga ignorada por extensión excluida:", downloadItem.url);
        return;
      }

      // Validar tamaño si está disponible
      if (downloadItem.fileSize && downloadItem.fileSize < minBytes) {
        console.log("Descarga ignorada (archivo muy pequeño):", downloadItem.fileSize, "bytes");
        return;
      }

      // Proceder: cancelar la descarga en el navegador y enviarla a Motrix
      chrome.downloads.cancel(downloadItem.id, () => {
        if (chrome.runtime.lastError) {
          // si cancelar falla, logueamos pero NO entramos en loop
          console.warn("chrome.downloads.cancel falló:", chrome.runtime.lastError);
        } else {
          console.log("Descarga cancelada en el navegador (id):", downloadItem.id);
        }

        // Usamos un id de notificación único por descarga para evitar duplicados
        const notId = `motrix_notify_${downloadItem.id}`;

        // Crear notificación inicial (estado: enviando)
        chrome.notifications.create(notId, {
          type: "basic",
          iconUrl: "icon.png",
          title: "Motrix",
          message: "Enviando descarga a Motrix...",
        }, () => {
          // Comprobar Motrix y enviar
          comprobarMotrix()
            .then(() => enviarAMotrix(downloadItem.url, notId))
            .catch(() => {
              console.error("Motrix no responde. Asegúrate de que esté abierto con RPC activo.");
              chrome.notifications.update(notId, {
                title: "Motrix no detectado ⚠️",
                message: "Asegúrate de que Motrix esté abierto y el RPC activado."
              });
            });
        });
      });
    });

  } catch (err) {
    console.error("Error en onCreated:", err);
  }
});

// =====================================
// comprobarMotrix: ping simple (aria2.getVersion)
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
    if (!res.ok) throw new Error("Motrix RPC no disponible (status " + res.status + ")");
    return res.json();
  });
}

// =====================================
// enviarAMotrix: envía y actualiza notificación por id
// =====================================
function enviarAMotrix(url, notificationId) {
  // por si no nos pasaron notificationId
  const notifId = notificationId || `motrix_notify_${Math.random().toString(36).slice(2)}`;

  return fetch(MOTRIX_RPC_URL, {
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
      chrome.notifications.update(notifId, {
        title: "Descarga enviada ✅",
        message: "La descarga fue añadida a Motrix.",
      });
    })
    .catch((err) => {
      console.error("Error al enviar a Motrix:", err);
      chrome.notifications.update(notifId, {
        title: "Error: no se pudo enviar a Motrix",
        message: "Comprueba que Motrix esté abierto y el RPC responda.",
      });
    });
}
