'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './rgpd.module.css';

export default function RgpdPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      if (redirecting) return;
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router, redirecting]);

  if (authLoading && !isAuthenticated) return null;
  if (redirecting) return null;

  const headerVariant = role === 'prof' ? 'prof' : 'student';

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={headerVariant} />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Données personnelles (RGPD)</h1>
        <p className={styles.pageSubtitle}>
          Comment Recto-versIA collecte, protège et utilise tes données
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Pourquoi ces données ?</h2>
          <p>
            Recto-versIA est un outil pédagogique du cours de français : il sert à rédiger,
            corriger et suivre les progrès en écriture et en lecture. Les données collectées
            servent uniquement à cet accompagnement pédagogique — jamais à de la publicité,
            jamais à de la revente.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Quelles données sont enregistrées ?</h2>
          <ul>
            <li><strong>Identité</strong> : nom, prénom et adresse email scolaire.</li>
            <li><strong>Travaux</strong> : textes rédigés, brouillons et plans, auto-évaluations.</li>
            <li>
              <strong>Corrections</strong> : évaluations, annotations et commentaires du
              professeur (y compris les remarques audio).
            </li>
            <li>
              <strong>Vocabulaire</strong> : mots travaillés dans les séries lexicales et mots
              dont la définition a été demandée au dictionnaire.
            </li>
            <li>
              <strong>Recherche guidée (NavigKid)</strong> : réponses aux questionnaires,
              requêtes tapées et sites consultés pendant l&apos;activité.
            </li>
            <li><strong>Préférences</strong> : réglages d&apos;affichage de l&apos;éditeur.</li>
          </ul>
        </section>

        <section className={styles.card}>
          <span className={styles.badge}>Chiffrement actif depuis le 10 août 2026</span>
          <h2 className={styles.cardTitle}>Comment sont-elles protégées ?</h2>
          <ul>
            <li>
              <strong>Identités chiffrées</strong> : les noms, prénoms et emails sont stockés
              chiffrés (AES-256, une méthode de chiffrement robuste) dans la base de données.
              Même en cas de fuite de la base, les travaux ne peuvent pas être reliés à un
              élève identifiable sans la clé de chiffrement, conservée hors de la base.
            </li>
            <li>
              <strong>Accès contrôlé par le serveur</strong> : aucune donnée d&apos;élève
              n&apos;est accessible directement depuis le navigateur ; chaque demande passe par
              le serveur, qui vérifie l&apos;identité et le rôle de la personne connectée.
            </li>
            <li>
              <strong>Cloisonnement</strong> : chaque professeur ne voit que ses propres
              classes ; un élève ne voit que ses propres travaux et corrections.
            </li>
            <li>
              <strong>Hébergement sécurisé</strong> : base de données Google Cloud (Firestore),
              chiffrée au repos dans les centres de données de Google ; connexion à
              l&apos;application uniquement en HTTPS.
            </li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Intelligence artificielle et services tiers</h2>
          <p>
            Certaines fonctions font appel à des services externes, toujours via le serveur de
            l&apos;application :
          </p>
          <ul>
            <li>
              <strong>Claude (Anthropic)</strong> : aide à la réécriture, pré-correction et
              dictionnaire de proxémie. Seul le texte concerné est transmis, sans le nom ni
              l&apos;email de l&apos;élève.
            </li>
            <li>
              <strong>Whisper (OpenAI)</strong> : transcription des enregistrements audio.
            </li>
            <li>
              <strong>Google</strong> : connexion aux comptes scolaires (authentification).
            </li>
          </ul>
          <p>
            Conformément aux conditions de leurs API professionnelles, Anthropic et OpenAI
            n&apos;utilisent pas ces contenus pour entraîner leurs modèles.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Conservation et droits</h2>
          <p>
            Les données sont conservées pendant la durée de l&apos;accompagnement pédagogique.
            Conformément au RGPD, chaque élève (ou son responsable légal) peut demander
            l&apos;accès à ses données, leur rectification ou leur suppression.
          </p>
          <p>
            Contact :{' '}
            <a className={styles.contact} href="mailto:jeanphilippe.bolle@cnddinant.be">
              jeanphilippe.bolle@cnddinant.be
            </a>{' '}
            (Collège Notre-Dame de Dinant).
          </p>
        </section>

        <p className={styles.updated}>Dernière mise à jour : 10 août 2026</p>
      </main>

      <Footer />
    </div>
  );
}
