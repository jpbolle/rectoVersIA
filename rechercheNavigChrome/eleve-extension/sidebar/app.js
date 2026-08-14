// App Sidebar - Extension Élève (v2 — Google OAuth + liste activités)

// ─── Configuration ───
const OAUTH_CLIENT_ID = "380560298164-d78g8d3evlmj3g8q5sdu1d1cpchc4oii.apps.googleusercontent.com";
const API_BASE = "https://rectoversia.edukids.pedagokit.be";
// En dev, décommenter la ligne suivante (npm run dev écoute sur le port 3003) :
// const API_BASE = "http://localhost:3003";

// ─── Appel API authentifié (toutes les données passent par le serveur — RGPD) ───
async function apiFetch(path, options = {}) {
  const token = await state.user.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

const firebaseConfig = {
  apiKey: "AIzaSyClDztrPakII3I4P4CmwYpOY9wYYWo3qNg",
  authDomain: "recto-versia.firebaseapp.com",
  projectId: "recto-versia",
  storageBucket: "recto-versia.firebasestorage.app",
  messagingSenderId: "380560298164",
  appId: "1:380560298164:web:776ac81a5377ee9d5447e1",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Signaler au background que la sidebar est ouverte
chrome.runtime.connect({ name: "sidebar" });

// Activer directement le surlignage sur le tab actif (robuste aux redémarrages service worker)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, { type: "HIGHLIGHTER_ETAT", actif: true }).catch(() => {});
  }
});

// ─── État de l'application ───
const state = {
  user: null,
  eleveNom: "",
  eleveId: "",
  activites: [],
  activiteEnCours: null, // { id, questionnaireId, accesIA, ... }
  questionnaire: null,
  questionnaireId: "",
  questionCourante: 0,
  questions: [],
  feedbackIA: null // { motsCles: {...}, questions: [...] }
};

// ─── Persistance locale ───
function sauvegarderLocal() {
  chrome.storage.local.set({
    eleveId: state.eleveId,
    eleveNom: state.eleveNom,
    questionnaireId: state.questionnaireId,
    questionCourante: state.questionCourante,
    questionsData: state.questions
  });
}

// ─── Éléments DOM ───
const $ = (sel) => document.querySelector(sel);
const ecranAuth = $("#ecran-auth");
const ecranActivites = $("#ecran-activites");
const ecranQuestionnaire = $("#ecran-questionnaire");

// ─── Auth Google OAuth ───
$("#btn-google-login").addEventListener("click", async () => {
  $("#erreur-auth").hidden = true;
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", OAUTH_CLIENT_ID);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("scope", "openid email profile");

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    const params = new URLSearchParams(new URL(responseUrl).hash.substring(1));
    const accessToken = params.get("access_token");

    if (!accessToken) throw new Error("Pas de token reçu");

    const credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
    await auth.signInWithCredential(credential);
  } catch (err) {
    console.error("Erreur Google OAuth:", err);
    let msg = "Erreur de connexion Google.";
    if (err.message?.includes("canceled") || err.message?.includes("closed")) {
      msg = "Connexion annulée.";
    }
    $("#erreur-auth").textContent = msg;
    $("#erreur-auth").hidden = false;
  }
});

// ─── Déconnexion ───
$("#btn-deconnexion").addEventListener("click", async () => {
  await auth.signOut();
  chrome.storage.local.clear();
});

