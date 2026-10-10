'use client';

// La partie LIEN d'un dépôt de portfolio (plan 2026-10-10) : l'élève colle une
// adresse — audio sur Drive, Genially, Canva, vidéo YouTube… Rendu :
//  - YouTube ou fichier Drive → lecteur intégré (`videoEmbedUrl`) ;
//  - page de la liste blanche d'intégration (Genially, LearningApps…) → cadre ;
//  - toute autre adresse → lien cliquable.
// Le même composant sert à la lecture de la copie par le prof (`lectureSeule`).
//
// ⚠️ L'adresse vient d'un élève et s'affiche chez le prof : seules les
// adresses http(s) deviennent un lien (jamais `javascript:` ou `data:`). Le
// serveur fait le même tri à l'enregistrement.

import { integrationAutorisee } from '@/lib/integration';
import { lienValide } from '@/lib/portfolio-etat';
import { videoEmbedUrl } from '@/lib/youtube';
import styles from './Portfolio.module.css';

interface Props {
  valeur: string;
  onChange?: (valeur: string) => void;
  lectureSeule?: boolean;
}

// Les documents Google s'ouvrent mal dans un cadre (éditeur, connexion) : on
// n'intègre de Google que les VIDÉOS Drive, reconnues par `videoEmbedUrl`.
function cadreIntegrable(url: string): boolean {
  if (!integrationAutorisee(url)) return false;
  const hote = new URL(url).hostname;
  return hote !== 'docs.google.com' && hote !== 'drive.google.com';
}

export default function PortfolioDepotLien({ valeur, onChange, lectureSeule = false }: Props) {
  const url = lienValide(valeur);
  const video = url ? videoEmbedUrl(url) : null;
  const cadre = url && !video && cadreIntegrable(url) ? url : null;

  return (
    <div className={styles.lienDepot}>
      {!lectureSeule && (
        <input
          type="url"
          className={styles.champ}
          value={valeur}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Colle ici l’adresse (Drive, YouTube, Genially, Canva…)"
          inputMode="url"
          spellCheck={false}
        />
      )}
      {valeur.trim() && !url && (
        <p className={styles.lienErreur}>Ce n’est pas une adresse web (elle doit commencer par https://).</p>
      )}
      {url && (
        <>
          {(video || cadre) && (
            <div className={styles.lienCadre}>
              <iframe
                src={video ?? cadre!}
                title="Contenu du lien"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                // Page tierce : le même bac à sable que les ressources interactives
                sandbox={cadre ? 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation' : undefined}
              />
            </div>
          )}
          <a className={styles.lienOuvrir} href={url} target="_blank" rel="noopener noreferrer">
            ↗ {lectureSeule ? url : 'Ouvrir le lien dans un nouvel onglet'}
          </a>
        </>
      )}
    </div>
  );
}
