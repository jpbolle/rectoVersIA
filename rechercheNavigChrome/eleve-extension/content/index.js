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

  // ─── PDF ouvert dans le lecteur natif de Chrome : bouton "Lecture via NavigKid!" ───

  function estPagePdfNative() {
    if (location.href.startsWith("chrome-extension://")) return false;
    if (document.contentType === "application/pdf") return true;
    if (document.querySelector('embed[type="application/pdf"]')) return true;
    if (location.href.toLowerCase().split("?")[0].endsWith(".pdf")) return true;
    return false;
  }

  if (estPagePdfNative()) {
    const boutonPdf = document.createElement("button");
    boutonPdf.id = "rnc-pdf-btn";
    boutonPdf.type = "button";

    const icone = document.createElement("img");
    icone.src = chrome.runtime.getURL("assets/icon48.png");
    icone.alt = "";

    const libelle = document.createElement("span");
    libelle.textContent = "Lecture via NavigKid!";

    boutonPdf.appendChild(icone);
    boutonPdf.appendChild(libelle);

    boutonPdf.addEventListener("click", () => {
      const viewerUrl =
        chrome.runtime.getURL("pdfviewer/index.html") +
        "?url=" + encodeURIComponent(location.href);
      location.href = viewerUrl;
    });

    (document.body || document.documentElement).appendChild(boutonPdf);
    return; // Pas d'aides sur le lecteur natif (son texte est inaccessible)
  }

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
    if (msg.type === "NAVIGKID_BANDEAU") {
      afficherBandeauOuverture();
    }
  });

  // ─── Pont avec l'app Recto-versIA ───
  // La page de l'activité poste un message quand l'élève clique sur
  // « Commencer ma recherche » ; on le relaie au service worker, qui ouvre le
  // panneau latéral et la page de recherche, puis on renvoie le résultat à la page.
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "rectoversia-navigkid") return;
    if (data.type !== "DEMARRER_RECHERCHE") return;

    envoyerAvecReponse(
      { type: "OUVRIR_RECHERCHE", questionnaireId: data.questionnaireId },
      (reponse) => {
        window.postMessage(
          {
            source: "navigkid-extension",
            type: "DEMARRAGE_RESULTAT",
            panneauOuvert: !!(reponse && reponse.panneauOuvert),
          },
          window.location.origin
        );
      }
    );
  });

  // ─── Bandeau de repli : Chrome a refusé d'ouvrir le panneau tout seul ───
  function afficherBandeauOuverture() {
    if (document.getElementById("rnc-bandeau-ouverture")) return;

    const bandeau = document.createElement("div");
    bandeau.id = "rnc-bandeau-ouverture";
    bandeau.className = "rnc-bandeau";

    const texte = document.createElement("span");
    texte.className = "rnc-bandeau-texte";
    texte.textContent =
      "Ta recherche est prête. Clique sur l'icône NavigKid! (en haut à droite du navigateur), puis sur « Ouvrir le questionnaire ».";

    const fermer = document.createElement("button");
    fermer.className = "rnc-bandeau-fermer";
    fermer.textContent = "✕";
    fermer.title = "Fermer";
    fermer.addEventListener("click", () => bandeau.remove());

    const icone = document.createElement("span");
    icone.className = "rnc-bandeau-icone";
    icone.textContent = "🔍";

    bandeau.appendChild(icone);
    bandeau.appendChild(texte);
    bandeau.appendChild(fermer);
    document.documentElement.appendChild(bandeau);
  }

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

  // ═══════════════════════════════════════════════
  // ─── Aides de lecture : dictionnaire / traducteur ───
  // Pilotées par la popup de l'extension (toggles exclusifs).
  // Clic sur un mot → surlignage fluo + bulle (définition ou traduction).
  // ═══════════════════════════════════════════════

  let aideActive = null; // 'dictionnaire' | 'traducteur' | null
  let langueTraduction = "fr";
  let bulleAide = null;
  let surlignageMots = null; // Highlight (API CSS Custom Highlight)

  // Visionneuse PDF de l'extension : comportement adapté (popup + hover, pas de bulle inline)
  const estVisionneusePdf = !!document.getElementById("pdf-container");
  const consultationsPdf = new Map(); // wrapper → { type, mot, reponse }
  let carteWrapperActuel = null; // wrapper dont la carte est affichée

  // Lettres (accents compris) et trait d'union — l'apostrophe sépare (l'école → école)
  const MOT_CHAR = /[\p{L}\p{M}-]/u;

  chrome.storage.local.get(["navigkidAide", "navigkidLangue"], (res) => {
    aideActive = res.navigkidAide || null;
    // Dans la visionneuse PDF, le dictionnaire est actif par défaut
    if (estVisionneusePdf && !aideActive) aideActive = "dictionnaire";
    langueTraduction = res.navigkidLangue || "fr";
    appliquerCurseurAide();
  });

  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.navigkidAide) {
      aideActive = changes.navigkidAide.newValue || null;
      if (estVisionneusePdf && !aideActive) aideActive = "dictionnaire";
      appliquerCurseurAide();
      if (aideActive !== "dictionnaire") {
        supprimerBulleAide();
        surlignageMots?.clear();
      }
      if (aideActive !== "traducteur") {
        retirerToutesTraductions();
      }
      if (estVisionneusePdf) {
        retirerToutesConsultationsPdf();
      }
    }
    if (changes.navigkidLangue) {
      langueTraduction = changes.navigkidLangue.newValue || "fr";
    }
  });

  function appliquerCurseurAide() {
    document.documentElement.style.cursor = aideActive ? "help" : "";
  }

  // Surlignage fluo sans modifier le DOM de la page (API CSS Custom Highlight)
  function surlignerMot(noeudTexte, debut, fin) {
    if (typeof Highlight === "undefined" || !CSS.highlights) return;
    if (!surlignageMots) {
      surlignageMots = new Highlight();
      CSS.highlights.set("navigkid-mot", surlignageMots);
    }
    const range = document.createRange();
    range.setStart(noeudTexte, debut);
    range.setEnd(noeudTexte, fin);
    surlignageMots.add(range);
  }

  function motSousLeClic(x, y) {
    let noeud = null;
    let offset = 0;
    if (typeof document.caretRangeFromPoint === "function") {
      const range = document.caretRangeFromPoint(x, y);
      if (!range) return null;
      noeud = range.startContainer;
      offset = range.startOffset;
    } else if (typeof document.caretPositionFromPoint === "function") {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      noeud = pos.offsetNode;
      offset = pos.offset;
    }
    if (!noeud || noeud.nodeType !== Node.TEXT_NODE) return null;

    const texte = noeud.textContent || "";
    let debut = offset;
    let fin = offset;
    while (debut > 0 && MOT_CHAR.test(texte[debut - 1])) debut--;
    while (fin < texte.length && MOT_CHAR.test(texte[fin])) fin++;

    const mot = texte.slice(debut, fin).replace(/^-+|-+$/g, "");
    if (mot.length < 2) return null;

    return { noeud, debut, fin, mot };
  }

  document.addEventListener("click", (e) => {
    if (!aideActive) return;
    if (bulleAide && bulleAide.contains(e.target)) return;

    // Zones interactives : ne pas interférer (sauf les liens, interceptés pour
    // permettre la consultation sans navigation — même principe que Daspalecte)
    const cible = e.target;
    if (cible.closest("button, input, textarea, select, [contenteditable='true']")) return;

    // ─── Visionneuse PDF : popup + fluo + hover (pas de bulle inline) ───
    if (estVisionneusePdf) {
      gererClicPdf(e, cible);
      return;
    }

    // ─── Traducteur : clic sur une bulle ou un mot déjà traduit → retirer ───
    if (aideActive === "traducteur") {
      const bulle = cible.closest?.(".rnc-traduction");
      if (bulle) {
        // Laisser copier le texte de la bulle si une sélection est en cours
        if (window.getSelection()?.toString().length > 0) return;
        e.preventDefault();
        e.stopPropagation();
        retirerTraduction(bulle.closest(".rnc-mot-traduit"));
        return;
      }
      const motTraduit = cible.closest?.(".rnc-mot-traduit");
      if (motTraduit) {
        e.preventDefault();
        e.stopPropagation();
        retirerTraduction(motTraduit);
        return;
      }
    }

    const trouve = motSousLeClic(e.clientX, e.clientY);
    if (!trouve) {
      supprimerBulleAide();
      return;
    }

    // Empêcher la navigation si le mot est dans un lien
    if (cible.closest("a")) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (aideActive === "dictionnaire") {
      surlignerMot(trouve.noeud, trouve.debut, trouve.fin);
      afficherBulleAide(trouve.mot, e.clientX, e.clientY);
    } else {
      traduireMot(trouve);
    }
  }, true);

  // ─── Traducteur : bulle BD au-dessus du mot (comportement Daspalecte) ───

  let compteurGroupe = 0; // groupes de mots juxtaposés (traduction contextualisée)

  function envelopperMot(info) {
    const wrapper = document.createElement("span");

    const range = document.createRange();
    range.setStart(info.noeud, info.debut);
    range.setEnd(info.noeud, info.fin);
    try {
      range.surroundContents(wrapper);
      return wrapper;
    } catch (err) {
      // Le mot chevauche plusieurs nœuds : envelopper manuellement
      const texte = info.noeud.textContent;
      const avant = document.createTextNode(texte.substring(0, info.debut));
      const apres = document.createTextNode(texte.substring(info.fin));
      wrapper.textContent = texte.substring(info.debut, info.fin);

      const parent = info.noeud.parentNode;
      if (!parent) return null;
      parent.insertBefore(avant, info.noeud);
      parent.insertBefore(wrapper, info.noeud);
      parent.insertBefore(apres, info.noeud);
      parent.removeChild(info.noeud);
      return wrapper;
    }
  }

  // Texte d'un mot enveloppé (sans sa bulle de traduction)
  function texteDuMot(wrapper) {
    for (const n of wrapper.childNodes) {
      if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) return n.textContent.trim();
    }
    return (wrapper.textContent || "").replace(/\n.*/, "").trim();
  }

  // Mots déjà consultés juxtaposés au nouveau mot : même ligne (±20px),
  // écart horizontal < 25px — mêmes seuils que Daspalecte
  function motsJuxtaposes(wrapper, selecteur) {
    const rect = wrapper.getBoundingClientRect();
    const voisins = [];
    document.querySelectorAll(selecteur).forEach((el) => {
      if (el === wrapper) return;
      const r = el.getBoundingClientRect();
      const memeLigne = Math.abs(rect.top - r.top) < 20;
      const ecart = Math.max(0, rect.left - r.right, r.left - rect.right);
      if (memeLigne && ecart < 25) {
        voisins.push(el);
      }
    });
    return voisins;
  }

  // Étend une liste de mots à leurs groupes complets, triée de gauche à droite
  function groupeComplet(wrapper, voisins) {
    const membres = new Set([wrapper, ...voisins]);
    voisins.forEach((v) => {
      const id = v.dataset.rncGroupe;
      if (!id) return;
      document.querySelectorAll(`[data-rnc-groupe="${id}"]`).forEach((el) => membres.add(el));
    });
    return [...membres].sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left
    );
  }

  function traduireMot(info) {
    const wrapper = envelopperMot(info);
    if (!wrapper) return;
    wrapper.classList.add("rnc-mot-traduit");

    // Mots juxtaposés déjà traduits → retraduction contextualisée du groupe
    const voisins = motsJuxtaposes(wrapper, ".rnc-mot-traduit");
    const membres = groupeComplet(wrapper, voisins);
    const phrase = membres.map(texteDuMot).join(" ");

    // Une seule bulle, sur le premier mot du groupe
    membres.forEach((m) => m.querySelector(".rnc-traduction")?.remove());
    const idGroupe = String(++compteurGroupe);
    membres.forEach((m) => { m.dataset.rncGroupe = idGroupe; });

    const bulle = document.createElement("span");
    bulle.className = "rnc-traduction rnc-traduction-chargement";
    bulle.textContent = "⏳";
    membres[0].appendChild(bulle);

    envoyerAvecReponse({ type: "TRADUIRE", texte: phrase, langue: langueTraduction }, (reponse) => {
      if (!bulle.isConnected) return;
      bulle.classList.remove("rnc-traduction-chargement");
      if (reponse?.ok) {
        bulle.textContent = reponse.traduction;
      } else {
        bulle.textContent = "❌";
      }
    });
  }

  function deballerMot(wrapper) {
    // Déwrapper : remettre le texte original dans la page
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }
    parent.removeChild(wrapper);
    parent.normalize();
  }

  function retirerTraduction(wrapper) {
    if (!wrapper || !wrapper.isConnected) return;
    // Retirer tout le groupe si le mot en fait partie
    const id = wrapper.dataset.rncGroupe;
    const membres = id
      ? [...document.querySelectorAll(`[data-rnc-groupe="${id}"]`)]
      : [wrapper];
    membres.forEach((m) => {
      m.querySelector(".rnc-traduction")?.remove();
      deballerMot(m);
    });
  }

  function retirerToutesTraductions() {
    document.querySelectorAll(".rnc-mot-traduit").forEach((w) => retirerTraduction(w));
  }

  // ─── Visionneuse PDF : consultations (fluo persistant + carte au survol) ───

  function gererClicPdf(e, cible) {
    // Re-clic sur un mot consulté → retirer le fluo
    const existant = cible.closest?.(".rnc-mot-consulte");
    if (existant) {
      e.preventDefault();
      e.stopPropagation();
      supprimerBulleAide();
      retirerConsultationPdf(existant);
      return;
    }

    const trouve = motSousLeClic(e.clientX, e.clientY);
    if (!trouve) {
      supprimerBulleAide();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const wrapper = envelopperMot(trouve);
    if (!wrapper) return;
    wrapper.classList.add("rnc-mot-consulte");

    if (aideActive === "traducteur") {
      // Mots juxtaposés déjà traduits → retraduction contextualisée du groupe
      const voisins = motsJuxtaposes(wrapper, ".rnc-mot-consulte").filter(
        (v) => consultationsPdf.get(v)?.type === "traducteur"
      );
      const membres = groupeComplet(wrapper, voisins);
      const phrase = membres.map(texteDuMot).join(" ");
      const idGroupe = String(++compteurGroupe);
      const donnees = { type: "traducteur", mot: phrase, reponse: null };
      membres.forEach((m) => {
        m.dataset.rncGroupe = idGroupe;
        consultationsPdf.set(m, donnees);
      });
      afficherCartePdf(wrapper);
      envoyerAvecReponse({ type: "TRADUIRE", texte: phrase, langue: langueTraduction }, (reponse) => {
        donnees.reponse = reponse;
        mettreAJourCartePdf(wrapper);
      });
      return;
    }

    const donnees = { type: "dictionnaire", mot: trouve.mot, reponse: null };
    consultationsPdf.set(wrapper, donnees);
    afficherCartePdf(wrapper);
    envoyerAvecReponse({ type: "DICT_DEFINITION", mot: trouve.mot }, (reponse) => {
      donnees.reponse = reponse;
      mettreAJourCartePdf(wrapper);
    });
  }

  function afficherCartePdf(wrapper) {
    const donnees = consultationsPdf.get(wrapper);
    if (!donnees) return;
    const rect = wrapper.getBoundingClientRect();
    // Traduction : pas de titre (inutile de répéter le terme d'origine)
    creerBulleAide(donnees.type === "traducteur" ? null : donnees.mot, rect.left, rect.bottom - 8);
    carteWrapperActuel = wrapper;
    remplirCartePdf(donnees);
  }

  function remplirCartePdf(donnees) {
    if (!bulleAide) return;
    const contenu = bulleAide.querySelector(".rnc-aide-contenu");
    if (!contenu) return;

    if (!donnees.reponse) {
      contenu.textContent = donnees.type === "dictionnaire"
        ? "Recherche dans le dictionnaire…"
        : "Traduction…";
      return;
    }

    if (donnees.type === "dictionnaire") {
      remplirDefinitions(contenu, donnees.reponse);
    } else if (donnees.reponse.ok) {
      contenu.textContent = donnees.reponse.traduction;
      contenu.classList.add("rnc-aide-traduction");
    } else {
      contenu.textContent = "Impossible de traduire ce mot.";
    }
  }

  function mettreAJourCartePdf(wrapper) {
    if (carteWrapperActuel !== wrapper || !bulleAide) return;
    const donnees = consultationsPdf.get(wrapper);
    if (donnees) remplirCartePdf(donnees);
  }

  function retirerConsultationPdf(wrapper) {
    if (!wrapper.isConnected) return;
    // Retirer tout le groupe si le mot en fait partie
    const id = wrapper.dataset?.rncGroupe;
    const membres = id
      ? [...document.querySelectorAll(`[data-rnc-groupe="${id}"]`)]
      : [wrapper];
    membres.forEach((m) => {
      consultationsPdf.delete(m);
      if (carteWrapperActuel === m) carteWrapperActuel = null;
      deballerMot(m);
    });
  }

  function retirerToutesConsultationsPdf() {
    document.querySelectorAll(".rnc-mot-consulte").forEach((w) => retirerConsultationPdf(w));
  }

  // Effet hover : survoler un mot fluoré ré-affiche sa carte, sans clic
  if (estVisionneusePdf) {
    document.addEventListener("mouseover", (e) => {
      const wrapper = e.target.closest?.(".rnc-mot-consulte");
      if (!wrapper || !consultationsPdf.has(wrapper)) return;
      if (carteWrapperActuel === wrapper && bulleAide) return;
      afficherCartePdf(wrapper);
    });

    document.addEventListener("mouseout", (e) => {
      const wrapper = e.target.closest?.(".rnc-mot-consulte");
      if (!wrapper) return;
      const vers = e.relatedTarget;
      // Ne pas fermer si on passe sur la carte elle-même ou si on reste sur le mot
      if (vers && (vers.closest?.(".rnc-aide-bulle") || vers.closest?.(".rnc-mot-consulte") === wrapper)) return;
      supprimerBulleAide();
      carteWrapperActuel = null;
    });
  }

  document.addEventListener("mousedown", (e) => {
    if (bulleAide && !bulleAide.contains(e.target)) supprimerBulleAide();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") supprimerBulleAide();
  });

  document.addEventListener("scroll", () => supprimerBulleAide(), { capture: true, passive: true });

  // Crée la carte (titre + zone de contenu) et la positionne dans la fenêtre
  function creerBulleAide(mot, x, y) {
    supprimerBulleAide();

    bulleAide = document.createElement("div");
    bulleAide.className = "rnc-aide-bulle";
    const gauche = Math.max(8, Math.min(x, window.innerWidth - 316));
    const haut = Math.max(8, Math.min(y + 14, window.innerHeight - 120));
    bulleAide.style.left = gauche + "px";
    bulleAide.style.top = haut + "px";

    // mot null/vide → carte sans titre (ex. traduction en PDF)
    if (mot) {
      const titre = document.createElement("div");
      titre.className = "rnc-aide-mot";
      titre.textContent = mot;
      bulleAide.appendChild(titre);
    }

    const contenu = document.createElement("div");
    contenu.className = "rnc-aide-contenu";
    bulleAide.appendChild(contenu);
    document.body.appendChild(bulleAide);
    return contenu;
  }

  function afficherBulleAide(mot, x, y) {
    const contenu = creerBulleAide(mot, x, y);
    contenu.textContent = "Recherche dans le dictionnaire…";

    envoyerAvecReponse({ type: "DICT_DEFINITION", mot }, (reponse) => {
      if (!bulleAide || !bulleAide.contains(contenu)) return;
      remplirDefinitions(contenu, reponse);
    });
  }

  function remplirDefinitions(contenu, reponse) {
    if (!reponse?.ok) {
      contenu.textContent = "Impossible de consulter le dictionnaire.";
      return;
    }
    if (!reponse.definitions || reponse.definitions.length === 0) {
      contenu.textContent = "Le dictionnaire ne connaît pas ce mot. Vérifie son orthographe !";
      return;
    }
    contenu.textContent = "";
    const liste = document.createElement("ol");
    liste.className = "rnc-aide-liste";
    for (const def of reponse.definitions.slice(0, 3)) {
      const item = document.createElement("li");
      item.textContent = def;
      liste.appendChild(item);
    }
    contenu.appendChild(liste);

    const source = document.createElement("div");
    source.className = "rnc-aide-source";
    source.textContent = "Source : Wiktionnaire";
    contenu.appendChild(source);
  }

  function envoyerAvecReponse(msg, callback) {
    if (!chrome.runtime?.id) return;
    try {
      chrome.runtime.sendMessage(msg, (reponse) => {
        if (chrome.runtime.lastError) {
          callback(null);
          return;
        }
        callback(reponse);
      });
    } catch (e) {
      callback(null);
    }
  }

  function supprimerBulleAide() {
    if (bulleAide) {
      bulleAide.remove();
      bulleAide = null;
    }
  }
})();
