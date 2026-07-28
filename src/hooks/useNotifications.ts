import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AppNotification {
  id: string;
  from_user_id: string | null;
  to_user_id: string;
  patient_id: string | null;
  type: string;
  title: string;
  message: string | null;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  created_at: string;
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as AppNotification[]) || []);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `to_user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ read: true }).eq('to_user_id', userId).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [userId]);

  const unread = notifications.filter(n => !n.read).length;

  return { notifications, unread, markRead, markAllRead, reload: load };
}
