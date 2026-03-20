// Service Worker - Extension NavigKid!

// Ouvre le side panel au clic sur l'icône
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Active le side panel sur Google
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─── Tracking état sidebar (pour activer/désactiver le fluo) ───
// Utilise chrome.storage.session pour survivre aux redémarrages du service worker

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sidebar") return;

  chrome.storage.session.set({ sidebarOuverte: true });
  diffuserEtatHighlighter(true);

  port.onDisconnect.addListener(() => {
    chrome.storage.session.set({ sidebarOuverte: false });
    diffuserEtatHighlighter(false);
  });
});

function diffuserEtatHighlighter(actif) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, { type: "HIGHLIGHTER_ETAT", actif }).catch(() => {});
    }
  });
}

// Répondre aux content scripts qui demandent l'état au chargement
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_HIGHLIGHTER_ETAT") {
    chrome.storage.session.get("sidebarOuverte", (result) => {
      sendResponse({ actif: result.sidebarOuverte === true });
    });
    return true; // réponse asynchrone
  }
});
