// L'APPRÉCIATION du prof sur une étape, dessinée (JP, 2026-10-11 : « des
// smileys directement en couleur », sans le jaune des emojis — un emoji ne se
// recolore pas). Vert qui sourit, orange neutre, rouge qui grimace franchement.

import type { Appreciation } from '@/types/portfolio';

const COULEURS: Record<Appreciation, string> = {
  bien: '#3f9b5f',
  moyen: '#e0912f',
  faible: '#c9483c',
};

interface Props {
  appreciation: Appreciation;
  taille?: number;
  titre?: string;
}

export default function SmileyAppreciation({ appreciation, taille = 26, titre }: Props) {
  const c = COULEURS[appreciation];
  return (
    <svg width={taille} height={taille} viewBox="0 0 32 32" role="img" aria-label={titre} style={{ display: 'block' }}>
      {titre && <title>{titre}</title>}
      <circle cx="16" cy="16" r="15" fill={c} />
      {appreciation === 'faible' ? (
        <>
          {/* Yeux plissés > < et bouche en zigzag : la grimace */}
          <path d="M8.5 10.5 L12.5 13 L8.5 15.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M23.5 10.5 L19.5 13 L23.5 15.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 23 L11 20.5 L14 23 L17 20.5 L20 23 L23 20.5 L24.5 22" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="11" cy="12.5" r="2.2" fill="#fff" />
          <circle cx="21" cy="12.5" r="2.2" fill="#fff" />
          {appreciation === 'bien' ? (
            <path d="M9 19 Q16 26 23 19" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M10 21 L22 21" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
  );
}
