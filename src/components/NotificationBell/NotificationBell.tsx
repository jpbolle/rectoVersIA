'use client';

// Cloche de notifications du header (prof, élève, admin).
// Les notifications sont calculées côté serveur (/api/notifications) ; le
// badge compare leur date à users/{uid}.notifsLastSeen. Prof/admin peuvent
// désactiver les notifications depuis le menu.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from './NotificationBell.module.css';

const POLL_MS = 5 * 60 * 1000; // rafraîchissement en arrière-plan

interface NotifItem {
  id: string;
  type: 'remise' | 'activite' | 'corrige';
  title: string;
  sub: string;
  date: string;
}

interface NotifData {
  notifications: NotifItem[];
  lastSeen: string | null;
  enabled: boolean;
  isAdmin: boolean;
}

const TYPE_ICONS: Record<NotifItem['type'], string> = {
  remise: '📥',
  activite: '📝',
  corrige: '✅',
};

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
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/notifications', { headers });
      const json = await res.json();
      if (json.success && json.data) setData(json.data);
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

  const save = useCallback(async (payload: { lastSeen?: string; enabled?: boolean }) => {
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
  const unread = enabled
    ? notifications.filter((n) => !lastSeen || n.date > lastSeen).length
    : 0;

  const markAllSeen = () => {
    const now = new Date().toISOString();
    setData((prev) => (prev ? { ...prev, lastSeen: now } : prev));
    save({ lastSeen: now });
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
                const isUnread = !lastSeen || n.date > lastSeen;
                return (
                  <div key={n.id} className={`${styles.item} ${isUnread ? styles.itemUnread : ''}`}>
                    <span className={styles.itemIcon}>{TYPE_ICONS[n.type]}</span>
                    <div className={styles.itemBody}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemSub}>{n.sub}</span>
                    </div>
                    <span className={styles.itemDate}>{formatNotifDate(n.date)}</span>
                    {isUnread && <span className={styles.unreadDot} />}
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
    </div>
  );
}
