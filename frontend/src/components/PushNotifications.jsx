import { useState, useEffect } from 'react';
import { api } from '../api.js';

// Convert URL-safe base64 VAPID public key to Uint8Array for PushManager.subscribe()
function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// ── Status values ────────────────────────────────────────────────────────────
// 'checking'     — probing browser support and current subscription
// 'unsupported'  — browser has no serviceWorker / PushManager / Notification
// 'denied'       — user blocked notifications (can't programmatically ask again)
// 'unsubscribed' — supported, permission not denied, no active subscription
// 'subscribed'   — active subscription exists

export default function PushNotifications() {
  const [status, setStatus] = useState('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    } catch {
      setStatus('unsubscribed');
    }
  }

  async function subscribe() {
    setLoading(true);
    setError('');
    try {
      // Fetch the server's VAPID public key
      const { public_key } = await api.getVapidKey();

      // Ask browser for permission + create push subscription
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });

      // Persist subscription on the server
      const { endpoint, keys } = pushSub.toJSON();
      await api.pushSubscribe({ endpoint, p256dh: keys.p256dh, auth: keys.auth });

      setStatus('subscribed');
      setTestSent(false);
    } catch (err) {
      // User may have clicked "Block" in the browser prompt
      if (Notification.permission === 'denied') {
        setStatus('denied');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        const endpoint = pushSub.endpoint;
        await pushSub.unsubscribe();           // remove from browser
        await api.pushUnsubscribe(endpoint);   // remove from server
      }
      setStatus('unsubscribed');
      setTestSent(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setError('');
    setTestSent(false);
    try {
      await api.pushTest();
      setTestSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Don't render anything while probing or if unsupported
  if (status === 'checking' || status === 'unsupported') return null;

  return (
    <div className={`push-banner push-banner--${status}`}>
      <span className="push-banner__icon" aria-hidden>
        {status === 'subscribed' ? '🔔' : status === 'denied' ? '🔕' : '🔔'}
      </span>

      <div className="push-banner__body">
        {status === 'unsubscribed' && (
          <>
            <span className="push-banner__text">
              Включите уведомления, чтобы получать напоминания о привычках
            </span>
            <div className="push-banner__actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={subscribe}
                disabled={loading}
              >
                {loading ? <><span className="spinner spinner-sm" /> Включение...</> : 'Включить'}
              </button>
            </div>
          </>
        )}

        {status === 'subscribed' && (
          <>
            <span className="push-banner__text push-banner__text--success">
              Уведомления включены
              {testSent && <span className="push-sent-badge"> · отправлено ✓</span>}
            </span>
            <div className="push-banner__actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={sendTest}
                disabled={loading}
                title="Отправить тестовое уведомление на это устройство"
              >
                {loading ? <span className="spinner spinner-sm" /> : 'Тест'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={unsubscribe}
                disabled={loading}
              >
                Отключить
              </button>
            </div>
          </>
        )}

        {status === 'denied' && (
          <span className="push-banner__text push-banner__text--warn">
            Уведомления заблокированы. Разрешите их в настройках браузера (значок замка в адресной строке).
          </span>
        )}

        {error && <p className="push-banner__error">{error}</p>}
      </div>
    </div>
  );
}