// ─── Vocabulaire personnel ───
// Envoyer à l'app les mots cliqués via l'aide dictionnaire (file remplie par
// le background) — ils rejoignent vocabulairePersonnel/{uid} côté Firestore.
async function envoyerMotsDictionnaire() {
  if (!state.user) return;
  try {
    const { motsDictionnaireEnAttente = [] } = await chrome.storage.local.get(
      "motsDictionnaireEnAttente"
    );
    if (motsDictionnaireEnAttente.length === 0) return;

    const token = await state.user.getIdToken();
    const res = await fetch(`${API_BASE}/api/vocabulaire/personnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ words: motsDictionnaireEnAttente }),
    });
    const json = await res.json();
    if (json.success) {
      await chrome.storage.local.set({ motsDictionnaireEnAttente: [] });
    }
  } catch (e) {
    console.error("Envoi vocabulaire personnel:", e);
  }
}

// Vider la file dès qu'un nouveau mot arrive pendant que la sidebar est ouverte
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.motsDictionnaireEnAttente?.newValue?.length) {
    envoyerMotsDictionnaire();
  }
});

// ─── Listener Auth State ───
auth.onAuthStateChanged(async (user) => {
  if (user) {
    state.user = user;
    state.eleveId = user.uid;
    state.eleveNom = user.displayName || user.email;

    // Envoyer les mots cliqués en attente (aide dictionnaire)
    envoyerMotsDictionnaire();

    // Tenter de restaurer une session en cours
    await restaurerSession();
  } else {
    state.user = null;
    state.eleveId = "";
    state.eleveNom = "";
    state.activites = [];
    afficherEcranAuth();
  }
});

async function restaurerSession() {
  try {
    const stored = await chrome.storage.local.get([
      "questionnaireId", "questionCourante", "questionsData"
    ]);

    if (stored.questionnaireId) {
      const json = await apiFetch(`/api/navigkid/questionnaire?id=${encodeURIComponent(stored.questionnaireId)}`);
      if (json.success && json.data) {
        state.questionnaire = json.data;
        state.questionnaireId = stored.questionnaireId;
        state.questionCourante = stored.questionCourante || 0;
        state.questions = stored.questionsData || [];

        if (state.questions.length !== state.questionnaire.questions.length) {
          state.questions = state.questionnaire.questions.map((_, index) => ({
            questionIndex: index,
            reponse: "",
            motsCles: [],
            sitesConsultes: [],
            passages: []
          }));
        }

        afficherQuestionnaireRestaure();
        return;
      }
    }
  } catch (err) {
    console.error("Erreur restauration session:", err);
  }
  afficherEcranActivites();
}

// ─── Écrans ───

function afficherEcranAuth() {
  ecranAuth.hidden = false;
  ecranActivites.hidden = true;
  ecranQuestionnaire.hidden = true;
}

async function afficherEcranActivites() {
  ecranAuth.hidden = true;
  ecranActivites.hidden = false;
  ecranQuestionnaire.hidden = true;
  $("#user-nom").textContent = state.eleveNom;

  await chargerActivites();
}

// ─── Onglets Actif / Archivé ───
document.querySelectorAll(".activites-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".activites-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    $("#liste-activites-actif").hidden = target !== "actif";
    $("#liste-activites-archive").hidden = target !== "archive";
  });
});

// ─── Charger les activités depuis l'API ───
async function chargerActivites() {
  $("#activites-loading").hidden = false;
  $("#activites-vide").hidden = true;
  $("#erreur-activites").hidden = true;
  $("#liste-activites-actif").innerHTML = "";
  $("#liste-activites-archive").innerHTML = "";

  try {
    const token = await state.user.getIdToken();
    const res = await fetch(`${API_BASE}/api/navigkid/activites-eleve`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();

    if (!json.success || !json.data) {
      throw new Error(json.message || "Erreur serveur");
    }

    state.activites = json.data;
    $("#activites-loading").hidden = true;

    const actives = state.activites.filter((a) => !a.corrige);
    const archives = state.activites.filter((a) => a.corrige);

    if (actives.length === 0 && archives.length === 0) {
      $("#activites-vide").hidden = false;
      return;
    }

    actives.forEach((a) => afficherCarteActivite(a, "#liste-activites-actif"));
    archives.forEach((a) => afficherCarteActivite(a, "#liste-activites-archive"));

    // L'élève a lancé la recherche depuis l'app : ouvrir directement son activité
    ouvrirActiviteDemandee();

    if (archives.length === 0) {
      $("#liste-activites-archive").innerHTML = '<p class="aide-description" style="text-align:center;padding:20px 0;">Aucune activité corrigée.</p>';
    }
  } catch (err) {
    console.error("Erreur chargement activites:", err);
    $("#activites-loading").hidden = true;
    $("#erreur-activites").textContent = "Impossible de charger les activités. Vérifie ta connexion.";
    $("#erreur-activites").hidden = false;
  }
}

// ─── Ouverture directe demandée par l'app Recto-versIA ───
// Le bouton « Commencer ma recherche » de la page activité dépose l'identifiant du
// questionnaire dans le storage ; on l'ouvre dès que la liste est chargée.
async function ouvrirActiviteDemandee() {
  try {
    const { navigkidActiviteADemarrer } = await chrome.storage.local.get(
      "navigkidActiviteADemarrer"
    );
    if (!navigkidActiviteADemarrer) return;
    await chrome.storage.local.remove("navigkidActiviteADemarrer");
    const activite = state.activites.find(
      (a) => a.questionnaireId === navigkidActiviteADemarrer
    );
    if (activite) ouvrirActivite(activite);
  } catch (e) {
    // Sans le raccourci, l'élève choisit son activité dans la liste
  }
}

// Le panneau peut s'ouvrir avant que l'identifiant soit déposé (course entre
// l'ouverture du panneau et l'écriture dans le storage) : on réessaie au changement.
chrome.storage.onChanged.addListener((changements, zone) => {
  if (zone !== "local" || !changements.navigkidActiviteADemarrer) return;
  if (!changements.navigkidActiviteADemarrer.newValue) return;
  if (state.activites.length === 0) return;
  ouvrirActiviteDemandee();
});

function afficherCarteActivite(activite, containerSel) {
  const container = $(containerSel);
  const div = document.createElement("div");
  div.className = "activite-card";
  if (activite.soumis) div.classList.add("activite-soumise");

  const dateStr = activite.dateRemise
    ? new Date(activite.dateRemise).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })
    : "";

  div.innerHTML = `
    <div class="activite-card-header">
      <span class="activite-card-titre">${activite.intitule}</span>
      ${activite.soumis ? '<span class="activite-badge-soumis">✓ Envoyé</span>' : ""}
    </div>
    <div class="activite-card-meta">
      ${dateStr ? `<span class="activite-card-date">📅 ${dateStr}</span>` : ""}
      <span class="activite-card-grille">${activite.grille}</span>
    </div>
  `;

  div.addEventListener("click", () => ouvrirActivite(activite));
  container.appendChild(div);
}

// ─── Ouvrir une activité → charger le questionnaire ───
async function ouvrirActivite(activite) {
  if (!activite.questionnaireId) {
    alert("Cette activité n'a pas de questionnaire associé.");
    return;
  }

  state.activiteEnCours = activite;

  try {
    const json = await apiFetch(`/api/navigkid/questionnaire?id=${encodeURIComponent(activite.questionnaireId)}`);
    if (!json.success || !json.data) {
      alert("Questionnaire introuvable.");
      return;
    }

    state.questionnaire = json.data;
    state.questionnaireId = activite.questionnaireId;

    // Si déjà soumis, recharger les réponses
    if (activite.soumis) {
      const repJson = await apiFetch(
        `/api/navigkid/reponse?questionnaireId=${encodeURIComponent(activite.questionnaireId)}`
      );

      if (repJson.success && repJson.data?.questions?.length) {
        state.questions = repJson.data.questions;
        state.questionCourante = 0;
        sauvegarderLocal();
        afficherQuestionnaireRestaure();
        // Désactiver la soumission si déjà envoyé
        const btn = $("#btn-soumettre");
        btn.disabled = true;
        btn.textContent = "Déjà envoyé ✓";
        afficherRetourApp();
        return;
      }
    }

    afficherQuestionnaire();
  } catch (err) {
    console.error("Erreur ouverture activite:", err);
    alert("Erreur lors du chargement de l'activité.");
  }
}

// ─── Retour à la liste des activités ───
$("#btn-retour-activites").addEventListener("click", () => {
  state.questionnaire = null;
  state.questionnaireId = "";
  state.questionCourante = 0;
  state.questions = [];
  state.activiteEnCours = null;
  chrome.storage.local.remove(["questionnaireId", "questionCourante", "questionsData"]);
  afficherEcranActivites();
});

// ─── Affichage du questionnaire (nouveau) ───
function afficherQuestionnaire() {
  state.questionCourante = 0;
  state.questions = state.questionnaire.questions.map((_, index) => ({
    questionIndex: index,
    reponse: "",
    motsCles: [],
    sitesConsultes: [],
    passages: []
  }));

  sauvegarderLocal();
  afficherQuestionnaireRestaure();
}

// ─── Affichage du questionnaire (restauré ou nouveau) ───
function afficherQuestionnaireRestaure() {
  ecranAuth.hidden = true;
  ecranActivites.hidden = true;
  ecranQuestionnaire.hidden = false;

  $("#user-nom-q").textContent = state.eleveNom;

  const q = state.questionnaire;
  $("#titre-questionnaire").textContent = q.titre;
  $("#theme-questionnaire").textContent = q.theme;
  $("#texte-consignes").textContent = q.consignes || "Aucune consigne spécifique.";

  // Réinitialiser le bouton soumettre
  const btn = $("#btn-soumettre");
  btn.disabled = false;
  btn.textContent = "Envoyer mes réponses";
  $("#message-soumission").hidden = true;
  $("#btn-retour-app").hidden = true;

  // Reset feedback IA
  state.feedbackIA = null;

  // Aide IA — afficher uniquement si activé par le prof
  const aideIaSection = $("#aide-ia-section");
  if (state.activiteEnCours?.accesIA) {
    aideIaSection.hidden = false;
    $("#aide-ia-resultat").hidden = true;
    $("#aide-ia-loading").hidden = true;
  } else {
    aideIaSection.hidden = true;
  }

  afficherQuestionCourante();
}

// ─── Navigation entre questions ───

function allerAQuestion(index) {
  sauvegarderReponseCourante();
  state.questionCourante = index;
  sauvegarderLocal();
  afficherQuestionCourante();
}

function sauvegarderReponseCourante() {
  if (!state.questionnaire) return;
  const idx = state.questionCourante;
  const question = state.questionnaire.questions[idx];

  if (question.type === "qcm" && question.options) {
    const checked = document.querySelector(`#question-reponse input[name="qcm"]:checked`);
    if (checked) {
      state.questions[idx].reponse = question.options[parseInt(checked.value)];
    }
  } else {
    const textarea = document.querySelector("#question-reponse textarea");
    if (textarea) {
      state.questions[idx].reponse = textarea.value;
    }
  }
  sauvegarderLocal();
}

function afficherQuestionCourante() {
  const idx = state.questionCourante;
  const total = state.questionnaire.questions.length;
  const question = state.questionnaire.questions[idx];
  const qData = state.questions[idx];

  // Compteur
  $("#question-compteur").textContent = `Question ${idx + 1} / ${total}`;

  // Boutons navigation
  $("#btn-prev").disabled = idx === 0;
  $("#btn-next").disabled = idx === total - 1;
  $("#btn-prev-bas").disabled = idx === 0;
  $("#btn-next-bas").disabled = idx === total - 1;

  // Énoncé de la question (haut)
  const texteZone = $("#question-texte-zone");
  texteZone.innerHTML = `<p class="question-texte"><span class="question-numero">${idx + 1}.</span> ${question.texte}</p>`;

  // Zone réponse (bas)
  const reponseZone = $("#question-reponse");

  if (question.type === "qcm" && question.options) {
    reponseZone.innerHTML = `
      <div class="qcm-options">
        ${question.options.map((opt, i) => {
          const selected = qData.reponse === opt;
          return `
            <label class="qcm-option${selected ? " selected" : ""}">
              <input type="radio" name="qcm" value="${i}"${selected ? " checked" : ""}>
              <span>${opt}</span>
            </label>
          `;
        }).join("")}
      </div>
    `;
    reponseZone.querySelectorAll("input[type=radio]").forEach((radio) => {
      radio.addEventListener("change", () => {
        state.questions[idx].reponse = question.options[parseInt(radio.value)];
        reponseZone.querySelectorAll(".qcm-option").forEach((o) => o.classList.remove("selected"));
        radio.closest(".qcm-option").classList.add("selected");
        sauvegarderLocal();
      });
    });
  } else {
    reponseZone.innerHTML = `<textarea placeholder="Ta réponse...">${qData.reponse || ""}</textarea>`;
    reponseZone.querySelector("textarea").addEventListener("input", (e) => {
      state.questions[idx].reponse = e.target.value;
      sauvegarderLocal();
    });
  }

  // Mots-clés
  afficherMotsCles(qData);

  // Sites
  afficherSites(qData);

  // Passages soulignés
  afficherPassages(qData);

  // Feedback IA par question
  const feedbackZone = $("#question-ia-feedback");
  if (state.feedbackIA && state.feedbackIA.questions) {
    const qFeedback = state.feedbackIA.questions.find((q) => q.numero === idx + 1);
    if (qFeedback) {
      feedbackZone.innerHTML = renderFeedbackQuestion(qFeedback);
      feedbackZone.hidden = false;
    } else {
      feedbackZone.hidden = true;
    }
  } else {
    feedbackZone.hidden = true;
  }

  // Dots
  afficherDots();
}

function afficherMotsCles(qData) {
  const container = $("#liste-mots-cles");
  const aucun = $("#aucun-mot-cle");

  container.innerHTML = "";

  if (qData.motsCles.length === 0) {
    aucun.hidden = false;
    return;
  }
  aucun.hidden = true;

  qData.motsCles.forEach((mc) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = mc.texte;
    container.appendChild(span);
  });
}

