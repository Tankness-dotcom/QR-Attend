import React, { useState, useEffect } from 'react';

/**
 * InstallPrompt
 * Shows a bottom banner when the PWA install prompt is available.
 * Handles both the browser's beforeinstallprompt (Chrome/Edge/Android)
 * and a manual "Add to Home Screen" guide for iOS Safari.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferred] = useState(null);
  const [showBanner, setShowBanner]   = useState(false);
  const [isIOS, setIsIOS]             = useState(false);
  const [dismissed, setDismissed]     = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone === true) return; // iOS standalone
    if (dismissed) return;

    const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show manual guide for iOS after a short delay
      const t = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(t);
    }

    // Chrome / Edge / Android
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferred(null);
  }

  function handleDismiss() {
    setShowBanner(false);
    setDismissed(true);
  }

  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: '#fff',
      borderTop: '3px solid #449c72',
      boxShadow: '0 -4px 20px rgba(62,111,92,.18)',
      padding: '1rem 1.25rem',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      fontFamily: 'Inter, sans-serif',
      animation: 'slideUp .3s ease',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* Logo */}
      <img src="/qrattend-logo.png" alt="QR-Attend"
        style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }} />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#2a4a3a', fontSize: '.95rem' }}>
          Install QR-Attend
        </div>
        {isIOS ? (
          <div style={{ fontSize: '.8rem', color: '#5a8070', marginTop: '.15rem' }}>
            Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install
          </div>
        ) : (
          <div style={{ fontSize: '.8rem', color: '#5a8070', marginTop: '.15rem' }}>
            Install as an app for faster access on this device
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontFamily: 'Inter,sans-serif', fontSize: '.85rem', padding: '.4rem .6rem' }}
        >
          Not now
        </button>
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              background: '#449c72', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '.5rem 1.1rem', fontWeight: 700, fontSize: '.875rem',
              cursor: 'pointer', fontFamily: 'Inter,sans-serif',
              boxShadow: '0 2px 8px rgba(68,156,114,.35)',
            }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
