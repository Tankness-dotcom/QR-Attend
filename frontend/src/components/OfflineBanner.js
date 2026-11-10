import React from 'react';
import { useOnlineStatus } from '../offline/useOnlineStatus';

/**
 * Shows a fixed banner at the top when offline or when syncing pending scans.
 * Globally mounted once in App.js.
 */
export default function OfflineBanner() {
  const { online, syncing, pendingCount, lastSync, syncResult, doSync } = useOnlineStatus();

  /* Nothing to show when online and no pending queue and no fresh sync result */
  if (online && pendingCount === 0 && !syncResult && !syncing) return null;

  /* ── styles ── */
  const base = {
    position: 'fixed',
    top: 56,            // below navbar
    left: 0, right: 0,
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '.5rem',
    padding: '.55rem 1rem',
    fontSize: '.82rem',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    flexWrap: 'wrap',
  };

  if (!online) {
    return (
      <div style={{ ...base, background: '#1f2937', color: '#f9fafb', borderBottom: '2px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span>📵</span>
          <span>You're offline — scans will be saved and synced when you reconnect</span>
        </div>
        {pendingCount > 0 && (
          <span style={{ background: '#f97316', color: '#fff', padding: '.15rem .6rem', borderRadius: '999px', fontSize: '.75rem' }}>
            {pendingCount} pending
          </span>
        )}
      </div>
    );
  }

  if (syncing) {
    return (
      <div style={{ ...base, background: '#1e40af', color: '#fff', borderBottom: '2px solid #2563eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ display: 'inline-block', animation: 'spin .7s linear infinite', fontSize: '1rem' }}>⏳</span>
          <span>Syncing {pendingCount} pending scan{pendingCount !== 1 ? 's' : ''}…</span>
        </div>
      </div>
    );
  }

  if (online && pendingCount > 0) {
    return (
      <div style={{ ...base, background: '#d97706', color: '#fff', borderBottom: '2px solid #b45309' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span>⚠️</span>
          <span>{pendingCount} offline scan{pendingCount !== 1 ? 's' : ''} waiting to sync</span>
        </div>
        <button
          onClick={doSync}
          style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', borderRadius: '6px', padding: '.25rem .7rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '.78rem' }}
        >
          Sync now
        </button>
      </div>
    );
  }

  if (syncResult) {
    const success = syncResult.synced > 0 && syncResult.failed === 0;
    const partial = syncResult.synced > 0 && syncResult.failed > 0;
    if (!success && !partial) return null;

    return (
      <div style={{ ...base, background: success ? '#166534' : '#92400e', color: '#fff', borderBottom: `2px solid ${success ? '#15803d' : '#b45309'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span>{success ? '✅' : '⚠️'}</span>
          <span>
            {success
              ? `${syncResult.synced} offline scan${syncResult.synced !== 1 ? 's' : ''} synced successfully`
              : `${syncResult.synced} synced, ${syncResult.failed} failed — tap to retry`
            }
          </span>
        </div>
        {lastSync && (
          <span style={{ opacity: .75, fontSize: '.75rem' }}>
            {lastSync.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}
          </span>
        )}
      </div>
    );
  }

  return null;
}