function afficherSites(qData) {
  const container = $("#liste-sites");
  const compteur = $("#compteur-sites");
  const aucun = $("#aucun-site");

  container.innerHTML = "";
  compteur.textContent = qData.sitesConsultes.length;

  if (qData.sitesConsultes.length === 0) {
    aucun.hidden = false;
    return;
  }
  aucun.hidden = true;

  qData.sitesConsultes.forEach((site, siteIndex) => {
    const div = document.createElement("div");
    div.className = "site-item";
    div.innerHTML = `
      <div class="site-header">
        <span class="site-titre">${site.titre}</span>
        <span class="site-url">${site.url}</span>
      </div>
      <div class="site-controles">
        <div class="site-controle-groupe">
          <span class="site-controle-label">Pertinent</span>
          <input type="checkbox" class="pertinence-check" data-site="${siteIndex}"${site.pertinence ? " checked" : ""}>
        </div>
        <div class="site-controle-groupe">
          <span class="site-controle-label">Fiabilité</span>
          <div class="fiabilite-btns">
            <span class="fiabilite-label">1</span>
            ${[1, 2, 3, 4, 5].map((n) => `
              <button class="fiabilite-btn${site.fiabilite >= n ? " active" : ""}" data-site="${siteIndex}" data-val="${n}"></button>
            `).join("")}
            <span class="fiabilite-label">5</span>
          </div>
        </div>
        ${site.tempsPasse > 0 ? `
          <span class="temps-badge">${formatTemps(site.tempsPasse)}</span>
        ` : ""}
      </div>
    `;

    div.querySelector(".pertinence-check").addEventListener("change", (e) => {
      qData.sitesConsultes[siteIndex].pertinence = e.target.checked;
      sauvegarderLocal();
    });

    div.querySelectorAll(".fiabilite-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.val);
        qData.sitesConsultes[siteIndex].fiabilite = val;
        div.querySelectorAll(".fiabilite-btn").forEach((b) => {
          b.classList.toggle("active", parseInt(b.dataset.val) <= val);
        });
        sauvegarderLocal();
      });
    });

    container.appendChild(div);
  });
}

