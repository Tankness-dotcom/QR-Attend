import React, { useRef } from 'react';

/**
 * AvatarUpload
 * Props:
 *   photo      — current base64 data URL or null
 *   name       — display name (used for initials fallback)
 *   size       — pixel size of the circle (default 88)
 *   onUpload   — async fn(base64DataUrl) called when user picks a file
 *   onRemove   — async fn() called when user removes photo
 *   editable   — boolean, show edit overlay (default true)
 */
export default function AvatarUpload({
  photo, name = '', size = 88, onUpload, onRemove, editable = true
}) {
  const inputRef = useRef();

  /* Generate initials from name */
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image file.');
    if (file.size > 3_000_000) return alert('Image must be under 3 MB.');

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Compress via canvas before storing
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        onUpload && onUpload(compressed);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  const fontSize = Math.round(size * 0.35);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Circle */}
      <div
        onClick={() => editable && inputRef.current?.click()}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: photo ? 'transparent' : 'linear-gradient(135deg, #3e6f5c, #449c72)',
          border: '3px solid #c8e6c9',
          boxShadow: '0 4px 14px rgba(68,156,114,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          cursor: editable ? 'pointer' : 'default',
          flexShrink: 0,
          position: 'relative',
          transition: 'box-shadow .15s',
        }}
      >
        {photo ? (
          <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#fff', fontWeight: 700, fontSize, letterSpacing: '.02em' }}>
            {initials || '?'}
          </span>
        )}

        {/* Hover overlay */}
        {editable && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.38)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity .18s',
            borderRadius: '50%',
            fontSize: Math.round(size * 0.28),
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            📷
          </div>
        )}
      </div>

      {/* Remove button — only shown when there's a photo */}
      {editable && photo && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove photo"
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: Math.round(size * 0.32), height: Math.round(size * 0.32),
            borderRadius: '50%',
            background: '#dc2626', color: '#fff', border: '2px solid #fff',
            cursor: 'pointer', fontSize: Math.round(size * 0.14),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}

      {/* Hidden file input */}
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      )}
    </div>
  );
}
