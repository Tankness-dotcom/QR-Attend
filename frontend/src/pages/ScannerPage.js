import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { getClasses, scanQR } from '../api';

const SCANNER_ID = 'qr-reader-viewport';

/* ─────────────────────────────────────────
   Camera config — only request what we need
───────────────────────────────────────── */
const SCAN_CONFIG = {
  fps: 15,
  qrbox: (w, h) => {
    // Box is 75% of the shorter dimension, max 300px
    const side = Math.min(Math.round(Math.min(w, h) * 0.75), 300);
    return { width: side, height: side };
  },
  rememberLastUsedCamera: true,
  // Only look for QR codes (faster, less CPU)
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  // Suppress verbose internal logs
  verbose: false,
};

export default function ScannerPage() {
  const [classes, setClasses]         = useState([]);
  const [classId, setClassId]         = useState('');
  const [scanning, setScanning]       = useState(false);
  const [result, setResult]           = useState(null);
  const [history, setHistory]         = useState([]);
  const [error, setError]             = useState('');
  const [cameraErr, setCameraErr]     = useState('');
  const [cameras, setCameras]         = useState([]);    // [{id, label}]
  const [activeCamIdx, setActiveCamIdx] = useState(0);  // index into cameras[]
  const [permState, setPermState]     = useState('unknown'); // 'unknown'|'granted'|'denied'
  const [starting, setStarting]       = useState(false);

  const scannerRef    = useRef(null);
  const processingRef = useRef(false);
  const mountedRef    = useRef(true);

  /* ── load classes ── */
  useEffect(() => {
    getClasses().then(data => {
      if (!mountedRef.current) return;
      setClasses(data);
      if (data.length === 1) setClassId(String(data[0].id));
    }).catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  /* ── enumerate cameras on mount (doesn't trigger permission dialog) ── */
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(cams => {
        if (!mountedRef.current) return;
        if (cams?.length) {
          setCameras(cams);
          // Prefer back/rear camera by default
          const backIdx = cams.findIndex(c => /back|rear|environment/i.test(c.label));
          setActiveCamIdx(backIdx >= 0 ? backIdx : cams.length - 1);
          setPermState('granted');
        }
      })
      .catch(err => {
        // On first load cameras may be empty if permission hasn't been granted yet — that's fine
        if (/permission|denied/i.test(String(err))) setPermState('denied');
      });
  }, []);

  /* ── cleanup on unmount ── */
  useEffect(() => {
    return () => { doStop(); };
  }, []); // eslint-disable-line

  /* ── actual stop logic (non-reactive) ── */
  async function doStop() {
    const sc = scannerRef.current;
    if (!sc) return;
    scannerRef.current = null;
    try {
      if (sc.isScanning) await sc.stop();
      sc.clear();
    } catch {}
    if (mountedRef.current) setScanning(false);
  }

  const stopScanner = useCallback(async () => {
    await doStop();
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!classId)  return setError('Please select a class first');
    if (scanning)  return;

    setError(''); setCameraErr(''); setResult(null);
    processingRef.current = false;
    setStarting(true);

    try {
      // Re-enumerate cameras — this triggers the permission dialog if not yet granted
      let camList = cameras;
      if (!camList.length) {
        try {
          camList = await Html5Qrcode.getCameras();
          if (!mountedRef.current) return;
          if (!camList?.length) {
            setCameraErr('No camera found. Make sure your device has a camera and this page is served over HTTPS.');
            setStarting(false);
            return;
          }
          setCameras(camList);
          const backIdx = camList.findIndex(c => /back|rear|environment/i.test(c.label));
          setActiveCamIdx(backIdx >= 0 ? backIdx : camList.length - 1);
          setPermState('granted');
        } catch (err) {
          if (!mountedRef.current) return;
          if (/permission|denied|notallowed/i.test(String(err).toLowerCase())) {
            setPermState('denied');
            setCameraErr('Camera permission denied. Please allow camera access in your browser settings and try again.');
          } else {
            setCameraErr(`Could not access camera: ${err.message || err}`);
          }
          setStarting(false);
          return;
        }
      }

      // Pick camera — use facingMode constraint which is more reliable than ID on mobile
      const selectedCam = camList[activeCamIdx] || camList[camList.length - 1];

      // Use facingMode when possible (works better on mobile)
      const isBackCam = /back|rear|environment/i.test(selectedCam.label) || activeCamIdx === camList.length - 1;
      const cameraConstraint = camList.length === 1
        ? { deviceId: selectedCam.id }           // only one camera — use ID
        : isBackCam
          ? { facingMode: 'environment' }         // back camera
          : { facingMode: 'user' };               // front camera

      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        cameraConstraint,
        SCAN_CONFIG,
        async (decodedText) => {
          // Debounce: ignore scan if we're already processing one
          if (processingRef.current) return;
          processingRef.current = true;

          try {
            const data  = await scanQR(decodedText, parseInt(classId));
            if (!mountedRef.current) return;

            const entry = {
              id:         Date.now(),
              name:       data.student?.name || 'Unknown',
              student_id: data.student?.student_id || '',
              time:       new Date().toLocaleTimeString(),
              success:    data.success,
              already:    data.alreadyMarked,
              message:    data.message || (data.error ? `Error: ${data.error}` : 'Unknown result'),
            };
            setResult(entry);
            setHistory(prev => [entry, ...prev.slice(0, 49)]);
          } catch (err) {
            if (mountedRef.current) {
              setResult({ id: Date.now(), name: '', student_id: '', time: new Date().toLocaleTimeString(), success: false, already: false, message: `Network error: ${err.message}` });
            }
          } finally {
            // Allow next scan after 2.5 seconds
            setTimeout(() => { processingRef.current = false; }, 2500);
          }
        },
        () => {} // frame-level decode errors are expected and noisy — suppress them
      );

      if (mountedRef.current) setScanning(true);

    } catch (err) {
      if (!mountedRef.current) return;
      scannerRef.current = null;

      const msg = String(err.message || err);
      if (/permission|denied|notallowed/i.test(msg.toLowerCase())) {
        setPermState('denied');
        setCameraErr('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (/notfound|devicenotfound/i.test(msg.toLowerCase())) {
        setCameraErr('No camera found on this device.');
      } else if (/https|secure/i.test(msg.toLowerCase())) {
        setCameraErr('Camera requires a secure connection (HTTPS). If you\'re using a local network, try accessing via HTTPS or use the deployed app.');
      } else {
        setCameraErr(`Camera error: ${msg}`);
      }
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  }, [classId, scanning, cameras, activeCamIdx]);

  /* ── Switch between cameras ── */
  async function switchCamera() {
    if (cameras.length < 2) return;
    await stopScanner();
    const nextIdx = (activeCamIdx + 1) % cameras.length;
    setActiveCamIdx(nextIdx);
    // Brief pause so the DOM clears before restarting
    setTimeout(() => startScanner(), 300);
  }

  /* ── Result banner ── */
  function ResultBanner({ entry }) {
    if (!entry) return null;
    const bg    = !entry.success ? '#fee2e2' : entry.already ? '#fef9c3' : '#dcfce7';
    const color = !entry.success ? '#991b1b' : entry.already ? '#854d0e' : '#3e6f5c';
    const border= !entry.success ? '#fca5a5' : entry.already ? '#fde68a' : '#c8e6c9';
    const icon  = !entry.success ? '❌'      : entry.already ? '⚠️'      : '✅';
    return (
      <div style={{ background: bg, color, borderRadius: '12px', padding: '1.25rem', textAlign: 'center', marginTop: '1rem', border: `1.5px solid ${border}`, transition: 'all .25s' }}>
        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{icon}</div>
        <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: '.5rem' }}>{entry.message}</div>
        {entry.student_id && <div style={{ opacity: .75, marginTop: '.2rem', fontSize: '.9rem' }}>ID: {entry.student_id}</div>}
        <div style={{ opacity: .6, fontSize: '.8rem', marginTop: '.2rem' }}>{entry.time}</div>
      </div>
    );
  }

  const camLabel = cameras[activeCamIdx]?.label || '';
  const isBack   = /back|rear|environment/i.test(camLabel);

  return (
    <div className="page" style={{ maxWidth: '640px' }}>
      <div className="page-header">
        <h1 className="page-title">📷 QR Scanner</h1>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {cameras.length > 1 && (
            <button className="btn btn-outline" onClick={switchCamera} title="Switch camera">
              {isBack ? '🤳 Front' : '📷 Back'}
            </button>
          )}
          {scanning && <button className="btn btn-danger" onClick={stopScanner}>⏹ Stop</button>}
        </div>
      </div>

      {/* Class selector */}
      <div className="card mb-2">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Class</label>
          <select
            value={classId}
            onChange={e => { setClassId(e.target.value); if (scanning) stopScanner(); }}
            disabled={scanning}
          >
            <option value="">— Select a class —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.subject ? ` · ${c.subject}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Permission denied help */}
      {permState === 'denied' && (
        <div className="alert alert-error" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div><strong>⚠ Camera permission denied</strong></div>
          <div style={{ marginTop: '.4rem', fontSize: '.82rem' }}>
            To fix this:<br />
            • <strong>Chrome/Android:</strong> tap the lock icon in the address bar → Site settings → Camera → Allow<br />
            • <strong>Safari/iOS:</strong> Settings → Safari → Camera → Allow<br />
            • <strong>Desktop Chrome:</strong> click the camera icon in the address bar → Always allow
          </div>
        </div>
      )}

      {error     && <div className="alert alert-error"><span>⚠</span> {error}</div>}
      {cameraErr && permState !== 'denied' && <div className="alert alert-error"><span>⚠</span> {cameraErr}</div>}

      {/* Camera viewport — always in DOM so Html5Qrcode can always find it */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#0a1f17', minHeight: '280px' }}>

          {/* Placeholder shown before camera starts */}
          {!scanning && !starting && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.6)', pointerEvents: 'none' }}>
              <div style={{ fontSize: '4rem' }}>🔲</div>
              <p style={{ marginTop: '.75rem', fontSize: '.9rem' }}>Camera will appear here</p>
            </div>
          )}

          {/* Starting spinner */}
          {starting && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.8)' }}>
              <div className="spinner" style={{ borderTopColor: '#449c72' }} />
              <p style={{ marginTop: '1rem', fontSize: '.9rem' }}>Starting camera…</p>
            </div>
          )}

          {/* THIS DIV must always be in the DOM for Html5Qrcode */}
          <div id={SCANNER_ID} style={{ width: '100%' }} />
        </div>

        {/* Scanning guide overlay */}
        {scanning && (
          <p className="text-center text-muted mt-1" style={{ fontSize: '.85rem' }}>
            🎯 Point at the student's QR code — hold steady
          </p>
        )}

        {/* Start button */}
        {!scanning && (
          <button
            className="btn btn-primary btn-lg w-full"
            style={{ justifyContent: 'center', marginTop: '1rem' }}
            onClick={startScanner}
            disabled={!classId || starting}
          >
            {starting ? '⏳ Starting…' : '🎥 Start Camera & Scan'}
          </button>
        )}
      </div>

      {/* HTTPS notice for local dev */}
      {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && (
        <div className="alert alert-warning mt-1">
          <span>⚠</span>
          Camera requires HTTPS. Access this app via the deployed URL or use <strong>localhost</strong> for local testing.
        </div>
      )}

      <ResultBanner entry={result} />

      {/* Session log */}
      {history.length > 0 && (
        <div className="card mt-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
            <span style={{ fontWeight: 700, color: '#3e6f5c' }}>Session Log — {history.length} scan{history.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setHistory([])}>Clear</button>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {history.map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span style={{ marginRight: '.4rem' }}>
                    {entry.success ? (entry.already ? '⚠️' : '✅') : '❌'}
                  </span>
                  <strong>{entry.name}</strong>
                  {entry.student_id && <span className="text-muted" style={{ fontSize: '.8rem', marginLeft: '.35rem' }}>({entry.student_id})</span>}
                </div>
                <span className="text-muted" style={{ fontSize: '.8rem', whiteSpace: 'nowrap', marginLeft: '.5rem' }}>{entry.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