function formatTemps(ms) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const resteSec = sec % 60;
  return `${min}m${resteSec > 0 ? resteSec + "s" : ""}`;
}

function afficherDots() {
  const container = $("#question-dots");
  container.innerHTML = "";

  state.questions.forEach((qData, i) => {
    const dot = document.createElement("button");
    dot.className = "dot";
    if (i === state.questionCourante) dot.classList.add("active");
    if (qData.reponse) dot.classList.add("answered");
    dot.addEventListener("click", () => allerAQuestion(i));
    container.appendChild(dot);
  });
}

function afficherPassages(qData) {
  const container = $("#liste-passages");
  const compteur = $("#compteur-passages");
  const aucun = $("#aucun-passage");

  const passages = qData.passages || [];
  container.innerHTML = "";
  compteur.textContent = passages.length;

  if (passages.length === 0) {
    aucun.hidden = false;
    return;
  }
  aucun.hidden = true;

  passages.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "passage-item";
    div.innerHTML = `
      <div class="passage-couleur" style="background: ${p.couleur}"></div>
      <div class="passage-contenu">
        <div class="passage-texte">${p.texte}</div>
        <div class="passage-url">${new URL(p.url).hostname}</div>
      </div>
      <button class="passage-suppr" data-idx="${i}" title="Supprimer">&times;</button>
    `;

    div.querySelector(".passage-suppr").addEventListener("click", () => {
      qData.passages.splice(i, 1);
      afficherPassages(qData);
      sauvegarderLocal();
    });

    container.appendChild(div);
  });
}

