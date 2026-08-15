/**
 * Import de l'anthologie Molière (site Google Sites moliere.cnddinant.be)
 * vers la bibliothèque d'œuvres — collection `oeuvres` + sous-collection
 * `sections`.
 *
 * Usage :
 *   npx tsx scripts/import-oeuvre-moliere.ts                  → simulation (dry run)
 *   npx tsx scripts/import-oeuvre-moliere.ts --apply          → écrit dans Firestore
 *   npx tsx scripts/import-oeuvre-moliere.ts --prof <uid>     → propriétaire de l'œuvre
 *   npx tsx scripts/import-oeuvre-moliere.ts --page le-tartuffe  → une seule pièce
 *
 * CE QUE LE SCRIPT SAIT FAIRE
 *   - chapitre  = une pièce (une page du site)
 *   - section   = une scène ; l'ACTE devient l'étiquette `groupe`
 *   - blocs     = prose (`texte`), vers groupés (`vers`, avec le locuteur quand
 *                 le site l'indique en capitales), vidéos YouTube et Drive
 *
 * CE QU'IL NE PEUT PAS FAIRE
 *   Les Google Forms de vérification sont derrière une authentification Google :
 *   `viewform` répond « connectez-vous ». Leurs questions ne sont donc PAS
 *   importées — le script signale chaque formulaire rencontré, avec sa position
 *   et son URL, pour que JP les reconstruise (un Apps Script qui exporte ses
 *   formulaires en JSON ferait le pont).
 *
 * L'import est une PREMIÈRE PASSE, pas une vérité : le découpage d'un site
 * rédigé à la main réserve toujours des surprises. Ce qui en sort se retouche
 * ensuite dans le constructeur d'œuvre.
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import {
  generateOeuvreId,
  generateChapitreId,
  generateSectionId,
  generateBlocId,
} from '../src/types/oeuvre';
import type { OeuvreBloc, OeuvreChapitre, OeuvreSectionRef } from '../src/types/oeuvre';

const SITE = 'https://www.moliere.cnddinant.be';

// Les dix pièces dans l'ordre chronologique du site, avec leur date.
const PAGES: { slug: string; titre: string; sousTitre: string }[] = [
  { slug: 'introduction', titre: 'Molière et son époque', sousTitre: 'Introduction' },
  { slug: 'lécole-des-femmes', titre: 'L’École des femmes', sousTitre: '1662' },
  { slug: 'le-tartuffe', titre: 'Le Tartuffe', sousTitre: '1664-1669' },
  { slug: 'don-juan-ou-le-festin-de-pierre', titre: 'Don Juan ou le Festin de pierre', sousTitre: '1665' },
  { slug: 'le-misanthrope', titre: 'Le Misanthrope', sousTitre: '1666' },
  { slug: 'le-médecin-malgré-lui', titre: 'Le Médecin malgré lui', sousTitre: '1666' },
  { slug: 'lavare', titre: 'L’Avare', sousTitre: '1668' },
  { slug: 'le-bourgeois-gentilhomme', titre: 'Le Bourgeois gentilhomme', sousTitre: '1670' },
  { slug: 'les-fourberies-de-scapin', titre: 'Les Fourberies de Scapin', sousTitre: '1671' },
  { slug: 'les-femmes-savantes', titre: 'Les Femmes savantes', sousTitre: '1672' },
  { slug: 'le-malade-imaginaire', titre: 'Le Malade imaginaire', sousTitre: '1673' },
];

// ─────────────────────────── Environnement ───────────────────────────

function loadEnvFile(filePath: string) {
  const content = readFileSync(resolve(filePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function initFirestore(): Firestore {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// ─────────────────────────── Analyse du HTML ───────────────────────────

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

type Element =
  | { kind: 'titre'; niveau: 1 | 2; texte: string }
  | { kind: 'para'; texte: string }
  | { kind: 'video'; videoId?: string; videoUrl?: string }
  | { kind: 'image'; url: string }
  | { kind: 'form'; url: string };

/**
 * Google Sites imbrique tout dans des div : on ne reconstruit pas un arbre, on
 * relève les éléments porteurs de sens DANS L'ORDRE DU DOCUMENT. C'est
 * suffisant — le site est une suite linéaire de titres, de paragraphes et de
 * lecteurs intégrés.
 */
