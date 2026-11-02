import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getClasses, scanQR } from '../api';

const SCANNER_ID = 'qr-reader';

export default function ScannerPage() {
  const [classes, setClasses]     = useState([]);
  const [classId, setClassId]     = useState('');
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState(null);
  const [history, setHistory]     = useState([]);
  const [error, setError]         = useState('');
  const [cameraErr, setCameraErr] = useState('');
  const scannerRef   = useRef(null);
  const processingRef = useRef(false);

  useEffect(() => {
    getClasses().then(data => {
      setClasses(data);
      if (data.length === 1) setClassId(String(data[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => () => { stopScanner(); }, []); // eslint-disable-line

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!classId) return setError('Please select a class first');
    setError(''); setCameraErr(''); setResult(null);
    processingRef.current = false;

    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras?.length) return setCameraErr('No camera found on this device');

      const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];

      await scanner.start(
        cam.id,
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;

          const data  = await scanQR(decodedText, parseInt(classId));
          const entry = {
            id:         Date.now(),
            name:       data.student?.name || 'Unknown',
            student_id: data.student?.student_id || '',
            time:       new Date().toLocaleTimeString(),
            success:    data.success,
            already:    data.alreadyMarked,
            message:    data.message
          };
          setResult(entry);
          setHistory(prev => [entry, ...prev.slice(0, 49)]);
          setTimeout(() => { processingRef.current = false; }, 2000);
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      setCameraErr(`Camera error: ${err.message || err}`);
      scannerRef.current = null;
    }
  }, [classId]);

  function ResultBanner({ entry }) {
    if (!entry) return null;
    const bg   = !entry.success ? '#fee2e2' : entry.already ? '#fef9c3' : '#dcfce7';
    const color= !entry.success ? '#991b1b' : entry.already ? '#854d0e' : '#3e6f5c';
    const icon = !entry.success ? '❌' : entry.already ? '⚠️' : '✅';
    return (
      <div style={{ background: bg, color, borderRadius: '12px', padding: '1.25rem', textAlign: 'center', marginTop: '1rem', border: `1.5px solid ${!entry.success ? '#fca5a5' : entry.already ? '#fde68a' : '#c8e6c9'}` }}>
        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{icon}</div>
        <div style={{ fontWeight: 700, fontSize: '1.15rem', marginTop: '.5rem' }}>{entry.message}</div>
        {entry.student_id && <div style={{ opacity: .75, marginTop: '.2rem', fontSize: '.9rem' }}>ID: {entry.student_id}</div>}
        <div style={{ opacity: .6, fontSize: '.8rem', marginTop: '.2rem' }}>{entry.time}</div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '640px' }}>
      <div className="page-header">
        <h1 className="page-title">📷 QR Scanner</h1>
        {scanning && <button className="btn btn-danger" onClick={stopScanner}>⏹ Stop</button>}
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

      {error     && <div className="alert alert-error"><span>⚠</span> {error}</div>}
      {cameraErr && <div className="alert alert-error"><span>⚠</span> {cameraErr}</div>}

      {/* Camera viewport */}
      <div className="card" style={{ padding: '1rem' }}>
        <div
          id={SCANNER_ID}
          style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#0a1f17', minHeight: scanning ? undefined : '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {!scanning && (
            <div className="text-center" style={{ color: 'rgba(255,255,255,.6)', padding: '2rem' }}>
              <div style={{ fontSize: '4rem' }}>🔲</div>
              <p style={{ marginTop: '.75rem', fontSize: '.9rem' }}>Camera will appear here</p>
            </div>
          )}
        </div>

        {!scanning ? (
          <button
            className="btn btn-primary btn-lg w-full"
            style={{ justifyContent: 'center', marginTop: '1rem' }}
            onClick={startScanner}
            disabled={!classId}
          >
            🎥 Start Camera &amp; Scan
          </button>
        ) : (
          <p className="text-center text-muted mt-1" style={{ fontSize: '.85rem' }}>
            Point the camera at a student's QR code
          </p>
        )}
      </div>

      <ResultBanner entry={result} />

      {/* Session log */}
      {history.length > 0 && (
        <div className="card mt-2">
          <div style={{ fontWeight: 700, color: '#3e6f5c', marginBottom: '.75rem' }}>
            Session Log — {history.length} scan{history.length !== 1 ? 's' : ''}
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
