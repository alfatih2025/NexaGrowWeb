import { useState, useEffect, useCallback } from 'react';

export interface Alert {
  id: number;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  read: boolean;
  created_at: string;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      const alertData = Array.isArray(data) ? data : [];
      setAlerts(alertData);
      setUnreadCount(alertData.filter((a: Alert) => !a.read).length);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  }, []);

  const markAsRead = useCallback(async (id?: number) => {
    try {
      await fetch('/api/alerts/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {})
      });
      await fetchAlerts();
    } catch (err) {
      console.error('Error marking alerts as read:', err);
    }
  }, [fetchAlerts]);

  const createAlert = useCallback(async (type: string, message: string, severity: Alert['severity'] = 'info') => {
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, severity })
      });
      await fetchAlerts();
    } catch (err) {
      console.error('Error creating alert:', err);
    }
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return { alerts, unreadCount, loading, fetchAlerts, markAsRead, createAlert };
}