function analyser(html: string): Element[] {
  const motif = new RegExp(
    [
      '<(h1|h2|p)[^>]*>([\\s\\S]*?)</\\1>',
      '<iframe[^>]*src="([^"]+)"',
      'docs\\.google\\.com/forms/d/e/([\\w-]+)',
      '<img[^>]*src="(https://lh\\d[^"]+)"',
    ].join('|'),
    'g'
  );

  const out: Element[] = [];
  const formsVus = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = motif.exec(html)) !== null) {
    if (m[1]) {
      const texte = decode(m[2]);
      // Le blob JavaScript de Google Sites contient des faux paragraphes
      if (!texte || texte.length > 4000 || /function\(|\{return|var [a-z]=/.test(texte)) continue;
      if (m[1] === 'p') out.push({ kind: 'para', texte });
      else out.push({ kind: 'titre', niveau: m[1] === 'h1' ? 1 : 2, texte });
    } else if (m[3]) {
      const src = m[3];
      const yt = src.match(/youtube\.com\/embed\/([\w-]+)/);
      const drive = src.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
      if (yt) out.push({ kind: 'video', videoId: yt[1] });
      else if (drive) out.push({ kind: 'video', videoUrl: `https://drive.google.com/file/d/${drive[1]}/preview` });
    } else if (m[4]) {
      if (formsVus.has(m[4])) continue;
      formsVus.add(m[4]);
      out.push({ kind: 'form', url: `https://docs.google.com/forms/d/e/${m[4]}/viewform` });
    } else if (m[5]) {
      // Les images du site sont hébergées chez Google. On ne les importe pas :
      // la règle du projet veut que les images vivent en base64 dans
      // ressourceImages, jamais en URL externe (une URL Google peut expirer et
      // ne survivrait pas à la fermeture du site). On les SIGNALE.
      out.push({ kind: 'image', url: m[5] });
    }
  }
  return out;
}

// ─────────────────────────── Découpage en scènes ───────────────────────────

const RE_ACTE = /^Extraits de l['’]acte\s+([0-9IVX]+)/i;
const RE_SCENE = /^Sc[eè]ne\s+([0-9IVX]+)\b\s*(.*)$/i;
const RE_LOCUTEUR = /^[A-ZÉÈÀÇÎÔÛ][A-ZÉÈÀÇÎÔÛ'’.\s-]{1,28}$/;
// Titres décoratifs du site qui n'apportent rien dans la liseuse
const RE_BRUIT = /^(Compléments de lecture|Pièce (précédente|suivante)|Retour à l['’]accueil|Anthologie réalisée)/i;

interface SectionBrute {
  titre: string;
  groupe: string;
  chapeau: string;
  blocs: OeuvreBloc[];
  formulaires: string[];
  images: string[];
}

/**
 * Firestore REFUSE les champs `undefined` (« Cannot use "undefined" as a
 * Firestore value »). Un bloc de prose n'a pas de `locuteur`, un bloc de vers
 * n'a pas de `videoId` : on retire les clés vides au lieu de les écrire.
 */
function bloc(partiel: Omit<OeuvreBloc, 'id'>): OeuvreBloc {
  const complet = { id: generateBlocId(), ...partiel } as Record<string, unknown>;
  for (const cle of Object.keys(complet)) {
    if (complet[cle] === undefined) delete complet[cle];
  }
  return complet as unknown as OeuvreBloc;
}

/**
 * Le site colle parfois le titre de la scène et sa présentation dans un même
 * paragraphe : « Scène 4 ORGON & DORINEOrgon revenu, semble-t-il, de voyage,
 * s'interroge… ». On coupe au premier point de bascule — fin de la liste des
 * personnages en capitales, ou début d'une vraie phrase — et le reste devient
 * le chapeau de la scène.
 */
function couperTitre(numero: string, suite: string): { titre: string; chapeau: string } {
  const base = `Scène ${numero}`;
  const reste = suite.trim();
  if (!reste) return { titre: base, chapeau: '' };

  // Cas fréquent : « ORGON & DORINEOrgon revenu… » — une capitale suivie
  // d'une minuscule marque la fin de la distribution.
  const bascule = reste.match(/^([A-ZÉÈÀÇÎÔÛ][A-ZÉÈÀÇÎÔÛ&,.'’\s-]{2,60}?)(?=[A-ZÉÈÀÇÎÔÛ][a-zéèàçêîôû])/);
  if (bascule) {
    const distribution = bascule[1].replace(/[\s.,]+$/, '');
    return { titre: `${base} — ${distribution}`, chapeau: reste.slice(bascule[1].length).trim() };
  }

  // Sinon : une présentation courte tient dans le titre, une longue passe en chapeau.
  if (reste.length <= 60) return { titre: `${base} — ${reste.replace(/[.:]$/, '')}`, chapeau: '' };
  return { titre: base, chapeau: reste };
}

function decouper(elements: Element[], nomPiece: string): { sections: SectionBrute[]; forms: string[] } {
  const sections: SectionBrute[] = [];
  const formsOrphelins: string[] = [];
  let acte = '';
  let courante: SectionBrute | null = null;

  // Vers en attente de regroupement : le site coupe une tirade en un
  // paragraphe par vers, ce qui donnerait autant de blocs que de lignes.
  let versEnCours: string[] = [];
  let locuteur = '';

  const viderVers = () => {
    if (!versEnCours.length) return;
    if (courante) {
      courante.blocs.push(
        bloc({ type: 'vers', contenu: versEnCours.join('\n'), locuteur: locuteur || undefined })
      );
    }
    versEnCours = [];
    locuteur = '';
  };

  // Renvoie la section ouverte — l'affectation se fait chez l'appelant pour
  // que TypeScript suive le type de `courante` (une affectation faite dans une
  // fermeture lui échappe).
  const ouvrir = (titre: string, chapeau = ''): SectionBrute => {
    viderVers();
    const s: SectionBrute = { titre, groupe: acte, chapeau, blocs: [], formulaires: [], images: [] };
    sections.push(s);
    return s;
  };

  for (const el of elements) {
    if (el.kind === 'titre') {
      const acteTrouve = el.texte.match(RE_ACTE);
      if (acteTrouve) {
        acte = `Acte ${acteTrouve[1]}`;
        courante = null;
        continue;
      }
      if (RE_BRUIT.test(el.texte)) continue;
      if (el.texte === nomPiece) continue;

      const scene = el.texte.match(RE_SCENE);
      if (scene) {
        const { titre, chapeau } = couperTitre(scene[1], scene[2]);
        courante = ouvrir(titre, chapeau);
      } else {
        // « Contexte », « Who is who ? », « Argument de la pièce »…
        courante = ouvrir(el.texte);
      }
      continue;
    }

    if (el.kind === 'video') {
      viderVers();
      if (!courante) courante = ouvrir(acte ? `${acte} — compléments` : 'Compléments');
      courante.blocs.push(
        bloc({ type: 'video', videoId: el.videoId, videoUrl: el.videoUrl, legende: 'Vidéo' })
      );
      continue;
    }

    if (el.kind === 'image') {
      if (courante) courante.images.push(el.url);
      continue;
    }

    if (el.kind === 'form') {
      if (courante) courante.formulaires.push(el.url);
      else formsOrphelins.push(el.url);
      continue;
    }

    // ── Paragraphe ──
    const t = el.texte;

    // Le site marque parfois la scène par un simple paragraphe
    const scene = t.match(RE_SCENE);
    if (scene && t.length < 400) {
      const { titre, chapeau } = couperTitre(scene[1], scene[2]);
      courante = ouvrir(titre, chapeau);
      continue;
    }

    // Texte d'ouverture d'un acte : il précède la première scène et la
    // présente. On lui donne une section à lui, que JP fusionnera s'il veut.
    if (!courante) courante = ouvrir(acte ? `${acte} — présentation` : 'Ouverture');

    // Nom de personnage en capitales : il introduit la réplique qui suit
    if (RE_LOCUTEUR.test(t) && t.length < 30) {
      viderVers();
      locuteur = t;
      continue;
    }

    // Vers : lignes courtes et non ponctuées comme de la prose.
    // Heuristique assumée — un vers de Molière tient en 12 syllabes.
    if (t.length <= 95 && !/[.:;]\s+\S/.test(t)) {
      versEnCours.push(t);
      continue;
    }

    viderVers();
    courante.blocs.push(bloc({ type: 'texte', contenu: `<p>${t}</p>` }));
  }

  viderVers();
  // Une section sans le moindre contenu n'a pas lieu d'être — sauf si elle
  // porte un chapeau, qui est déjà du texte.
  return {
    sections: sections.filter((s) => s.blocs.length > 0 || s.chapeau),
    forms: formsOrphelins,
  };
}

// ─────────────────────────── Programme ───────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const profIndex = args.indexOf('--prof');
  const profId = profIndex !== -1 ? args[profIndex + 1] : '';
  const pageIndex = args.indexOf('--page');
  const seulement = pageIndex !== -1 ? args[pageIndex + 1] : '';

  const pages = seulement ? PAGES.filter((p) => p.slug === seulement) : PAGES;
  if (!pages.length) {
    console.error(`Aucune page « ${seulement} » — slugs connus :\n  ${PAGES.map((p) => p.slug).join('\n  ')}`);
    process.exit(1);
  }
  if (apply && !profId) {
    console.error('--apply exige --prof <uid> : une œuvre appartient à un professeur.');
    process.exit(1);
  }

  const chapitres: OeuvreChapitre[] = [];
  const sectionsAEcrire: { id: string; data: Record<string, unknown> }[] = [];
  const formulairesAReconstruire: string[] = [];
  let imagesNonImportees = 0;

  for (const page of pages) {
    process.stdout.write(`→ ${page.titre}… `);
    const reponse = await fetch(`${SITE}/${encodeURI(page.slug)}`);
    if (!reponse.ok) {
      console.log(`ÉCHEC (HTTP ${reponse.status})`);
      continue;
    }
    const html = await reponse.text();
    const { sections, forms } = decouper(analyser(html), page.titre);

    const chapitreId = generateChapitreId();
    const refs: OeuvreSectionRef[] = [];

    for (const s of sections) {
      const sectionId = generateSectionId();
      // Deux colonnes dès que la scène est longue : c'est le cas des tirades.
      const caracteres = s.blocs.reduce((n, b) => n + (b.contenu?.length || 0), 0);
      sectionsAEcrire.push({
        id: sectionId,
        data: {
          id: sectionId,
          chapitreId,
          titre: s.titre,
          groupe: s.groupe,
          chapeau: s.chapeau,
          colonnes: caracteres > 1200 ? 2 : 1,
          blocs: s.blocs,
          questions: [],
        },
      });
      refs.push({ id: sectionId, titre: s.titre, groupe: s.groupe, aQuestions: false });
      s.formulaires.forEach((url) =>
        formulairesAReconstruire.push(`${page.titre} · ${s.titre} → ${url}`)
      );
      imagesNonImportees += s.images.length;
    }
    forms.forEach((url) => formulairesAReconstruire.push(`${page.titre} · (hors scène) → ${url}`));

    chapitres.push({
      id: chapitreId,
      titre: page.titre,
      sousTitre: page.sousTitre,
      sections: refs,
    });
    console.log(`${sections.length} sections`);
  }

  const totalSections = sectionsAEcrire.length;
  const totalBlocs = sectionsAEcrire.reduce(
    (n, s) => n + (s.data.blocs as OeuvreBloc[]).length,
    0
  );
  const totalVideos = sectionsAEcrire.reduce(
    (n, s) => n + (s.data.blocs as OeuvreBloc[]).filter((b) => b.type === 'video').length,
    0
  );

  console.log('\n─────────────────────────────────────────');
  console.log(`Chapitres : ${chapitres.length}`);
  console.log(`Sections  : ${totalSections}`);
  console.log(`Blocs     : ${totalBlocs} (dont ${totalVideos} vidéos)`);
  console.log(`Formulaires Google rencontrés : ${formulairesAReconstruire.length}`);
  if (imagesNonImportees) {
    console.log(
      `\n🖼  ${imagesNonImportees} images repérées, NON importées : elles sont hébergées`
    );
    console.log('   chez Google. Le projet stocke ses images en base64 (ressourceImages),');
    console.log('   jamais en URL externe — à redéposer dans le constructeur d’œuvre.');
  }

  if (formulairesAReconstruire.length) {
    console.log('\n⚠️  Les questions des Google Forms ne sont PAS importées');
    console.log('   (elles exigent une connexion Google). À reconstruire dans');
    console.log('   le constructeur d’œuvre, aux emplacements suivants :\n');
    formulairesAReconstruire.forEach((f) => console.log(`   · ${f}`));
  }

  if (!apply) {
    console.log('\nSimulation — rien n’a été écrit. Ajouter --apply --prof <uid> pour importer.');
    console.log('\nAperçu du sommaire :');
    chapitres.forEach((c) => {
      console.log(`\n  ${c.titre} (${c.sousTitre})`);
      c.sections.forEach((s) => console.log(`    ${s.groupe ? `[${s.groupe}] ` : ''}${s.titre}`));
    });
    return;
  }

  loadEnvFile('.env.local');
  const db = initFirestore();

  const oeuvreId = generateOeuvreId();
  const oeuvreRef = db.collection('oeuvres').doc(oeuvreId);
  const now = new Date();

  // Firestore plafonne un batch à 500 écritures
  let batch = db.batch();
  let ecritures = 0;
  for (const s of sectionsAEcrire) {
    batch.set(oeuvreRef.collection('sections').doc(s.id), s.data);
    if (++ecritures >= 450) {
      await batch.commit();
      batch = db.batch();
      ecritures = 0;
    }
  }
  batch.set(oeuvreRef, {
    id: oeuvreId,
    titre: 'Molière — Anthologie comique',
    auteur: 'Molière',
    description:
      'Les meilleurs extraits du dramaturge, importés du site moliere.cnddinant.be. ' +
      'Les vérifications de lecture restent à écrire.',
    chapitres,
    profId,
    profName: '',
    shared: false,
    archive: false,
    anneeScolaire: `${now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1}-${
      now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
    }`,
    createdAt: now,
    updatedAt: now,
  });
  await batch.commit();

  console.log(`\n✅ Œuvre importée : ${oeuvreId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
