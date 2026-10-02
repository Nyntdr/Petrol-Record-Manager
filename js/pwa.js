/**
 * FuelTrack - PWA & Offline Service Module
 * Dynamically synthesizes PWA manifest with canvas-rendered PNG icons,
 * registers the relative Service Worker, and activates persistent storage.
 */
'use strict';

/**
 * Generate and inject a Web App Manifest with 192x192 and 512x512 icons
 */
function generatePwaManifestAndIcons() {
  try {
    function createFuelIconDataUrl(size) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Rounded container
      const radius = size * 0.22;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fill();

      // Emerald glow
      const grad = ctx.createLinearGradient(size * 0.2, size * 0.2, size * 0.8, size * 0.8);
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(1, '#06b6d4');

      // Stylized fuel pump
      const s = size / 24;
      ctx.fillStyle = grad;
      ctx.strokeStyle = grad;
      ctx.lineWidth = s * 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.rect(5 * s, 4 * s, 8 * s, 16 * s);
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(6.5 * s, 7 * s, 5 * s, 4 * s);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(13 * s, 10 * s);
      ctx.lineTo(16.5 * s, 10 * s);
      ctx.quadraticCurveTo(18.5 * s, 10 * s, 18.5 * s, 13 * s);
      ctx.lineTo(18.5 * s, 17 * s);
      ctx.stroke();

      return canvas.toDataURL('image/png');
    }

    const icon192 = createFuelIconDataUrl(192);
    const icon512 = createFuelIconDataUrl(512);

    if (icon192) {
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = icon192;
      document.head.appendChild(appleIcon);
    }

    const manifestObj = {
      name: 'FuelTrack - Vehicle Fuel Manager',
      short_name: 'FuelTrack',
      description: 'Track fuel fill-ups, mileage, and vehicle running expenses completely offline.',
      start_url: './index.html',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#1e293b',
      background_color: '#0f172a',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestUrl;
    document.head.appendChild(manifestLink);
  } catch (err) {
    console.warn('Dynamic PWA manifest generation notice:', err);
  }
}

/**
 * Activate persistent storage and register relative Service Worker
 */
function initPwaServices() {
  // Storage persistence to avoid browser eviction
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persisted => {
      if (persisted) console.log('Storage eviction protection: ACTIVE');
    }).catch(e => console.warn('Storage persist error:', e));
  }

  // Relative Service Worker Registration (safe for file:// and HTTPS/localhost)
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    try {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('FuelTrack Service Worker registered:', reg.scope);
      }).catch(err => {
        console.warn('Service Worker registration skipped or failed:', err);
      });
    } catch (e) {
      console.warn('Service Worker not supported or restricted:', e);
    }
  }
}
