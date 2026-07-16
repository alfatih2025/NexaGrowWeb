import { useState, useEffect, useCallback } from 'react';
import { buildApiHeaders } from '../lib/apiAuth';

export interface Alert {
  id: number;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  read: boolean;
  created_at: string;
}

export interface CreateAlertOptions {
  sendEmail?: boolean;
  recipientEmail?: string;
  metadata?: Record<string, unknown> | null;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts', {
        headers: buildApiHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to fetch alerts (${res.status})`);
      const data = await res.json();
      const alertData = Array.isArray(data) ? data : [];
      setAlerts(alertData);
      setUnreadCount(alertData.filter((a: Alert) => !a.read).length);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id?: number) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: buildApiHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ action: 'mark_read', id }),
      });
      if (!res.ok) throw new Error(`Failed to mark alerts as read (${res.status})`);
      setError(null);
      await fetchAlerts();
    } catch (err) {
      console.error('Error marking alerts as read:', err);
      setError(err instanceof Error ? err.message : 'Gagal menandai notifikasi');
    }
  }, [fetchAlerts]);

  const createAlert = useCallback(async (
    type: string,
    message: string,
    severity: Alert['severity'] = 'info',
    options: CreateAlertOptions = {},
  ) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: buildApiHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          type,
          message,
          severity,
          read: false,
          send_email: Boolean(options.sendEmail),
          recipient_email: options.recipientEmail || null,
          metadata: options.metadata ?? null,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create alert (${res.status})`);
      setError(null);
      await fetchAlerts();
    } catch (err) {
      console.error('Error creating alerts:', err);
      setError(err instanceof Error ? err.message : 'Gagal membuat notifikasi');
    }
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
    const interval = window.setInterval(fetchAlerts, 30000);
    return () => window.clearInterval(interval);
  }, [fetchAlerts]);

  return { alerts, unreadCount, loading, error, fetchAlerts, markAsRead, createAlert };
}
