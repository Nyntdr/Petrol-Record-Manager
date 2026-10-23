/**
 * FuelTrack - PWA & Offline Service Module
 * Manages Service Worker registration, manifest support, canvas PNG caching,
 * install prompt handling (Android/Chromium & iOS), and offline state.
 */
'use strict';

// Global reference for deferred install prompt
window.deferredPwaPrompt = null;
let pwaInstallDismissed = false;

/**
 * Check if the application is currently running as an installed PWA
 */
function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if current browser is iOS Safari
 */
function isIosBrowser() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !isRunningStandalone();
}

/**
 * Check if the app is currently using the desktop layout (>= 768px)
 */
function isDesktopViewport() {
  return window.matchMedia('(min-width: 768px)').matches;
}

/**
 * Verify and ensure PWA icons and meta tags are loaded
 */
function verifyPwaIcons() {
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '180x180';
    appleIcon.href = 'icons/apple-touch-icon.png';
    document.head.appendChild(appleIcon);
  }
}

/**
 * Update PWA UI elements according to installation state
 */
function updatePwaUiState() {
  const isInstalled = isRunningStandalone();
  const topInstallBtn = document.getElementById('btn-top-install');
  const sidebarInstallBtn = document.getElementById('btn-sidebar-install');
  const banner = document.getElementById('pwa-install-banner');
  const settingsCard = document.getElementById('settings-pwa-card');
  const settingsBadge = document.getElementById('pwa-status-badge');
  const settingsBtn = document.getElementById('btn-settings-install');
  const settingsBtnText = document.getElementById('btn-settings-install-text');
  const settingsDesc = document.getElementById('pwa-status-description');

  if (isInstalled) {
    // App is running standalone
    if (topInstallBtn) topInstallBtn.style.display = 'none';
    if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
    if (banner) banner.style.display = 'none';

    if (settingsBadge) {
      settingsBadge.textContent = 'Installed (Standalone)';
      settingsBadge.className = 'pwa-badge badge-installed';
    }
    if (settingsBtn) {
      settingsBtn.disabled = true;
      settingsBtn.style.opacity = '0.7';
    }
    if (settingsBtnText) {
      settingsBtnText.textContent = 'FuelTrack is Installed';
    }
    if (settingsDesc) {
      settingsDesc.textContent = 'FuelTrack is running as a standalone installed app with full offline support and persistent local storage.';
    }
  } else {
    // App is running inside a web browser
    if (topInstallBtn) topInstallBtn.style.display = 'inline-flex';
    if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'inline-flex';
    
    // Show banner on mobile/tablet viewports unless user dismissed it this session
    if (banner) {
      banner.style.display = (!pwaInstallDismissed && !isDesktopViewport()) ? 'flex' : 'none';
    }

    if (settingsBadge) {
      settingsBadge.textContent = 'Web Browser';
      settingsBadge.className = 'pwa-badge badge-browser';
    }
    if (settingsBtn) {
      settingsBtn.disabled = false;
      settingsBtn.style.opacity = '1';
    }
    if (settingsBtnText) {
      settingsBtnText.textContent = 'Install FuelTrack App';
    }
    if (settingsDesc) {
      settingsDesc.textContent = 'Install FuelTrack on your home screen for quick 1-tap launch, offline tracking, and a native app experience without browser bars.';
    }
  }
}

/**
 * Handle user install request from any button (header, banner, settings)
 */
function promptPwaInstall() {
  if (isRunningStandalone()) {
    showToast('FuelTrack is already installed on this device!', 'info');
    return;
  }

  // 1. If standard beforeinstallprompt is ready (Chrome / Android / Edge)
  if (window.deferredPwaPrompt) {
    window.deferredPwaPrompt.prompt();
    window.deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('FuelTrack is installing! Look in your apps or home screen.', 'success');
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
      } else {
        showToast('Installation cancelled', 'info');
      }
      window.deferredPwaPrompt = null;
      updatePwaUiState();
    }).catch(err => {
      console.warn('Install prompt error:', err);
    });
    return;
  }

  // 2. If iOS Safari
  if (isIosBrowser()) {
    showIosInstallInstructions();
    return;
  }

  // 3. Fallback instructions for other mobile or desktop browsers
  showGenericInstallInstructions();
}

