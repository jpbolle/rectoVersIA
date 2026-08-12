// Service Worker - Extension NavigKid!

// Le clic sur l'icône ouvre désormais la popup (manifest default_popup) ;
// la sidebar s'ouvre via le bouton de la popup.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

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

// ─── Démarrage d'une recherche depuis l'app Recto-versIA ───
// L'élève clique sur « Commencer ma recherche » dans la page de l'activité ; le
// script de contenu relaie le clic ici. Chrome n'autorise `sidePanel.open()` que
// pendant un geste utilisateur : on l'appelle donc EN PREMIER, sans rien attendre
// avant. Si Chrome refuse malgré tout, on ouvre quand même la page de recherche et
// un bandeau y invite l'élève à cliquer sur l'icône de l'extension.

const URL_RECHERCHE = "https://www.google.com/";

function programmerBandeau(tabId) {
  const surMiseAJour = (id, info) => {
    if (id !== tabId || info.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(surMiseAJour);
    chrome.tabs.sendMessage(tabId, { type: "NAVIGKID_BANDEAU" }).catch(() => {});
  };
  chrome.tabs.onUpdated.addListener(surMiseAJour);
}

function demarrerRecherche(msg, sender, sendResponse) {
  const cible =
    sender.tab?.windowId !== undefined
      ? { windowId: sender.tab.windowId }
      : { tabId: sender.tab?.id };

  let ouverture;
  try {
    ouverture = chrome.sidePanel.open(cible);
  } catch (e) {
    ouverture = Promise.reject(e);
  }

  ouverture.then(
    () => true,
    () => false
  ).then(async (panneauOuvert) => {
    // Mémoriser l'activité à ouvrir : la sidebar la chargera directement
    await chrome.storage.local.set({
      navigkidActiviteADemarrer: msg.questionnaireId || "",
    });
    let tab = null;
    try {
      tab = await chrome.tabs.create({ url: URL_RECHERCHE, active: true });
    } catch (e) { /* onglet non créé : l'élève ouvrira Google lui-même */ }
    if (!panneauOuvert && tab?.id) programmerBandeau(tab.id);
    sendResponse({ ok: true, panneauOuvert });
  });
}

// Répondre aux content scripts qui demandent l'état au chargement
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OUVRIR_RECHERCHE") {
    demarrerRecherche(msg, sender, sendResponse);
    return true; // réponse asynchrone
  }

  if (msg.type === "GET_HIGHLIGHTER_ETAT") {
    chrome.storage.session.get("sidebarOuverte", (result) => {
      sendResponse({ actif: result.sidebarOuverte === true });
    });
    return true; // réponse asynchrone
  }

  // ─── Dictionnaire : définition via Wiktionnaire ───
  if (msg.type === "DICT_DEFINITION") {
    chercherDefinition(msg.mot)
      .then((definitions) => {
        // Mémoriser le mot cliqué : il rejoindra le vocabulaire personnel
        // de l'élève quand la sidebar (connectée) enverra la file à l'app
        memoriserMotClique(msg.mot, definitions);
        sendResponse({ ok: true, definitions });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // ─── Traducteur : Google Translate (endpoint gratuit, même mécanisme que Daspalecte) ───
  if (msg.type === "TRADUIRE") {
    traduire(msg.texte, msg.langue)
      .then((traduction) => sendResponse({ ok: true, traduction }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

// ═══════════════════════════════════════════════
// ─── Dictionnaire Wiktionnaire ─────────────────
// (parsing repris de l'app Recto-versIA : /api/dictionary)
// ═══════════════════════════════════════════════

// Cache en mémoire du service worker (vidé quand le worker s'endort — suffisant)
const dictCache = new Map();

function nettoyerWikitext(ligne) {
  let texte = ligne;
  texte = texte.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  texte = texte.replace(/<ref[^>]*\/>/g, "");
  texte = texte.replace(/<[^>]+>/g, "");
  texte = texte.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2");
  texte = texte.replace(/\[\[([^\]]*)\]\]/g, "$1");
  texte = texte.replace(/\{\{lien\|([^}|]*)[^}]*\}\}/g, "$1");
  texte = texte.replace(/\{\{w\|([^}|]*)[^}]*\}\}/g, "$1");
  texte = texte.replace(/\{\{([^}|]+)\|fr[^}]*\}\}/g, (_m, label) => {
    const propre = label.trim();
    if (["S", "pron", "exemple", "source", "R"].includes(propre)) return "";
    return `(${propre.charAt(0).toUpperCase()}${propre.slice(1)})`;
  });
  texte = texte.replace(/\{\{[^}]*\}\}/g, "");
  texte = texte.replace(/'''/g, "").replace(/''/g, "");
  return texte.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

function extraireSectionFrancais(wikitext) {
  const debut = wikitext.search(/==\s*\{\{langue\|fr\}\}\s*==/);
  if (debut === -1) return null;
  const reste = wikitext.slice(debut);
  const suivant = reste.slice(2).search(/\n==\s*\{\{langue\|/);
  return suivant === -1 ? reste : reste.slice(0, suivant + 2);
}

function extraireDefinitions(sectionFr) {
  const definitions = [];
  for (const ligne of sectionFr.split("\n")) {
    if (/^#\s/.test(ligne)) {
      const propre = nettoyerWikitext(ligne.replace(/^#\s*/, ""));
      if (propre.length > 1) definitions.push(propre);
    }
    if (definitions.length >= 5) break;
  }
  return definitions;
}

const FLEXION_PATTERN =
  /\b(personne du (singulier|pluriel)|participe (passé|présent)|pluriel de|féminin (singulier |pluriel )?de|masculin (singulier |pluriel )?de|forme conjuguée|variante de)\b/i;

function detecterLemme(definitions, mot) {
  const premiere = definitions[0];
  if (!premiere || !FLEXION_PATTERN.test(premiere)) return null;
  const match = premiere.match(/\b(?:du verbe|de|d['’])\s*([\p{L}\p{M}-]+)\s*\.?\s*$/u);
  if (!match) return null;
  const lemme = match[1].toLowerCase();
  return lemme !== mot ? lemme : null;
}

async function fetchWiktionnaire(mot) {
  const url =
    "https://fr.wiktionary.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=" +
    encodeURIComponent(mot);
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.error || !json.parse?.wikitext) return null;
  return json.parse.wikitext;
}

async function chercherDefinition(mot) {
  const propre = (mot || "").trim().toLowerCase();
  if (!propre || propre.length > 50) return [];

  const enCache = dictCache.get(propre);
  if (enCache) return enCache;

  const wikitext = await fetchWiktionnaire(propre);
  const sectionFr = wikitext ? extraireSectionFrancais(wikitext) : null;
  if (!sectionFr) {
    dictCache.set(propre, []);
    return [];
  }

  let definitions = extraireDefinitions(sectionFr);

  // Flexion (« … de ressentir. ») → compléter avec le mot de base
  const lemme = detecterLemme(definitions, propre);
  if (lemme) {
    const lemmeWikitext = await fetchWiktionnaire(lemme);
    const lemmeFr = lemmeWikitext ? extraireSectionFrancais(lemmeWikitext) : null;
    if (lemmeFr) {
      const defsLemme = extraireDefinitions(lemmeFr).map((d) => `${lemme} : ${d}`);
      definitions = [...definitions.slice(0, 1), ...defsLemme].slice(0, 5);
    }
  }

  dictCache.set(propre, definitions);
  return definitions;
}

// File d'attente des mots cliqués (vidée par la sidebar quand l'élève est connecté)
async function memoriserMotClique(mot, definitions) {
  try {
    if (!definitions || definitions.length === 0) return;
    const propre = (mot || "").trim().toLowerCase();
    if (!propre) return;
    const { motsDictionnaireEnAttente = [] } = await chrome.storage.local.get(
      "motsDictionnaireEnAttente"
    );
    if (motsDictionnaireEnAttente.some((m) => m.word === propre)) return;
    motsDictionnaireEnAttente.push({ word: propre, definition: definitions[0] || "" });
    await chrome.storage.local.set({ motsDictionnaireEnAttente });
  } catch (e) {
    // Le suivi ne doit jamais faire échouer la consultation
  }
}

// ═══════════════════════════════════════════════
// ─── Traduction ────────────────────────────────
// ═══════════════════════════════════════════════

async function traduire(texte, langue) {
  // sl=auto : détection automatique de la langue de la page (article anglais → français, etc.)
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langue}&dt=t&q=${encodeURIComponent(texte)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data[0] && data[0][0] && data[0][0][0]) {
    return data[0][0][0];
  }
  throw new Error("Réponse invalide");
}
