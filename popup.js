document.addEventListener("DOMContentLoaded", () => {
  const minSizeInput = document.getElementById("minSize");
  const excludedExtInput = document.getElementById("excludedExt");
  const status = document.getElementById("status");
  const saveBtn = document.getElementById("save");
  const skipNextBtn = document.getElementById("skipNext");

  // Cargar configuración
  chrome.storage.local.get(["minSizeMB", "excludedExt", "skipNext"], (data) => {
    if (data.minSizeMB) minSizeInput.value = data.minSizeMB;
    if (data.excludedExt) excludedExtInput.value = data.excludedExt.join(",");

    if (data.skipNext) {
      skipNextBtn.classList.add("active");
      skipNextBtn.textContent = "✅ Omitir próxima descarga (activado)";
    }
  });

  // Guardar
  saveBtn.addEventListener("click", () => {
    const minSizeMB = parseInt(minSizeInput.value, 10) || 5;
    const excludedExt = excludedExtInput.value
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    chrome.storage.local.set({ minSizeMB, excludedExt }, () => {
      status.style.color = "green";
      status.textContent = "✅ Configuración guardada";
      setTimeout(() => status.textContent = "", 2500);
    });
  });

  // Toggle skipNext
  skipNextBtn.addEventListener("click", () => {
    chrome.storage.local.get("skipNext", (data) => {
      if (data.skipNext) {
        // Desactivar
        chrome.storage.local.remove("skipNext", () => {
          skipNextBtn.classList.remove("active");
          skipNextBtn.textContent = "⏭️ Omitir la próxima descarga";
          status.style.color = "#333";
          status.textContent = "La opción fue desactivada";
          setTimeout(() => status.textContent = "", 2000);
        });
      } else {
        // Activar
        chrome.storage.local.set({ skipNext: true }, () => {
          skipNextBtn.classList.add("active");
          skipNextBtn.textContent = "✅ Omitir próxima descarga (activado)";
          status.style.color = "orange";
          status.textContent = "Se omitirá la próxima descarga";
          setTimeout(() => status.textContent = "", 2000);
        });
      }
    });
  });
});