/**
 * Display modal instructions for iOS Safari users
 */
function showIosInstallInstructions() {
  const content = `
    <div class="ios-install-guide">
      <p style="margin-bottom:14px; font-size:0.9rem; color:var(--text-main); line-height:1.5;">
        To install <strong>FuelTrack</strong> on your iPhone or iPad:
      </p>
      <ol style="margin-left:18px; margin-bottom:16px; font-size:0.86rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px; line-height:1.4;">
        <li>
          Tap the <strong>Share</strong> button <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> at the bottom of Safari.
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong> <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-2px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>.
        </li>
        <li>
          Tap <strong>Add</strong> in the top right corner.
        </li>
      </ol>
      <p style="font-size:0.78rem; color:var(--text-muted);">
        FuelTrack will be added directly to your home screen with offline functionality!
      </p>
    </div>
  `;

  openModal({
    title: 'Install FuelTrack on iOS',
    bodyHtml: content,
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    buttons: [
      {
        text: 'Got It',
        class: 'btn-primary',
        onClick: closeModal
      }
    ]
  });
}

/**
 * Display modal instructions for generic browsers where prompt is not automatically triggered
 */
function showGenericInstallInstructions() {
  const content = `
    <div style="font-size:0.88rem; color:var(--text-secondary); line-height:1.5;">
      <p style="margin-bottom:12px;">
        To install <strong>FuelTrack</strong> as a Progressive Web App on your device:
      </p>
      <ul style="margin-left:18px; margin-bottom:14px; display:flex; flex-direction:column; gap:8px;">
        <li><strong>On Mobile Chrome/Firefox/Samsung:</strong> Tap the menu (⋮) in the top right corner and tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
        <li><strong>On Desktop Chrome/Edge:</strong> Click the install icon <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> in the right side of the address bar.</li>
      </ul>
      <p style="font-size:0.8rem; color:var(--text-muted);">
        Once installed, FuelTrack runs offline without internet access.
      </p>
    </div>
  `;

  openModal({
    title: 'Install FuelTrack',
    bodyHtml: content,
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    buttons: [
      {
        text: 'Close',
        class: 'btn-secondary',
        onClick: closeModal
      }
    ]
  });
}

/**
 * Dismiss the top install banner for current session
 */
function dismissPwaBanner() {
  pwaInstallDismissed = true;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * Initialize PWA services, SW registration, and event listeners
 */
function initPwaServices() {
  // Capture beforeinstallprompt event for Android / Chrome / Edge
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPwaPrompt = e;
    console.log('PWA beforeinstallprompt captured successfully.');
    updatePwaUiState();
  });

  // App installed listener
  window.addEventListener('appinstalled', () => {
    window.deferredPwaPrompt = null;
    updatePwaUiState();
    showToast('FuelTrack is installed and ready on your home screen!', 'success');
  });

  // Listen for display-mode changes (e.g. user installs or opens in window)
  try {
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', () => {
      updatePwaUiState();
    });
  } catch (e) {}

  // Re-evaluate the banner when crossing the mobile/desktop breakpoint
  try {
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    desktopQuery.addEventListener('change', () => {
      updatePwaUiState();
    });
  } catch (e) {}

  // Request persistent storage to protect local fuel records from eviction
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persisted => {
      if (persisted) console.log('Storage eviction protection: ACTIVE');
    }).catch(e => console.warn('Storage persist error:', e));
  }

  // Register relative Service Worker
  if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.protocol === 'file:')) {
    try {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('FuelTrack Service Worker registered scope:', reg.scope);
      }).catch(err => {
        console.warn('Service Worker registration skipped or failed:', err);
      });
    } catch (e) {
      console.warn('Service Worker not supported or restricted:', e);
    }
  }

  // Verify static icons and meta tags
  verifyPwaIcons();

  // Initial UI check
  updatePwaUiState();
}
