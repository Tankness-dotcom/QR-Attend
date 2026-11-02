import React, { useState, useEffect } from 'react';
import { getStudentQR } from '../api';

export default function QRCodeDisplay({ student, onClose }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentQR(student.id)
      .then(setQrData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [student.id]);

  function handlePrint() {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>QR — ${qrData.student_name}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; text-align: center; padding: 2.5rem; background: #fff; }
        .logo { width: 70px; height: 70px; object-fit: contain; margin: 0 auto .75rem; display: block; }
        .app-name { color: #449c72; font-size: 1rem; font-weight: 800; letter-spacing: .05em; }
        .app-sub  { color: #5a8070; font-size: .8rem; margin-bottom: 1.5rem; }
        img.qr { width: 280px; height: 280px; border-radius: 12px; border: 2px solid #c8e6c9; display: block; margin: 0 auto 1rem; }
        h2 { font-size: 1.3rem; color: #3e6f5c; margin-bottom: .25rem; }
        p  { color: #5a8070; font-size: .9rem; }
        .footer { margin-top: 1.5rem; font-size: .72rem; color: #9ca3af; word-break: break-all; }
      </style></head>
      <body>
        <img class="logo" src="${window.location.origin}/qrattend-logo.png" alt="QR-Attend" />
        <div class="app-name">QR-ATTEND</div>
        <div class="app-sub">Attendance Management System</div>
        <img class="qr" src="${qrData.qr}" alt="QR Code" />
        <h2>${qrData.student_name}</h2>
        <p>Student ID: ${qrData.student_id}</p>
        <div class="footer">Scan this QR code for daily attendance · Token: ${qrData.qr_token}</div>
      </body></html>
    `);
    w.document.close(); w.focus(); w.print(); w.close();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '360px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1.25rem', justifyContent: 'center' }}>
          <img
            src="/qrattend-logo.png"
            alt="QR-Attend"
            style={{ width: '36px', height: '36px', objectFit: 'contain' }}
          />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '.95rem', color: '#449c72' }}>QR-Attend</div>
            <div style={{ fontSize: '.7rem', color: '#5a8070' }}>Student QR Code</div>
          </div>
        </div>

        {loading ? (
          <div className="center" style={{ padding: '3rem 0' }}><div className="spinner" /></div>
        ) : qrData ? (
          <div>
            <img
              src={qrData.qr}
              alt={`QR for ${qrData.student_name}`}
              style={{ width: '230px', height: '230px', borderRadius: '12px', border: '3px solid #c8e6c9', display: 'block', margin: '0 auto' }}
            />
            <h3 style={{ marginTop: '1rem', fontWeight: 800, color: '#3e6f5c' }}>{qrData.student_name}</h3>
            <p className="text-muted">ID: {qrData.student_id}</p>

            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', marginTop: '1.25rem' }}>
              <a href={qrData.qr} download={`QRAttend-${qrData.student_id}.png`} className="btn btn-outline">
                ⬇ Download
              </a>
              <button className="btn btn-primary" onClick={handlePrint}>🖨 Print</button>
            </div>

            <div style={{ marginTop: '1rem', background: '#f0faf5', borderRadius: '8px', padding: '.6rem', fontSize: '.72rem', color: '#5a8070', wordBreak: 'break-all' }}>
              Token: {qrData.qr_token}
            </div>
          </div>
        ) : (
          <p className="text-muted">Failed to load QR code</p>
        )}
      </div>
    </div>
  );
}
