document.addEventListener("DOMContentLoaded", () => {
  const minSizeInput = document.getElementById("min-size");
  const excludedExtInput = document.getElementById("excluded");
  const maxDownloadsInput = document.getElementById("max-downloads");
  const saveBtn = document.getElementById("save-settings");
  const skipNextBtn = document.getElementById("skip-next");

  const linksInput = document.getElementById("links-input");
  const sendLinksBtn = document.getElementById("send-links");
  const clearLinksBtn = document.getElementById("clear-links");
  const pendingCount = document.getElementById("pending-count");
  const activeCount = document.getElementById("active-count");
  const completedCount = document.getElementById("completed-count");

  let queue = { pending: [], active: 0, completed: 0 };

  // Load settings
  chrome.storage.local.get(["minSizeMB", "excludedExt", "maxDownloads", "skipNext"], (data) => {
    if (data.minSizeMB) minSizeInput.value = data.minSizeMB;
    if (data.excludedExt) excludedExtInput.value = data.excludedExt.join(",");
    if (data.maxDownloads) maxDownloadsInput.value = data.maxDownloads;
    if (data.skipNext) {
      skipNextBtn.textContent = "✅ Omitir próxima descarga (activado)";
      skipNextBtn.classList.add("active");
    }
  });

  // Save settings
  saveBtn.addEventListener("click", () => {
    const minSizeMB = parseInt(minSizeInput.value, 10) || 5;
    const excludedExt = excludedExtInput.value
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const maxDownloads = parseInt(maxDownloadsInput.value, 10) || 3;

    chrome.storage.local.set({ minSizeMB, excludedExt, maxDownloads }, () => {
      // Efecto visual de guardado
      saveBtn.style.transform = "scale(0.95)";
      setTimeout(() => {
        saveBtn.style.transform = "scale(1)";
        
        // Mostrar confirmación
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "✅ Guardado!";
        setTimeout(() => {
          saveBtn.textContent = originalText;
        }, 1000);
      }, 200);
    });
  });

  // Toggle skip-next-download
  skipNextBtn.addEventListener("click", () => {
    chrome.storage.local.get("skipNext", (data) => {
      const isSkipping = !data.skipNext;
      chrome.storage.local.set({ skipNext: isSkipping }, () => {
        if (isSkipping) {
          skipNextBtn.textContent = "✅ Omitir próxima descarga (activado)";
          skipNextBtn.classList.add("active");
        } else {
          skipNextBtn.textContent = "Omitir próxima descarga";
          skipNextBtn.classList.remove("active");
        }
      });
    });
  });

  // Handle multiple links
  sendLinksBtn.addEventListener("click", () => {
    const links = linksInput.value
      .split("\n")
      .map(link => link.trim())
      .filter(link => link.startsWith("http"));
    
    if (links.length === 0) {
      alert("Por favor, ingresa al menos un enlace válido");
      return;
    }

    queue.pending.push(...links);
    updateQueueStatus();

    // Enviar mensaje a background script
    chrome.runtime.sendMessage({ 
      action: "downloadBulk", 
      links: links 
    }, (response) => {
      if (response && response.success) {
        linksInput.value = "";
        updateQueueStatus();
      }
    });
  });

  clearLinksBtn.addEventListener("click", () => {
    linksInput.value = "";
  });

  function updateQueueStatus() {
    pendingCount.textContent = queue.pending.length;
    activeCount.textContent = queue.active;
    completedCount.textContent = queue.completed;
  }

  // Actualizar estado de la cola periódicamente
  setInterval(updateQueueStatus, 1000);
});