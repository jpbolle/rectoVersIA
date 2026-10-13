'use client';

// L'AFFICHEUR du diaporama (plan 2026-10-13) — transposé de `SlidesCardView`
// (app VibeCoding) : une dia à la fois, flèches ou clavier pour avancer, plein
// écran pour projeter. Même composant côté prof (au-dessus de l'éditeur, qui
// pilote alors l'index) et côté élève (onglet Ressources).
//
// Mise en page automatique : textes, encadrés et liens à gauche, images à
// droite (ou en rangée si la dia n'a que des images). Toutes les tailles sont
// en « cqw » (% de la largeur de la dia) : la dia garde ses proportions, en
// petit comme en plein écran.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { integrationAutorisee } from '@/lib/integration';
import { adresseWeb, texteBrut, type Dia, type DiaBlocImage } from '@/types/diaporama';
import { Markdown } from './Markdown';
import styles from './Diaporama.module.css';

export function DiaporamaVue({
  dias,
  index: indexPilote,
  onIndex,
}: {
  dias: Dia[];
  /** Piloté par l'éditeur ; absent = l'afficheur tient son propre index */
  index?: number;
  onIndex?: (i: number) => void;
}) {
  const [indexLocal, setIndexLocal] = useState(0);
  const cadreRef = useRef<HTMLDivElement>(null);
  const nb = dias.length;
  const courant = Math.min(indexPilote ?? indexLocal, Math.max(nb - 1, 0));
  const dia = dias[courant];

  const aller = (i: number) => {
    const j = Math.max(0, Math.min(nb - 1, i));
    setIndexLocal(j);
    onIndex?.(j);
  };
  const auClavier = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') aller(courant + 1);
    if (e.key === 'ArrowLeft') aller(courant - 1);
  };
  const pleinEcran = () =>
    document.fullscreenElement ? document.exitFullscreen() : cadreRef.current?.requestFullscreen?.();

  return (
    // En plein écran, c'est ce bloc (dia + barre de navigation) qui occupe l'écran
    <div
      ref={cadreRef}
      tabIndex={0}
      onKeyDown={auClavier}
      aria-roledescription="diaporama"
      aria-label={`Dia ${courant + 1} sur ${nb}`}
      className={styles.diaporama}
    >
      <DiaCadre dia={dia} />

      {/* Barre sous la dia : points à gauche, flèches au centre, plein écran à droite */}
      <div className={styles.barre}>
        <div className={styles.points} role="tablist" aria-label="Choisir une dia">
          {dias.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={i === courant}
              aria-label={`Dia ${i + 1} : ${texteBrut(d.titre)}`}
              onClick={() => aller(i)}
              className={`${styles.point} ${i === courant ? styles.pointActif : ''}`}
            />
          ))}
        </div>
        <div className={styles.navigation}>
          <BoutonFleche label="Dia précédente" disabled={courant === 0} onClick={() => aller(courant - 1)} retourne />
          <span className={styles.compteur}>
            {nb ? courant + 1 : 0} / {nb}
          </span>
          <BoutonFleche label="Dia suivante" disabled={courant >= nb - 1} onClick={() => aller(courant + 1)} />
        </div>
        <div className={styles.droite}>
          <button type="button" onClick={pleinEcran} className={styles.pleinEcran}>
            Plein écran
          </button>
        </div>
      </div>
    </div>
  );
}

/** Le cadre 16:9 d'une dia — aussi utilisé pour les miniatures */
export function DiaCadre({ dia, miniature = false }: { dia: Dia | undefined; miniature?: boolean }) {
  return (
    <div className={`${styles.cadre} ${miniature ? styles.cadreMiniature : ''}`}>
      {!dia ? (
        <p className={styles.vide}>Aucune dia.</p>
      ) : dia.html ? (
        <DiaHtml dia={dia} miniature={miniature} />
      ) : (
        <DiaClassique dia={dia} />
      )}
    </div>
  );
}

