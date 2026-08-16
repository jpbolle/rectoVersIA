'use client';

// Cloche de notifications du header (prof, élève, admin).
// Les notifications sont calculées côté serveur (/api/notifications) ; le
// badge compare leur date à users/{uid}.notifsLastSeen. Prof/admin peuvent
// désactiver les notifications depuis le menu.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { PAGES_APP } from '@/types/annonce';
import styles from './NotificationBell.module.css';

const POLL_MS = 5 * 60 * 1000; // rafraîchissement en arrière-plan

// ── Le rappel « tu as beaucoup de notifications » ──
// Passé ce seuil, la cloche ne suffit plus : un badge « 9+ » dit qu'il y en a
// beaucoup, il ne dit pas QUOI. Une popup s'ouvre alors à la PREMIÈRE
// ouverture de l'application, une seule fois par session du navigateur
// (`sessionStorage`) — la rejouer à chaque navigation la rendrait haïssable,
// et l'oublier définitivement la rendrait inutile.
const SEUIL_RAPPEL = 10;
const CLE_RAPPEL = 'notifs-rappel-vu';

interface NotifItem {
  id: string;
  type: 'remise' | 'activite' | 'corrige' | 'annonce';
  title: string;
  sub: string;
  date: string;
  href?: string;                 // annonce avec lien : l'item devient cliquable
}

interface NotifData {
  notifications: NotifItem[];
  lastSeen: string | null;
  read: string[];                // ids éteints un par un (clic sur la notification)
  enabled: boolean;
  isAdmin: boolean;
}

const TYPE_ICONS: Record<NotifItem['type'], string> = {
  remise: '📥',
  activite: '📝',
  corrige: '✅',
  annonce: '📢',
};

// Nom lisible de la page pointée par une annonce. Un chemin tapé à la main
// (une activité précise) n'est dans aucune liste : on annonce alors « Ouvrir
// la page » plutôt que d'afficher une adresse brute à l'élève.
function pageLabel(href: string): string {
  const page = PAGES_APP.find((p) => p.path === href);
  if (page) return page.label.replace(/\s*\((prof|élève)\)$/, '');
  return 'Ouvrir la page';
}

