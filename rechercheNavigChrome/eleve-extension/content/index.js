// Content Script - Injecté sur toutes les pages web

(function () {
  "use strict";

  if (!chrome.runtime?.id) return;

  const currentUrl = window.location.href;
  const isGoogle = /^https:\/\/www\.google\.(com|fr)\//i.test(currentUrl);

  // ─── Envoi sécurisé (callback pour compatibilité) ───
  function envoyer(msg) {
    if (!chrome.runtime?.id) return;
    try {
      chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
    } catch (e) { /* contexte invalidé */ }
  }

  // ─── Tracking temps passé sur la page ───
  let tempsArrivee = Date.now();

  function envoyerTemps() {
    const tempsPasse = Date.now() - tempsArrivee;
    if (tempsPasse < 1000) return;

    envoyer({
      type: "TEMPS_PAGE",
      data: {
        url: currentUrl.split("#")[0].split("?")[0],
        tempsPasse
      }
    });
  }

  window.addEventListener("beforeunload", envoyerTemps);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      envoyerTemps();
      tempsArrivee = Date.now();
    } else {
      tempsArrivee = Date.now();
    }
  });

  // ═══════════════════════════════════════════════
  // ─── Pages Google : requêtes + collecte clics ──
  // ═══════════════════════════════════════════════
  if (isGoogle) {
    const params = new URLSearchParams(window.location.search);
    const requete = params.get("q");

    if (requete) {
      envoyer({
        type: "REQUETE_RECHERCHE",
        data: { texte: requete, timestamp: Date.now() }
      });
    }

    // Extraire l'URL réelle (Google utilise parfois /url?q=...)
    function extractRealUrl(url) {
      try {
        const u = new URL(url);
        if (u.hostname.includes("google.") && u.pathname === "/url") {
          return u.searchParams.get("q") || url;
        }
      } catch (e) {}
      return url;
    }

    // CAPTURE phase : intercepte les clics AVANT les handlers de Google
    document.addEventListener("click", (e) => {
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;

      const rawUrl = anchor.href;
      if (!rawUrl || rawUrl.startsWith("javascript:")) return;

      const url = extractRealUrl(rawUrl);
      // Ignorer les liens internes Google
      if (/^https:\/\/www\.google\.(com|fr)\//i.test(url)) return;
      if (/^https:\/\/(accounts|support|policies|maps)\.google\./.test(url)) return;

      const h3 = anchor.querySelector("h3") || anchor.closest("div.g")?.querySelector("h3");
      const titre = h3?.textContent || anchor.textContent.trim().substring(0, 100) || url;

      envoyer({
        type: "LIEN_COLLECTE",
        data: { url, titre, timestamp: Date.now() }
      });
    }, true);

    return; // Pas de highlight tool sur Google
  }

  // ═══════════════════════════════════════════════
  // ─── Pages non-Google ──────────────────────────
  // ═══════════════════════════════════════════════

  // Collecter auto si on vient de Google
  const referrer = document.referrer || "";
  if (/^https:\/\/www\.google\.(com|fr)\//i.test(referrer)) {
    function envoyerCollecte() {
      envoyer({
        type: "LIEN_COLLECTE",
        data: {
          url: currentUrl,
          titre: document.title || currentUrl,
          timestamp: Date.now()
        }
      });
    }

    if (document.readyState === "complete") {
      envoyerCollecte();
    } else {
      window.addEventListener("load", envoyerCollecte);
    }
  }

  // ─── Outil de surlignage (fluo) ───
  let popup = null;
  let highlighterActif = false;

  // Demander l'état initial au background
  try {
    chrome.runtime.sendMessage({ type: "GET_HIGHLIGHTER_ETAT" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response) highlighterActif = response.actif;
    });
  } catch (e) {}

  // Écouter les changements d'état (sidebar ouverte/fermée)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "HIGHLIGHTER_ETAT") {
      highlighterActif = msg.actif;
      if (!msg.actif) supprimerPopup();
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!highlighterActif) return;
    if (popup && popup.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const texte = selection?.toString().trim();

      if (!texte || texte.length < 3) {
        supprimerPopup();
        return;
      }

      afficherPopup(e.clientX, e.clientY, selection, texte);
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (popup && !popup.contains(e.target)) {
      supprimerPopup();
    }
  });

  function afficherPopup(x, y, selection, texte) {
    supprimerPopup();

    popup = document.createElement("div");
    popup.className = "rnc-highlight-popup";
    popup.innerHTML = `
      <button class="rnc-hl-btn rnc-hl-jaune" data-color="#fff176" title="Surligner en jaune"></button>
      <button class="rnc-hl-btn rnc-hl-vert" data-color="#a5d6a7" title="Surligner en vert"></button>
    `;

    popup.style.left = Math.max(8, x - 36) + "px";
    popup.style.top = Math.max(8, y - 48) + "px";

    popup.querySelectorAll(".rnc-hl-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const couleur = btn.dataset.color;

        // Surligner dans la page
        try {
          const range = selection.getRangeAt(0);
          const mark = document.createElement("mark");
          mark.style.backgroundColor = couleur;
          mark.style.borderRadius = "2px";
          mark.style.padding = "0 2px";
          range.surroundContents(mark);
        } catch (err) {
          // Sélection multi-éléments, pas de highlight visuel
        }

        // Envoyer à la sidebar
        envoyer({
          type: "PASSAGE_SURLIGNE",
          data: {
            texte,
            couleur,
            url: currentUrl,
            timestamp: Date.now()
          }
        });

        window.getSelection().removeAllRanges();
        supprimerPopup();
      });
    });

    document.body.appendChild(popup);
  }

  function supprimerPopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
  }
})();
