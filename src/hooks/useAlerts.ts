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

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts', {
        headers: buildApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      const alertData = Array.isArray(data) ? data : [];
      setAlerts(alertData);
      setUnreadCount(alertData.filter((a: Alert) => !a.read).length);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id?: number) => {
    try {
      await fetch('/api/alerts/read', {
        method: 'POST',
        headers: buildApiHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(id ? { id } : {}),
      });
      await fetchAlerts();
    } catch (err) {
      console.error('Error marking alerts as read:', err);
    }
  }, [fetchAlerts]);

  const createAlert = useCallback(async (
    type: string,
    message: string,
    severity: Alert['severity'] = 'info',
    options: CreateAlertOptions = {},
  ) => {
    try {
      await fetch('/api/alerts', {
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
      await fetchAlerts();
    } catch (err) {
      console.error('Error creating alerts:', err);
    }
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
    const interval = window.setInterval(fetchAlerts, 30000);
    return () => window.clearInterval(interval);
  }, [fetchAlerts]);

  return { alerts, unreadCount, loading, fetchAlerts, markAsRead, createAlert };
}