// ─── Event listeners navigation ───
$("#btn-prev").addEventListener("click", () => {
  if (state.questionCourante > 0) allerAQuestion(state.questionCourante - 1);
});
$("#btn-next").addEventListener("click", () => {
  if (state.questionCourante < state.questionnaire.questions.length - 1) allerAQuestion(state.questionCourante + 1);
});
$("#btn-prev-bas").addEventListener("click", () => {
  if (state.questionCourante > 0) allerAQuestion(state.questionCourante - 1);
});
$("#btn-next-bas").addEventListener("click", () => {
  if (state.questionCourante < state.questionnaire.questions.length - 1) allerAQuestion(state.questionCourante + 1);
});

// ─── Réception des messages depuis le content script ───
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LIEN_COLLECTE") {
    ajouterLien(message.data);
  }
  if (message.type === "REQUETE_RECHERCHE") {
    ajouterMotCle(message.data);
  }
  if (message.type === "TEMPS_PAGE") {
    handleTempsPage(message.data);
  }
  if (message.type === "PASSAGE_SURLIGNE") {
    ajouterPassage(message.data);
  }
});

function ajouterLien(data) {
  const idx = state.questionCourante;
  const qData = state.questions[idx];
  if (!qData) return;

  if (qData.sitesConsultes.some((s) => s.url === data.url)) return;

  qData.sitesConsultes.push({
    url: data.url,
    titre: data.titre,
    timestamp: data.timestamp,
    pertinence: false,
    fiabilite: 0,
    tempsPasse: 0
  });

  if (state.questionCourante === idx) {
    afficherSites(qData);
  }

  sauvegarderLocal();
  sauvegarderRecherches();
}

