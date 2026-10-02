/**
 * FuelTrack - Main Application Orchestrator
 * Coordinates form input handling, event listeners, router navigation,
 * and initializes all system modules on page load.
 */
'use strict';

/**
 * Handle Add/Edit Fuel Entry Form submission with comprehensive validation
 */
function handleFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const dateVal = document.getElementById('field-date').value;
  const odoVal = parseFloat(document.getElementById('field-odometer').value);
  const volVal = parseFloat(document.getElementById('field-volume').value);
  const costVal = parseFloat(document.getElementById('field-cost').value);
  const isFullTank = document.getElementById('field-fulltank').checked;
  const stationVal = document.getElementById('field-station').value.trim();
  const fuelTypeVal = document.getElementById('field-fueltype').value.trim();
  const notesVal = document.getElementById('field-notes').value.trim();

  let hasErrors = false;

  // 1. Date Validation
  if (!dateVal) {
    document.getElementById('field-date').classList.add('has-error');
    document.getElementById('err-date').classList.add('visible');
    hasErrors = true;
  }

  // 2. Odometer Validation
  const sorted = records.slice().sort((a, b) => (Number(a.odometer) || 0) - (Number(b.odometer) || 0));

  if (isNaN(odoVal) || odoVal < 0) {
    document.getElementById('field-odometer').classList.add('has-error');
    document.getElementById('err-odometer').textContent = 'Please enter a valid odometer number.';
    document.getElementById('err-odometer').classList.add('visible');
    hasErrors = true;
  } else {
    if (editingRecordId) {
      const editIdx = sorted.findIndex(r => r.id === editingRecordId);
      const prev = editIdx > 0 ? sorted[editIdx - 1] : null;
      const next = editIdx < sorted.length - 1 ? sorted[editIdx + 1] : null;

      if (prev && odoVal <= Number(prev.odometer)) {
        document.getElementById('field-odometer').classList.add('has-error');
        document.getElementById('err-odometer').textContent = `Must be greater than previous entry (${Number(prev.odometer).toLocaleString()} ${prefs.distanceUnit}).`;
        document.getElementById('err-odometer').classList.add('visible');
        hasErrors = true;
      } else if (next && odoVal >= Number(next.odometer)) {
        document.getElementById('field-odometer').classList.add('has-error');
        document.getElementById('err-odometer').textContent = `Must be less than next entry (${Number(next.odometer).toLocaleString()} ${prefs.distanceUnit}).`;
        document.getElementById('err-odometer').classList.add('visible');
        hasErrors = true;
      }
    } else {
      if (sorted.length > 0) {
        const last = sorted[sorted.length - 1];
        if (odoVal <= Number(last.odometer)) {
          document.getElementById('field-odometer').classList.add('has-error');
          document.getElementById('err-odometer').textContent = `Must be greater than last entry (${Number(last.odometer).toLocaleString()} ${prefs.distanceUnit}).`;
          document.getElementById('err-odometer').classList.add('visible');
          hasErrors = true;
        }
      }
    }
  }

  // 3. Volume Validation
  if (isNaN(volVal) || volVal <= 0) {
    document.getElementById('field-volume').classList.add('has-error');
    document.getElementById('err-volume').classList.add('visible');
    hasErrors = true;
  }

  // 4. Cost Validation
  if (isNaN(costVal) || costVal <= 0) {
    document.getElementById('field-cost').classList.add('has-error');
    document.getElementById('err-cost').classList.add('visible');
    hasErrors = true;
  }

  if (hasErrors) {
    showToast('Please correct form errors before saving', 'error');
    return;
  }

  // Build standard record object
  const recordPayload = {
    id: editingRecordId || generateUUID(),
    date: dateVal,
    odometer: odoVal,
    volume: volVal,
    totalCost: costVal,
    isFullTank: Boolean(isFullTank),
    fuelType: fuelTypeVal || 'Regular 95',
    station: stationVal || '',
    notes: notesVal || ''
  };

  if (editingRecordId) {
    const index = records.findIndex(r => r.id === editingRecordId);
    if (index !== -1) {
      records[index] = recordPayload;
      saveRecords();
      showToast('Fill-up record updated!', 'success');
    }
  } else {
    records.push(recordPayload);
    saveRecords();
    showToast('Fill-up recorded successfully!', 'success');
  }

  editingRecordId = null;
  setupFormDefaults();
  switchView('records');
}

/**
 * Reset all active search and date filters
 */
function clearAllFilters() {
  filters.search = '';
  filters.startDate = '';
  filters.endDate = '';
  document.getElementById('search-input').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('btn-search-clear').classList.remove('visible');
  renderRecords();
}

/**
 * Bind all interactive UI event handlers
 */
