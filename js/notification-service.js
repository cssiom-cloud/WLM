// ────────────────────────────────────────────────────────────
// Device & In-App Announcement Notification Service
// ────────────────────────────────────────────────────────────

import { t } from './i18n.js';
import { showToast } from './ui.js';

const NOTIFIED_KEY = 'wlr-notified-announcements';

function getNotifiedSet() {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY) || localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markNotified(id) {
  if (!id) return;
  const set = getNotifiedSet();
  set.add(id);
  const arr = Array.from(set).slice(-100);
  try {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
  } catch {}
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

export async function sendDeviceAnnouncementNotification(payload = {}) {
  const { id, title = 'Announcement', content = '', author = '', url = '' } = payload;
  const cleanContent = content ? content.replace(/<[^>]*>?/gm, '').trim() : '';
  const notifTitle = t('notifications.newAnnouncementTitle', { title }) || `มีประกาศใหม่: ${title}`;
  const notifBody = cleanContent
    ? (cleanContent.length > 90 ? cleanContent.slice(0, 87) + '...' : cleanContent)
    : (author ? `${t('notifications.byAuthor', { author }) || `โดย ${author}`}` : (t('notifications.clickToView') || 'คลิกเพื่อเปิดดูรายละเอียด'));

  const targetUrl = url || `./announcements.html?id=${encodeURIComponent(id || '')}`;

  // 1. Electron Desktop Native Notification
  if (window.desktopApp && typeof window.desktopApp.sendAnnouncementNotification === 'function') {
    try {
      await window.desktopApp.sendAnnouncementNotification({
        id,
        title,
        content: cleanContent,
        author,
        url: targetUrl
      });
    } catch (err) {
      console.warn('Desktop notification failed:', err);
    }
  } 
  // 2. Web Browser HTML5 Notification
  else if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const allowed = await requestNotificationPermission();
      if (allowed) {
        const notif = new Notification(notifTitle, {
          body: notifBody,
          icon: './assets/1.jpg',
          tag: `announcement-${id}`
        });
        notif.onclick = () => {
          window.focus();
          window.location.href = targetUrl;
        };
      }
    } catch (err) {
      console.warn('Browser notification error:', err);
    }
  }

  // 3. In-App Interactive Toast with clickable link
  try {
    const toastMsg = `${notifTitle}`;
    showToast(toastMsg, 'info', 7000);
  } catch {}

  // 4. Dispatch DOM event for reactive components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wlr-new-announcement', { detail: payload }));
  }

  markNotified(id);
}

let activeChannel = null;

export function startAnnouncementWatcher(supabase) {
  if (!supabase || activeChannel) return;

  try {
    activeChannel = supabase
      .channel('announcements-realtime-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const row = payload.new;
          if (!row || !row.id) return;
          const notified = getNotifiedSet();
          if (notified.has(row.id)) return;

          sendDeviceAnnouncementNotification({
            id: row.id,
            title: row.title || 'Announcement',
            content: row.content || '',
            author: row.author_name || row.created_by || '',
            url: `./announcements.html?id=${encodeURIComponent(row.id)}`
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Failed to start announcement watcher:', err);
  }
}