function ajouterMotCle(data) {
  const idx = state.questionCourante;
  const qData = state.questions[idx];
  if (!qData) return;

  if (qData.motsCles.some((mc) => mc.texte === data.texte)) return;

  qData.motsCles.push({ texte: data.texte, timestamp: data.timestamp });

  if (state.questionCourante === idx) {
    afficherMotsCles(qData);
  }

  sauvegarderLocal();
  sauvegarderRecherches();
}

function handleTempsPage(data) {
  let changed = false;
  state.questions.forEach((qData) => {
    qData.sitesConsultes.forEach((site) => {
      if (site.url === data.url) {
        site.tempsPasse += data.tempsPasse;
        changed = true;
      }
    });
  });

  if (changed) {
    sauvegarderLocal();

    const currentQ = state.questions[state.questionCourante];
    if (currentQ && currentQ.sitesConsultes.some((s) => s.url === data.url)) {
      afficherSites(currentQ);
    }
  }
}

function ajouterPassage(data) {
  const idx = state.questionCourante;
  const qData = state.questions[idx];
  if (!qData) return;

  if (!qData.passages) qData.passages = [];

  qData.passages.push({
    texte: data.texte,
    couleur: data.couleur,
    url: data.url,
    timestamp: data.timestamp
  });

  if (state.questionCourante === idx) {
    afficherPassages(qData);
  }

  sauvegarderLocal();
}

