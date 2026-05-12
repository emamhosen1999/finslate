import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

import AppHeader from '../components/AppHeader.jsx';
import ActionButton from '../components/ActionButton.jsx';
import { useFinance } from '../context/FinanceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api, { apiPaths } from '../api/client';

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
  const toast = useToast();
  const { user } = useFinance();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get(apiPaths.notifications);
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await api.get(`${apiPaths.notifications}/unread-count`);
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put(`${apiPaths.notifications}/${id}/read`);
      await loadNotifications();
      await loadUnreadCount();
    } catch (err) {
      toast.push('Failed to mark as read', 'error');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put(`${apiPaths.notifications}/read-all`);
      await loadNotifications();
      await loadUnreadCount();
      toast.push('All notifications marked as read', 'success');
    } catch (err) {
      toast.push('Failed to mark all as read', 'error');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`${apiPaths.notifications}/${id}`);
      await loadNotifications();
      await loadUnreadCount();
      toast.push('Notification deleted', 'success');
    } catch (err) {
      toast.push('Failed to delete notification', 'error');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'info':
        return <Info size={18} style={{ color: 'var(--accent)' }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />;
      case 'error':
        return <XCircle size={18} style={{ color: 'var(--negative)' }} />;
      case 'success':
        return <CheckCircle size={18} style={{ color: 'var(--positive)' }} />;
      default:
        return <Bell size={18} style={{ color: 'var(--accent)' }} />;
    }
  };

  if (loading) {
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="skeleton h-6 w-40" />
      </div>
    );
  }

  return (
    <>
      <AppHeader 
        title="Notifications" 
        action={
          unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead} className="btn btn-ghost text-xs py-2 px-3">
              <CheckCheck size={14} /> Mark All Read
            </button>
          )
        } 
      />
      <main className="px-4 pt-3 space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Bell size={48} className="mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`card p-4 ${!n.is_read ? 'border-l-4' : ''}`}
              style={{
                borderLeftColor: !n.is_read ? 'var(--accent)' : undefined,
                opacity: n.is_read ? 0.7 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(n.id)}
                          className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                          style={{ color: 'var(--accent)' }}
                        >
                          <CheckCheck size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteNotification(n.id)}
                        className="p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                        style={{ color: 'var(--negative)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mb-2">{n.message}</p>
                  <div className="text-[10px] text-text-muted">
                    {fmtDate(n.created_at)} · {fmtTime(n.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </>
  );
}
