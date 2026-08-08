// Popup NavigKid! — aides de lecture (dictionnaire / traducteur) + accès sidebar
// Les deux aides sont exclusives : en activer une désactive l'autre.

(function () {
  "use strict";

  const toggleDictionnaire = document.getElementById("toggle-dictionnaire");
  const toggleTraducteur = document.getElementById("toggle-traducteur");
  const blocLangue = document.getElementById("bloc-langue");
  const choixLangue = document.getElementById("choix-langue");
  const boutonSidebar = document.getElementById("ouvrir-sidebar");
  const boutonPdf = document.getElementById("ouvrir-pdf");

  // ─── État initial depuis le storage ───
  chrome.storage.local.get(["navigkidAide", "navigkidLangue"], (res) => {
    const aide = res.navigkidAide || null; // 'dictionnaire' | 'traducteur' | null
    toggleDictionnaire.checked = aide === "dictionnaire";
    toggleTraducteur.checked = aide === "traducteur";
    blocLangue.hidden = aide !== "traducteur";
    choixLangue.value = res.navigkidLangue || "fr";
  });

  function definirAide(aide) {
    toggleDictionnaire.checked = aide === "dictionnaire";
    toggleTraducteur.checked = aide === "traducteur";
    blocLangue.hidden = aide !== "traducteur";
    chrome.storage.local.set({ navigkidAide: aide });
  }

  toggleDictionnaire.addEventListener("change", () => {
    definirAide(toggleDictionnaire.checked ? "dictionnaire" : null);
  });

  toggleTraducteur.addEventListener("change", () => {
    definirAide(toggleTraducteur.checked ? "traducteur" : null);
  });

  choixLangue.addEventListener("change", () => {
    chrome.storage.local.set({ navigkidLangue: choixLangue.value });
  });

  // ─── Ouvrir la sidebar (questionnaire de recherche) ───
  boutonSidebar.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id !== undefined) {
        chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      }
    });
  });

  // ─── PDF : proposer la visionneuse NavigKid quand l'onglet actif est un PDF ───

  // Google Drive / visionneuses : extraire l'URL réelle du PDF si présente en paramètre
  function extrairePdfUrl(url) {
    try {
      const u = new URL(url);
      const param = u.searchParams.get("url") || u.searchParams.get("file");
      if (param && estPdf(param)) return param;
    } catch (e) {}
    return url;
  }

  function estPdf(url) {
    const minuscule = (url || "").toLowerCase();
    return (
      minuscule.endsWith(".pdf") ||
      minuscule.includes(".pdf?") ||
      minuscule.includes(".pdf#") ||
      minuscule.includes("content-type=application/pdf")
    );
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return;
    if (estPdf(extrairePdfUrl(tab.url))) {
      boutonPdf.hidden = false;
    }
  });

  boutonPdf.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url) return;
      const urlReelle = extrairePdfUrl(tab.url);
      const visionneuse =
        chrome.runtime.getURL("pdfviewer/index.html") + "?url=" + encodeURIComponent(urlReelle);
      chrome.tabs.update(tab.id, { url: visionneuse });
      window.close();
    });
  });
})();