// ─── Sauvegarde des recherches (via l'API — le serveur chiffre l'identité) ───
async function sauvegarderRecherches() {
  if (!state.eleveId) return;
  try {
    const parQuestion = state.questions.map((qData) => ({
      questionIndex: qData.questionIndex,
      requetes: qData.motsCles,
      clics: qData.sitesConsultes.map((s) => ({
        url: s.url, titre: s.titre, timestamp: s.timestamp, tempsPasse: s.tempsPasse
      }))
    }));

    await apiFetch("/api/navigkid/recherches", {
      method: "POST",
      body: JSON.stringify({
        eleveNom: state.eleveNom,
        questionnaireId: state.questionnaireId,
        parQuestion
      })
    });
  } catch (err) {
    console.error("Erreur sauvegarde recherches:", err);
  }
}

// ─── Retour à l'app une fois les réponses envoyées ───
// L'activité n'est plus voilée côté app : l'élève y retrouve ses réponses et,
// quand le prof l'aura rendue, sa correction.
function afficherRetourApp() {
  const btn = $("#btn-retour-app");
  if (!btn) return;
  btn.hidden = false;
}

$("#btn-retour-app")?.addEventListener("click", () => {
  const devoirId = state.activiteEnCours?.id;
  const url = devoirId ? `${API_BASE}/activites/${devoirId}` : `${API_BASE}/activites`;
  chrome.tabs.create({ url });
});