// « 14:32 » aujourd'hui, « 2 mai » sinon
function formatNotifDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ variant }: { variant: 'prof' | 'student' | 'admin' }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [data, setData] = useState<NotifData | null>(null);
  const [open, setOpen] = useState(false);
  // Rappel plein écran quand les non-lues s'accumulent
  const [rappel, setRappel] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/notifications', { headers });
      const json = await res.json();
      if (!json.success || !json.data) return;
      setData(json.data);

      // Le rappel se décide ICI, à l'arrivée des données — pas dans un effet :
      // un `setState` dans un effet déclenche un rendu en cascade, et le
      // déclencheur est bien un événement (la réponse du serveur).
      if (typeof window === 'undefined' || sessionStorage.getItem(CLE_RAPPEL)) return;
      const d = json.data as NotifData;
      if (d.enabled === false) return;
      const combien = (d.notifications || []).filter(
        (n) => (!d.lastSeen || n.date > d.lastSeen) && !(d.read || []).includes(n.id)
      ).length;
      if (combien >= SEUIL_RAPPEL) {
        sessionStorage.setItem(CLE_RAPPEL, '1');
        setRappel(true);
      }
    } catch {
      // silencieux : la cloche n'affiche simplement rien
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, load]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const save = useCallback(async (payload: {
    lastSeen?: string;
    enabled?: boolean;
    read?: string;
  }) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // silencieux
    }
  }, [getAuthHeaders]);

  if (!isAuthenticated) return null;

  const enabled = data?.enabled !== false;
  const notifications = data?.notifications || [];
  const lastSeen = data?.lastSeen || '';
  const read = data?.read || [];
  // Non lue : postérieure au dernier « tout marquer » ET jamais cliquée
  const isUnreadNotif = (n: NotifItem) =>
    (!lastSeen || n.date > lastSeen) && !read.includes(n.id);
  const nonLues = enabled ? notifications.filter(isUnreadNotif) : [];
  const unread = nonLues.length;

  const markAllSeen = () => {
    const now = new Date().toISOString();
    setData((prev) => (prev ? { ...prev, lastSeen: now } : prev));
    save({ lastSeen: now });
  };

  // Clic sur une notification : elle seule s'éteint, les autres restent
  const markRead = (id: string) => {
    if (read.includes(id)) return;
    setData((prev) => (prev ? { ...prev, read: [...(prev.read || []), id] } : prev));
    save({ read: id });
  };

  const toggleEnabled = () => {
    const next = !enabled;
    setData((prev) => (prev ? { ...prev, enabled: next } : prev));
    save({ enabled: next });
    if (next) load();
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        title="Notifications"
      >
        {/* Cloche monochrome discrète (pas d'emoji jaune) */}
        <svg
          className={styles.bellIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHead}>
            <span className={styles.dropTitle}>Notifications</span>
            {enabled && unread > 0 && (
              <button type="button" className={styles.markBtn} onClick={markAllSeen}>
                Tout marquer comme lu
              </button>
            )}
          </div>

          {!enabled ? (
            <p className={styles.emptyText}>Les notifications sont désactivées.</p>
          ) : notifications.length === 0 ? (
            <p className={styles.emptyText}>Aucune notification récente.</p>
          ) : (
            <div className={styles.list}>
              {notifications.map((n) => {
                const isUnread = isUnreadNotif(n);

                // Une annonce n'est pas un intitulé d'activité : c'est un texte
                // à lire en entier, avec parfois une page à ouvrir. Elle a donc
                // sa propre mise en page, en hauteur plutôt qu'en largeur.
                // Le clic sur la carte l'éteint, qu'elle porte un lien ou non.
                if (n.type === 'annonce') {
                  return (
                    <div
                      key={n.id}
                      className={`${styles.annonce} ${isUnread ? styles.itemUnread : ''}`}
                      onClick={() => markRead(n.id)}
                    >
                      <div className={styles.annonceHead}>
                        <span className={styles.itemIcon}>{TYPE_ICONS.annonce}</span>
                        <span className={styles.annonceFrom}>{n.sub}</span>
                        <span className={styles.itemDate}>{formatNotifDate(n.date)}</span>
                        {isUnread && <span className={styles.unreadDot} />}
                      </div>
                      <p className={styles.annonceText}>{n.title}</p>
                      {n.href && (
                        <Link
                          href={n.href}
                          className={styles.annonceLink}
                          onClick={() => setOpen(false)}
                        >
                          → {pageLabel(n.href)}
                        </Link>
                      )}
                    </div>
                  );
                }

                const body = (
                  <>
                    <span className={styles.itemIcon}>{TYPE_ICONS[n.type]}</span>
                    <div className={styles.itemBody}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemSub}>{n.sub}</span>
                    </div>
                    <span className={styles.itemDate}>{formatNotifDate(n.date)}</span>
                    {isUnread && <span className={styles.unreadDot} />}
                  </>
                );
                const className = `${styles.item} ${isUnread ? styles.itemUnread : ''}`;

                // Chaque notification mène à ce qu'elle annonce : la copie à
                // corriger pour le prof, l'activité pour l'élève.
                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    className={`${className} ${styles.itemLink}`}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className={className} onClick={() => markRead(n.id)}>
                    {body}
                  </div>
                );
              })}
            </div>
          )}

          {variant === 'admin' && (
            <div className={styles.adminSection}>
              <div className={styles.adminTitle}>Administration</div>
              <p className={styles.emptyText}>Rien pour l&apos;instant.</p>
            </div>
          )}

          {variant !== 'student' && (
            <div className={styles.footer}>
              <label className={styles.toggleRow}>
                <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
                Recevoir les notifications
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Rappel : les non-lues se sont accumulées ──
          Le badge plafonne à « 9+ » : passé ce point il signale un volume,
          plus un contenu. La popup rappelle donc où vit la cloche, puis
          déroule ce qui n'a pas été lu. */}
      {rappel && (
        <div
          className={styles.rappelOverlay}
          onClick={(e) => e.target === e.currentTarget && setRappel(false)}
        >
          <div className={styles.rappelPopup} role="dialog" aria-modal="true">
            <header className={styles.rappelEntete}>
              <div className={styles.rappelCloche} aria-hidden="true">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                <span className={styles.rappelBadge}>{unread}</span>
              </div>
              <div>
                <h3>
                  {unread} notification{unread > 1 ? 's' : ''} non lue{unread > 1 ? 's' : ''}
                </h3>
                <p className={styles.rappelSous}>
                  Elles t’attendent dans la <strong>cloche</strong>, en haut de l’écran. Les voici.
                </p>
              </div>
              <button
                type="button"
                className={styles.rappelFermer}
                onClick={() => setRappel(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </header>

            <div className={styles.rappelSeparateur} />

            <div className={styles.rappelListe}>
              {nonLues.map((n) => {
                const contenu = (
                  <>
                    <span className={styles.rappelIcone}>{TYPE_ICONS[n.type]}</span>
                    <div className={styles.rappelTexte}>
                      <span className={styles.rappelTitre}>{n.title}</span>
                      <span className={styles.rappelMeta}>
                        {n.sub} · {formatNotifDate(n.date)}
                      </span>
                    </div>
                  </>
                );
                // Comme dans la cloche : chaque notification mène à ce qu'elle
                // annonce, et son clic l'éteint.
                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    className={`${styles.rappelItem} ${styles.rappelItemLien}`}
                    onClick={() => {
                      markRead(n.id);
                      setRappel(false);
                    }}
                  >
                    {contenu}
                  </Link>
                ) : (
                  <div
                    key={n.id}
                    className={styles.rappelItem}
                    onClick={() => markRead(n.id)}
                  >
                    {contenu}
                  </div>
                );
              })}
            </div>

            <footer className={styles.rappelPied}>
              <button
                type="button"
                className={styles.rappelGhost}
                onClick={() => {
                  markAllSeen();
                  setRappel(false);
                }}
              >
                Tout marquer comme lu
              </button>
              <button
                type="button"
                className={styles.rappelPrimary}
                onClick={() => setRappel(false)}
              >
                Plus tard
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
