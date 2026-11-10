/**
 * offline/useOnlineStatus.js
 * React hook that tracks online/offline status and triggers sync on reconnect.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { replayQueue } from './sync';
import { queueCount }  from './db';

export function useOnlineStatus() {
  const [online, setOnline]           = useState(navigator.onLine);
  const [syncing, setSyncing]         = useState(false);
  const [lastSync, setLastSync]       = useState(null);
  const [pendingCount, setPending]    = useState(0);
  const [syncResult, setSyncResult]   = useState(null); // { synced, failed }
  const syncedRef = useRef(false);

  /* Refresh pending count */
  const refreshPending = useCallback(async () => {
    try { setPending(await queueCount()); } catch {}
  }, []);

  /* Trigger sync */
  const doSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await replayQueue();
      setSyncResult(result);
      setLastSync(new Date());
      await refreshPending();
    } catch {}
    finally { setSyncing(false); }
  }, [syncing, refreshPending]);

  useEffect(() => {
    refreshPending();

    const goOnline = () => {
      setOnline(true);
      // Auto-sync when coming back online
      setTimeout(doSync, 800);
    };
    const goOffline = () => {
      setOnline(false);
      setSyncResult(null);
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [doSync, refreshPending]);

  // Sync once on mount if online and queue has items
  useEffect(() => {
    if (!syncedRef.current && navigator.onLine) {
      syncedRef.current = true;
      refreshPending().then(async () => {
        const count = await queueCount();
        if (count > 0) doSync();
      });
    }
  }, [doSync, refreshPending]);

  return { online, syncing, pendingCount, lastSync, syncResult, doSync, refreshPending };
}