// ─── Soumission des réponses ───
$("#btn-soumettre").addEventListener("click", async () => {
  sauvegarderReponseCourante();

  const btn = $("#btn-soumettre");
  const msg = $("#message-soumission");

  const premiereManquante = state.questions.findIndex((q) => !q.reponse || !q.reponse.trim());
  if (premiereManquante !== -1) {
    const manquantes = state.questions.filter((q) => !q.reponse || !q.reponse.trim()).length;
    msg.textContent = `Il reste ${manquantes} question(s) sans réponse.`;
    msg.className = "erreur";
    msg.hidden = false;
    allerAQuestion(premiereManquante);
    btn.disabled = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Envoi en cours...";

  try {
    const json = await apiFetch("/api/navigkid/reponse", {
      method: "POST",
      body: JSON.stringify({
        questionnaireId: state.questionnaireId,
        eleveNom: state.eleveNom,
        questions: state.questions.map((qData) => ({
          questionIndex: qData.questionIndex,
          reponse: qData.reponse,
          motsCles: qData.motsCles,
          sitesConsultes: qData.sitesConsultes,
          passages: qData.passages || []
        }))
      })
    });
    if (!json.success) throw new Error(json.message || "Échec de l'envoi");

    await sauvegarderRecherches();

    msg.textContent = "Réponses envoyées avec succès !";
    msg.className = "succes";
    msg.hidden = false;
    btn.textContent = "Envoyé ✓";
    afficherRetourApp();
  } catch (err) {
    console.error("Erreur soumission:", err);
    msg.textContent = "Erreur lors de l'envoi. Réessaie.";
    msg.className = "erreur";
    msg.hidden = false;
    btn.disabled = false;
    btn.textContent = "Envoyer mes réponses";
  }
});

// ─── Aide IA ───
$("#btn-aide-ia").addEventListener("click", async () => {
  if (!state.questionnaireId) return;

  sauvegarderReponseCourante();

  const btn = $("#btn-aide-ia");
  const loading = $("#aide-ia-loading");
  const resultat = $("#aide-ia-resultat");

  btn.disabled = true;
  loading.hidden = false;
  resultat.hidden = true;
  $("#question-ia-feedback").hidden = true;

  try {
    const token = await state.user.getIdToken();
    const res = await fetch(`${API_BASE}/api/navigkid/aide-ia`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      // Envoyer les données courantes directement (pas besoin que l'élève ait soumis)
      body: JSON.stringify({
        questionnaireId: state.questionnaireId,
        questionsData: state.questions
      })
    });

    const json = await res.json();
    loading.hidden = true;

    if (!res.ok || !json.feedback) {
      resultat.innerHTML = `<p class="erreur">${json.error || "Erreur lors de l'analyse."}</p>`;
      resultat.hidden = false;
      btn.disabled = false;
      return;
    }

    // Stocker le feedback et distribuer par question
    state.feedbackIA = json.feedback;

    // Afficher le feedback mots-clés global dans la section IA
    if (json.feedback.motsCles) {
      resultat.innerHTML = renderFeedbackMotsCles(json.feedback.motsCles);
      resultat.hidden = false;
    }

    // Afficher le feedback de la question courante inline
    afficherQuestionCourante();

    btn.disabled = false;
  } catch (err) {
    console.error("Erreur aide IA:", err);
    loading.hidden = true;
    resultat.innerHTML = '<p class="erreur">Erreur réseau. Réessaie.</p>';
    resultat.hidden = false;
    btn.disabled = false;
  }
});

function renderFeedbackMotsCles(motsCles) {
  const verdictClass = motsCles.verdict === "bon" ? "verdict-bon" : motsCles.verdict === "moyen" ? "verdict-moyen" : "verdict-insuffisant";
  return `
    <div class="ia-section">
      <h4 class="ia-section-titre">🔎 Mots-clés de recherche <span class="ia-verdict ${verdictClass}">${motsCles.verdict}</span></h4>
      <p class="ia-feedback">${motsCles.feedback}</p>
      <p class="ia-feedback" style="font-size:0.8em;opacity:0.7;margin-top:6px;">⬆ Navigue entre les questions pour voir le feedback de chacune.</p>
    </div>
  `;
}

function renderFeedbackQuestion(q) {
  return `
    <div class="ia-section ia-section-question">
      <h4 class="ia-section-titre">🤖 Analyse IA — Question ${q.numero}</h4>
      ${q.sources ? `
        <div class="ia-subsection">
          <span class="ia-label">📌 Sources :</span>
          <p class="ia-feedback">${q.sources.pertinence}</p>
          <p class="ia-feedback">${q.sources.fiabilite}</p>
        </div>
      ` : ""}
      ${q.passages ? `
        <div class="ia-subsection">
          <span class="ia-label">✏️ Passages :</span>
          <p class="ia-feedback">${q.passages}</p>
        </div>
      ` : ""}
      ${q.reponse ? `
        <div class="ia-subsection">
          <span class="ia-label">✍️ Réponse :</span>
          <p class="ia-feedback">${q.reponse}</p>
        </div>
      ` : ""}
      ${q.conseil ? `
        <div class="ia-conseil">💡 ${q.conseil}</div>
      ` : ""}
    </div>
  `;
}
