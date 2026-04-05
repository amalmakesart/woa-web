import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { navigate } from '../lib/navigationRef';

export interface BannerData {
  actorName: string;
  actorAvatar: string | null;
  text: string;
  screen: string;
  params: Record<string, any>;
}

interface UnreadContextType {
  unreadCount: number;          // messages only — for Messages badge
  notifCount: number;           // notifications only
  totalBadge: number;           // messages + notifications — for bell
  refreshUnread: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  banner: BannerData | null;
  dismissBanner: () => void;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadCount: 0,
  notifCount: 0,
  totalBadge: 0,
  refreshUnread: async () => {},
  refreshNotifications: async () => {},
  activeConversationId: null,
  setActiveConversationId: () => {},
  banner: null,
  dismissBanner: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const isGigPosterRef = useRef<boolean>(false);
  const userIdRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshUnread = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUnreadCount(0); return; }
    userIdRef.current = user.id;

    const { data: prof } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    const isGigPoster = (prof as any)?.role === 'GIG_POSTER';
    isGigPosterRef.current = isGigPoster;

    const column = isGigPoster ? 'gig_poster_unread' : 'artist_unread';
    const idColumn = isGigPoster ? 'gig_poster_id' : 'artist_id';

    const { data } = await supabase
      .from('conversations')
      .select(column)
      .eq(idColumn, user.id);

    const total = (data ?? []).reduce((sum: number, row: any) => sum + (row[column] ?? 0), 0);
    setUnreadCount(total);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotifCount(0); return; }

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifCount(count ?? 0);
  }, []);

  const showBanner = useCallback(async (notif: any) => {
    // Don't banner for messages if already in that conversation
    if (notif.type === 'new_message' &&
        notif.reference_id === activeConversationId) return;

    // Fetch actor profile
    let actorName = 'SOMEONE';
    let actorAvatar: string | null = null;
    if (notif.actor_id) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('username, full_name, profile_photo_url')
        .eq('id', notif.actor_id)
        .maybeSingle();
      if (actor) {
        actorName = `@${((actor as any).username ?? (actor as any).full_name ?? 'UNKNOWN').toUpperCase()}`;
        actorAvatar = (actor as any).profile_photo_url ?? null;
      }
    }

    let text = '';
    let screen = 'Inbox';
    let params: Record<string, any> = {};

    switch (notif.type) {
      case 'new_message':
        text = `${actorName} SENT YOU A MESSAGE`;
        screen = 'Inbox';
        break;
      case 'new_follower':
        text = `${actorName} STARTED FOLLOWING YOU`;
        screen = 'ArtistProfile';
        params = { userId: notif.actor_id };
        break;
      case 'post_liked':
        text = `${actorName} LIKED YOUR POST`;
        screen = 'PostDetail';
        params = { postId: notif.reference_id };
        break;
      case 'post_comment':
        text = `${actorName} COMMENTED ON YOUR POST`;
        screen = 'PostDetail';
        params = { postId: notif.reference_id };
        break;
      case 'gig_interest':
        text = `${actorName} EXPRESSED INTEREST IN YOUR GIG`;
        screen = 'GigDetail';
        params = { gigId: notif.reference_id };
        break;
      case 'gig_nearby':
        text = `NEW GIG POSTED${notif.preview_text ? ': ' + notif.preview_text.toUpperCase() : ''}`;
        screen = 'GigDetail';
        params = { gigId: notif.reference_id };
        break;
    }

    if (!text) return;

    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner({ actorName, actorAvatar, text, screen, params });
    bannerTimerRef.current = setTimeout(() => setBanner(null), 3500);
  }, [activeConversationId]);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner(null);
  }, []);

  useEffect(() => {
    refreshUnread();
    refreshNotifications();

    const msgChannel = supabase
      .channel('global_conv_watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => { refreshUnread(); })
      .subscribe();

    const notifChannel = supabase
      .channel('global_notif_watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const notif = payload.new as any;
          const uid = userIdRef.current;
          if (!uid || notif.user_id !== uid) return;
          setNotifCount(c => c + 1);
          await showBanner(notif);
        })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(notifChannel);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [refreshUnread, refreshNotifications, showBanner]);

  const totalBadge = unreadCount + notifCount;

  return (
    <UnreadContext.Provider value={{
      unreadCount,
      notifCount,
      totalBadge,
      refreshUnread,
      refreshNotifications,
      activeConversationId,
      setActiveConversationId,
      banner,
      dismissBanner,
    }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
