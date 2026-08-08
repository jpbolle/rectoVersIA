// Visionneuse PDF NavigKid! — portée depuis Daspalecte, allégée :
// rendu pdf.js + couche de texte cliquable (dictionnaire / traducteur via content/index.js).
// Pas d'outils de compréhension ni d'exercices ici.

import * as pdfjsLib from '../lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');

const state = {
  pdf: null,
  currentScale: 1.5,
  renderedPages: new Set(),
};

const container = document.getElementById('pdf-container');
const prevBtn = document.getElementById('pdf-prev');
const nextBtn = document.getElementById('pdf-next');
const pageInput = document.getElementById('pdf-page-input');
const pageCount = document.getElementById('pdf-page-count');
const zoomIn = document.getElementById('pdf-zoom-in');
const zoomOut = document.getElementById('pdf-zoom-out');
const zoomFit = document.getElementById('pdf-zoom-fit');
const zoomLevel = document.getElementById('pdf-zoom-level');
const scannedWarning = document.getElementById('pdf-scanned-warning');

function getPdfUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('url');
}

function showLoading() {
  const loader = document.createElement('div');
  loader.id = 'pdf-loading';
  loader.innerHTML = '<div class="spinner"></div><div>Chargement du PDF…</div>';
  document.body.appendChild(loader);
}

function hideLoading() {
  document.getElementById('pdf-loading')?.remove();
}

async function renderPage(pageNum) {
  if (state.renderedPages.has(pageNum)) return;

  const page = await state.pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: state.currentScale });

  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-page-wrapper';
  wrapper.dataset.pageNum = pageNum;
  wrapper.style.width = viewport.width + 'px';
  wrapper.style.height = viewport.height + 'px';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width * window.devicePixelRatio;
  canvas.height = viewport.height * window.devicePixelRatio;
  canvas.style.width = viewport.width + 'px';
  canvas.style.height = viewport.height + 'px';
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  wrapper.appendChild(canvas);

  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'pdf-text-layer';
  wrapper.appendChild(textLayerDiv);

  container.appendChild(wrapper);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const textContent = await page.getTextContent();

  // Détection de PDF scanné (première page seulement)
  if (pageNum === 1) {
    const totalChars = textContent.items.reduce((sum, item) => sum + item.str.trim().length, 0);
    if (totalChars < 10) {
      scannedWarning.style.display = 'inline';
    }
  }

  // Couche de texte transparente par-dessus le rendu : c'est elle qui rend
  // les mots cliquables pour le dictionnaire et le traducteur
  const spans = [];
  textContent.items.forEach((item) => {
    if (!item.str.trim()) return;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

    const span = document.createElement('span');
    span.textContent = item.str;

    const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
    span.style.left = tx[4] + 'px';
    span.style.top = (tx[5] - fontSize) + 'px';
    span.style.fontSize = fontSize + 'px';
    span.style.fontFamily = 'sans-serif';

    // Largeur attendue du fragment dans le PDF (px CSS) — sert à la calibration
    const largeurCible = (item.width || 0) * state.currentScale;
    span.dataset.largeurCible = largeurCible;

    textLayerDiv.appendChild(span);
    spans.push(span);
  });

  // Calibration horizontale (comme le vrai text layer de pdf.js) : la police de
  // substitution n'a pas la même largeur que la police du PDF → sans scaleX, le
  // texte invisible se décale et on clique sur le mauvais mot.
  // Lecture de toutes les largeurs d'abord, puis écriture des transformations.
  const largeursReelles = spans.map((s) => s.getBoundingClientRect().width);
  spans.forEach((span, i) => {
    const cible = parseFloat(span.dataset.largeurCible);
    const reelle = largeursReelles[i];
    if (cible > 0 && reelle > 0) {
      span.style.transform = `scaleX(${cible / reelle})`;
    }
  });

  state.renderedPages.add(pageNum);
}

async function renderAllPages() {
  const numPages = state.pdf.numPages;
  for (let i = 1; i <= numPages; i++) {
    await renderPage(i);
  }
}

async function rerender() {
  container.innerHTML = '';
  state.renderedPages.clear();
  zoomLevel.textContent = Math.round(state.currentScale / 1.5 * 100) + '%';
  await renderAllPages();
}

function fitToWidth() {
  if (!state.pdf) return;
  state.pdf.getPage(1).then((page) => {
    const unscaledViewport = page.getViewport({ scale: 1 });
    const availableWidth = window.innerWidth - 120;
    state.currentScale = availableWidth / unscaledViewport.width;
    rerender();
  });
}

function scrollToPage(num) {
  const wrapper = container.querySelector(`.pdf-page-wrapper[data-page-num="${num}"]`);
  if (wrapper) {
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pageInput.value = num;
  }
}

function updateCurrentPage() {
  const wrappers = container.querySelectorAll('.pdf-page-wrapper');
  const toolbarHeight = 48;
  let currentPage = 1;

  for (const w of wrappers) {
    const rect = w.getBoundingClientRect();
    if (rect.top < window.innerHeight / 2 && rect.bottom > toolbarHeight) {
      currentPage = parseInt(w.dataset.pageNum);
    }
  }
  pageInput.value = currentPage;
}

function setupControls() {
  const numPages = state.pdf.numPages;
  pageCount.textContent = numPages;
  pageInput.max = numPages;

  prevBtn.addEventListener('click', () => {
    const cur = parseInt(pageInput.value);
    if (cur > 1) scrollToPage(cur - 1);
  });

  nextBtn.addEventListener('click', () => {
    const cur = parseInt(pageInput.value);
    if (cur < numPages) scrollToPage(cur + 1);
  });

  pageInput.addEventListener('change', () => {
    let val = parseInt(pageInput.value);
    val = Math.max(1, Math.min(numPages, val || 1));
    pageInput.value = val;
    scrollToPage(val);
  });

  zoomIn.addEventListener('click', () => {
    state.currentScale *= 1.2;
    rerender();
  });

  zoomOut.addEventListener('click', () => {
    state.currentScale /= 1.2;
    rerender();
  });

  zoomFit.addEventListener('click', fitToWidth);

  window.addEventListener('scroll', updateCurrentPage);
}

async function loadPdf() {
  const url = getPdfUrl();
  if (!url) {
    container.innerHTML = '<p class="pdf-erreur">Aucune URL de PDF fournie.</p>';
    return;
  }

  showLoading();

  try {
    const filename = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'PDF';
    document.title = filename + ' — NavigKid!';

    state.pdf = await pdfjsLib.getDocument({
      url: url,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/cmaps/',
      cMapPacked: true,
    }).promise;

    hideLoading();
    setupControls();
    zoomLevel.textContent = '100%';
    await renderAllPages();
  } catch (err) {
    hideLoading();
    console.error('[PDF Viewer] Erreur de chargement:', err);
    container.innerHTML = `
      <div class="pdf-erreur">
        <p class="pdf-erreur-titre">Impossible de charger le PDF</p>
        <p class="pdf-erreur-detail">${err.message || 'Erreur inconnue'}</p>
      </div>`;
  }
}

loadPdf();