function BoutonFleche({
  label,
  disabled,
  onClick,
  retourne,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  retourne?: boolean;
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={styles.fleche}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={retourne ? { transform: 'rotate(180deg)' } : undefined}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function DiaClassique({ dia }: { dia: Dia }) {
  const mots = dia.blocs.filter((b) => b.kind !== 'image');
  const images = dia.blocs.filter((b): b is DiaBlocImage => b.kind === 'image');
  return (
    <div className={styles.dia}>
      <h3 className={styles.diaTitre}>
        <Markdown enLigne>{dia.titre}</Markdown>
      </h3>
      <div className={`${styles.diaCorps} ${mots.length ? '' : styles.diaCorpsImages}`}>
        {mots.length > 0 && (
          <div className={styles.colonneMots}>
            {mots.map((b) =>
              b.kind === 'encadre' ? (
                <div
                  key={b.id}
                  className={styles.encadre}
                  style={b.largeur && b.largeur < 100 ? { width: `${b.largeur}%` } : undefined}
                >
                  <p className={styles.encadreLabel}>
                    <Markdown enLigne>{b.label}</Markdown>
                  </p>
                  {b.valeur ? (
                    <p className={styles.encadreValeur}>{b.valeur}</p>
                  ) : (
                    <p className={styles.encadreVide}>à compléter</p>
                  )}
                </div>
              ) : b.kind === 'texte' ? (
                <Markdown key={b.id} className={styles.texte}>
                  {b.texte}
                </Markdown>
              ) : b.kind === 'lien' ? (
                <DiaLien key={b.id} label={b.label} url={b.url} />
              ) : null
            )}
          </div>
        )}
        {images.length > 0 && (
          <div
            // À côté d'un texte, les images ont une colonne de 34 % ; au-delà
            // de 100 %, c'est la colonne qui s'élargit (jusqu'à 70 % de la dia)
            style={
              mots.length
                ? { width: `${Math.min(70, 34 * (Math.max(100, ...images.map((b) => b.taille ?? 100)) / 100))}%` }
                : undefined
            }
            className={`${styles.colonneImages} ${mots.length ? styles.colonneImagesCote : styles.colonneImagesSeule}`}
          >
            {images.map((b) => (
              <DiaImage key={b.id} bloc={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Lien d'une dia : un bouton, ouvert dans un nouvel onglet
function DiaLien({ label, url }: { label: string; url: string }) {
  const href = adresseWeb(url);
  const texte = label.trim() || url;
  if (!href) return texte ? <p className={styles.lienVide}>{texte} (lien à compléter)</p> : null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.lien}>
      {texte}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={styles.lienIcone}
      >
        <path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
      </svg>
      <span className={styles.srOnly}>(s’ouvre dans un nouvel onglet)</span>
    </a>
  );
}

// Image d'une dia : cliquable si elle porte un lien, une fenêtre ou un agrandissement
function DiaImage({ bloc }: { bloc: DiaBlocImage }) {
  const [fenetre, setFenetre] = useState(false);
  if (!bloc.src) return <span className={styles.imageAttente}>Image à déposer</span>;

  // Au-delà de 100 %, l'image remplit sa colonne, qui s'est élargie
  const taille = Math.min(100, bloc.taille ?? 100);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- images déposées, tailles variables
    <img src={bloc.src} alt={bloc.alt} style={{ width: `${taille}%`, height: `${taille}%` }} className={styles.image} />
  );
  const lien = bloc.lien !== undefined ? adresseWeb(bloc.lien) : '';

  if (lien) {
    return (
      <a href={lien} target="_blank" rel="noopener noreferrer" title="Ouvrir le lien" className={styles.imageCliquable}>
        {img}
      </a>
    );
  }
  if (bloc.fenetre?.corps || bloc.agrandir) {
    return (
      <>
        <button
          type="button"
          onClick={() => setFenetre(true)}
          title={bloc.agrandir ? 'Agrandir' : bloc.fenetre?.titre}
          className={styles.imageCliquable}
        >
          {img}
        </button>
        {fenetre && (
          <Fenetre onClose={() => setFenetre(false)} label={bloc.agrandir ? bloc.alt : bloc.fenetre?.titre ?? ''}>
            {bloc.agrandir ? (
              // eslint-disable-next-line @next/next/no-img-element -- agrandissement
              <img src={bloc.src} alt={bloc.alt} className={styles.imageGrande} />
            ) : (
              <div className={styles.fenetreTexte}>
                <h4 className={styles.fenetreTitre}>
                  <Markdown enLigne>{bloc.fenetre!.titre}</Markdown>
                </h4>
                <Markdown className={styles.fenetreCorps}>{bloc.fenetre!.corps}</Markdown>
              </div>
            )}
          </Fenetre>
        )}
      </>
    );
  }
  return <span className={styles.imageFixe}>{img}</span>;
}

// Fenêtre par-dessus la dia. Fermeture : bouton, clic à côté ou Échap.
function Fenetre({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    const auClavier = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} onClick={onClose} className={styles.voile}>
      <div onClick={(e) => e.stopPropagation()} className={styles.fenetre}>
        <button type="button" onClick={onClose} aria-label="Fermer" className={styles.fermer}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// Dia HTML : la page occupe tout le cadre. Le zoom réduit ou agrandit tout le
// rendu : à 50 %, la page est mise en page deux fois plus large, puis réduite.
//
// ⚠ Même bac à sable que l'onglet Interactif : le CODE tourne avec
// `allow-scripts` SEUL — y ajouter `allow-same-origin` lui donnerait
// l'origine de l'application (session de l'élève comprise). Une page TIERCE
// garde `allow-same-origin`, qui désigne SA propre origine, et n'est affichée
// que si elle est sur la liste blanche.
function DiaHtml({ dia, miniature }: { dia: Dia; miniature: boolean }) {
  const boiteRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [boite, setBoite] = useState<{ w: number; h: number } | null>(null);
  const [encre, setEncre] = useState<[number, number, number, number] | null>(null);

  const url = dia.html?.url && integrationAutorisee(dia.html.url) ? dia.html.url : '';
  const code = url ? '' : dia.html?.code ?? '';

  useEffect(() => {
    const el = boiteRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoite({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const auMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const zone = (e.data as { diaporamaZone?: unknown } | null)?.diaporamaZone;
      if (Array.isArray(zone) && zone.length === 4 && zone.every((n) => typeof n === 'number'))
        setEncre(zone as [number, number, number, number]);
    };
    window.addEventListener('message', auMessage);
    return () => window.removeEventListener('message', auMessage);
  }, []);

  if (!url && !code) {
    return (
      <p className={styles.vide}>
        {dia.html?.url ? 'Cette adresse n’est pas sur la liste des sites autorisés.' : 'Page HTML à compléter'}
      </p>
    );
  }
  const z = Math.max(10, dia.zoom ?? 100) / 100;

  // Centrage : on décale le cadre pour que la zone occupée par le contenu tombe
  // au milieu de la dia. Impossible pour une page tierce (le navigateur
  // interdit de mesurer une page d'un autre site).
  let dx = 0;
  let dy = 0;
  if (dia.centrer && code && boite && encre) {
    const [gauche, haut, droite, bas] = encre;
    const w = (droite - gauche) * z;
    const h = (bas - haut) * z;
    if (w <= boite.w) dx = (boite.w - w) / 2 - gauche * z;
    if (h <= boite.h) dy = (boite.h - h) / 2 - haut * z;
  }

  return (
    <div ref={boiteRef} className={styles.htmlBoite}>
      <iframe
        ref={iframeRef}
        title={texteBrut(dia.titre) || 'Page HTML'}
        tabIndex={miniature ? -1 : undefined}
        loading="lazy"
        referrerPolicy="no-referrer"
        {...(url
          ? {
              src: url,
              sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation',
              allow: 'fullscreen; encrypted-media',
            }
          : { srcDoc: code + RAPPORTEUR_ZONE, sandbox: 'allow-scripts' })}
        style={{
          width: `${100 / z}%`,
          height: `${100 / z}%`,
          transform: `translate(${dx}px, ${dy}px) scale(${z})`,
          transformOrigin: '0 0',
        }}
        className={styles.htmlCadre}
      />
    </div>
  );
}

// Petit script ajouté à la fin du code d'une dia HTML : il envoie la zone
// réellement occupée par le contenu visible, pour le centrage. Le cadre reste
// isolé : seuls ces quatre nombres sortent, par postMessage.
const RAPPORTEUR_ZONE = `<script>(function(){
var SKIP=/^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT|BR)$/i,SOLID=/^(IMG|CANVAS|SVG|VIDEO|IFRAME|INPUT|BUTTON|SELECT|TEXTAREA|PROGRESS|METER)$/i;
function measure(){if(!document.body)return;var l=1/0,t=1/0,r=-1/0,b=-1/0,x=scrollX,y=scrollY,range=document.createRange();
function add(k){if(k.width<1&&k.height<1)return;l=Math.min(l,k.left+x);t=Math.min(t,k.top+y);r=Math.max(r,k.right+x);b=Math.max(b,k.bottom+y)}
var all=document.body.getElementsByTagName("*");for(var i=0;i<all.length;i++){var e=all[i];if(SKIP.test(e.tagName))continue;var c=getComputedStyle(e);if(c.display==="none"||c.visibility==="hidden")continue;
if(SOLID.test(e.tagName)||(c.backgroundColor!=="transparent"&&c.backgroundColor!=="rgba(0, 0, 0, 0)")||c.backgroundImage!=="none"||c.boxShadow!=="none"||parseFloat(c.borderTopWidth)||parseFloat(c.borderRightWidth)||parseFloat(c.borderBottomWidth)||parseFloat(c.borderLeftWidth)){add(e.getBoundingClientRect())}
for(var n=e.firstChild;n;n=n.nextSibling){if(n.nodeType===3&&n.nodeValue.trim()){range.selectNodeContents(n);add(range.getBoundingClientRect())}}}
if(r>l&&b>t)parent.postMessage({diaporamaZone:[l,t,r,b]},"*")}
addEventListener("load",measure);addEventListener("resize",measure);if(window.ResizeObserver)new ResizeObserver(measure).observe(document.documentElement);setTimeout(measure,300);setTimeout(measure,1500)})()<\/script>`;