function setupEventListeners() {
  // Bottom Navigation Switching
  document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      if (targetView === 'add' && editingRecordId) {
        editingRecordId = null;
        setupFormDefaults();
      }
      switchView(targetView);
    });
  });

  // Top App Bar Theme Toggle
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleThemeHeader);

  // System Theme Preference Change
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (prefs.theme === 'system') {
        applyTheme('system');
      }
    });
  }

  // Form Submission & Live Input Calculators
  document.getElementById('fuel-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('field-volume').addEventListener('input', updateUnitPriceLive);
  document.getElementById('field-cost').addEventListener('input', updateUnitPriceLive);

  // Cancel Edit Button
  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    editingRecordId = null;
    setupFormDefaults();
    switchView('records');
  });

  // Optional Fields Accordion Toggle
  const accordionBtn = document.getElementById('btn-toggle-accordion');
  const accordionContent = document.getElementById('accordion-optional-fields');
  accordionBtn.addEventListener('click', () => {
    const isOpen = accordionContent.classList.toggle('open');
    accordionBtn.classList.toggle('open', isOpen);
    accordionBtn.setAttribute('aria-expanded', String(isOpen));
  });

  // Quick Fuel Grade Chips
  document.querySelectorAll('.chip-group .chip-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      document.getElementById('field-fueltype').value = val;
      document.querySelectorAll('.chip-group .chip-btn[data-val]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Search & Date Filter Inputs
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('btn-search-clear');
  const startDateInput = document.getElementById('filter-start-date');
  const endDateInput = document.getElementById('filter-end-date');

  searchInput.addEventListener('input', () => {
    filters.search = searchInput.value;
    searchClear.classList.toggle('visible', Boolean(searchInput.value));
    renderRecords();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    filters.search = '';
    searchClear.classList.remove('visible');
    renderRecords();
  });

  startDateInput.addEventListener('change', () => {
    filters.startDate = startDateInput.value;
    renderRecords();
  });

  endDateInput.addEventListener('change', () => {
    filters.endDate = endDateInput.value;
    renderRecords();
  });

  document.getElementById('btn-clear-all-filters').addEventListener('click', clearAllFilters);

  // Settings: Currency Preset Selection
  document.querySelectorAll('#currency-chip-group .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prefs.currencySymbol = btn.getAttribute('data-curr');
      savePrefs();
      updateSettingsUI();
      renderDashboard();
      showToast(`Currency updated to ${prefs.currencySymbol}`, 'success');
    });
  });

  // Settings: Custom Currency Input
  document.getElementById('setting-custom-currency').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    if (val) {
      prefs.currencySymbol = val;
      savePrefs();
      updateSettingsUI();
      renderDashboard();
      showToast(`Custom currency set to ${prefs.currencySymbol}`, 'success');
    }
  });

  // Settings: Unit System Switcher (Metric vs Imperial)
  document.querySelectorAll('#seg-unit-system .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sys = btn.getAttribute('data-system');
      if (sys === 'metric') {
        prefs.distanceUnit = 'km';
        prefs.volumeUnit = 'L';
        prefs.efficiencyFormat = 'km/L';
      } else {
        prefs.distanceUnit = 'miles';
        prefs.volumeUnit = 'gal';
        prefs.efficiencyFormat = 'MPG';
      }
      savePrefs();
      updateSettingsUI();
      renderDashboard();
      renderRecords();
      showToast(`Switched to ${sys.toUpperCase()} units`, 'success');
    });
  });

  // Settings: Efficiency Format Selector
  document.querySelectorAll('#seg-efficiency-format .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prefs.efficiencyFormat = btn.getAttribute('data-eff');
      savePrefs();
      updateSettingsUI();
      renderDashboard();
      renderRecords();
      showToast(`Efficiency format: ${prefs.efficiencyFormat}`, 'success');
    });
  });

  // Settings: Theme Mode Selector
  document.querySelectorAll('#seg-theme-mode .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prefs.theme = btn.getAttribute('data-theme');
      savePrefs();
      applyTheme(prefs.theme);
      updateSettingsUI();
      showToast(`Theme mode set to ${prefs.theme}`, 'success');
    });
  });

  // Settings: Backup & Restore Actions
  document.getElementById('btn-export-json').addEventListener('click', exportJSONBackup);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSVBackup);
  document.getElementById('btn-trigger-import').addEventListener('click', () => {
    document.getElementById('file-import-json').click();
  });
  document.getElementById('file-import-json').addEventListener('change', handleFileImport);
  document.getElementById('btn-load-sample').addEventListener('click', loadSampleData);
  document.getElementById('btn-factory-reset').addEventListener('click', promptFactoryReset);

  // Modal Backdrop Click & Escape Key Dismiss
  document.getElementById('app-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'app-modal-backdrop') closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/**
 * Bootstraps the application state and UI
 */
function initApp() {
  loadStorageData();
  applyTheme(prefs.theme);
  generatePwaManifestAndIcons();
  initPwaServices();
  setupFormDefaults();
  setupEventListeners();
  updateSettingsUI();
  switchView('dashboard');
}

// Start application when DOM is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
