/**
 * FuelTrack - Backup, Import & Export Module
 * Handles JSON backup, CSV spreadsheet export with RFC 4180 quoting,
 * schema validation for file imports, and sample data population.
 */
'use strict';

/**
 * Export all records to a clean JSON file
 */
function exportJSONBackup() {
  if (records.length === 0) {
    showToast('No fuel records to export!', 'error');
    return;
  }
  const dateStr = new Date().toISOString().split('T')[0];
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `fuel_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('JSON backup exported successfully', 'success');
}

/**
 * Export all records with calculated mileage delta & efficiency to CSV
 */
function exportCSVBackup() {
  if (records.length === 0) {
    showToast('No fuel records to export!', 'error');
    return;
  }
  const calcRecords = computeCalculatedRecords(records);
  const dateStr = new Date().toISOString().split('T')[0];

  const headers = [
    'ID',
    'Date',
    `Odometer (${prefs.distanceUnit})`,
    `Distance Delta (${prefs.distanceUnit})`,
    `Volume (${prefs.volumeUnit})`,
    'Total Cost',
    `Unit Price (${prefs.currencySymbol}/${prefs.volumeUnit})`,
    'Is Full Tank',
    'Fuel Efficiency',
    'Efficiency Unit',
    'Fuel Grade',
    'Station',
    'Notes'
  ];

  const csvRows = [headers.map(h => `"${h}"`).join(',')];

  calcRecords.forEach(rec => {
    const eff = formatEfficiencyValue(rec);
    const effValue = eff.value !== undefined ? eff.value.toFixed(2) : eff.text;
    const effUnit = eff.unit || '';

    const row = [
      rec.id,
      rec.date,
      rec.odometer,
      rec.deltaOdo || 0,
      rec.volume,
      rec.totalCost,
      rec.unitPrice ? rec.unitPrice.toFixed(2) : 0,
      rec.isFullTank ? 'TRUE' : 'FALSE',
      effValue,
      effUnit,
      rec.fuelType || '',
      rec.station || '',
      rec.notes || ''
    ];

    // RFC 4180: double quotes inside fields are escaped as ""
    const escapedRow = row.map(val => {
      const stringVal = String(val === null || val === undefined ? '' : val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    });

    csvRows.push(escapedRow.join(','));
  });

  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', `fuel_records_${dateStr}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
  showToast('CSV spreadsheet exported successfully', 'success');
}

/**
 * Handle JSON file upload and validation
 */
function handleFileImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      let candidateRecords = [];

      if (Array.isArray(parsed)) {
        candidateRecords = parsed;
      } else if (parsed && Array.isArray(parsed.records)) {
        candidateRecords = parsed.records;
      } else {
        throw new Error('Imported JSON is not an array of records.');
      }

      // Schema validation
      const validRecords = [];
      for (let i = 0; i < candidateRecords.length; i++) {
        const item = candidateRecords[i];
        if (!item || typeof item !== 'object') continue;

        const odo = Number(item.odometer);
        const vol = Number(item.volume);
        const cost = Number(item.totalCost);

        if (isNaN(odo) || isNaN(vol) || isNaN(cost) || !item.date) {
          console.warn('Skipping invalid item in import:', item);
          continue;
        }

        validRecords.push({
          id: item.id ? String(item.id) : generateUUID(),
          date: String(item.date),
          odometer: odo,
          volume: vol,
          totalCost: cost,
          isFullTank: Boolean(item.isFullTank),
          fuelType: String(item.fuelType || 'Regular 95'),
          station: String(item.station || ''),
          notes: String(item.notes || '')
        });
      }

      if (validRecords.length === 0) {
        showToast('No valid fuel records found in file!', 'error');
        return;
      }

      openImportDecisionModal(validRecords);

    } catch (err) {
      console.error('Import parse error:', err);
      showToast('Failed to parse JSON backup file!', 'error');
    } finally {
      event.target.value = ''; // Reset input
    }
  };
  reader.readAsText(file);
}

/**
 * Display modal offering Merge vs Overwrite import strategies
 */
function openImportDecisionModal(importedRecords) {
  const modal = document.getElementById('app-modal-backdrop');
  const icon = document.getElementById('modal-icon-container');
  const title = document.getElementById('modal-title-text');
  const body = document.getElementById('modal-body-text');
  const footer = document.getElementById('modal-footer-buttons');

  icon.className = 'modal-icon-wrap info';
  icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  title.textContent = 'Import Fuel Records';
  body.innerHTML = `
    Found <strong>${importedRecords.length}</strong> valid fuel records in the file.<br><br>
    Choose how you would like to proceed:
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-secondary" id="btn-modal-merge">Merge (Skip Duplicates)</button>
    <button type="button" class="btn btn-primary" id="btn-modal-overwrite">Overwrite All</button>
  `;

  document.getElementById('btn-modal-merge').onclick = function() {
    const existingIds = new Set(records.map(r => r.id));
    let addedCount = 0;
    importedRecords.forEach(rec => {
      if (!existingIds.has(rec.id)) {
        records.push(rec);
        existingIds.add(rec.id);
        addedCount++;
      }
    });
    saveRecords();
    closeModal();
    showToast(`Imported ${addedCount} records (${importedRecords.length - addedCount} duplicates skipped)`, 'success');
    switchView('records');
  };

  document.getElementById('btn-modal-overwrite').onclick = function() {
    records = importedRecords;
    saveRecords();
    closeModal();
    showToast(`Replaced data with ${importedRecords.length} imported records`, 'success');
    switchView('records');
  };

  modal.classList.add('open');
}

/**
 * Load 4 realistic sequential fill-ups for demonstration & testing
 */
function loadSampleData() {
  const sample = [
    {
      id: 'sample_01',
      date: '2026-09-05T08:30',
      odometer: 44500.0,
      volume: 42.0,
      totalCost: 67.20,
      isFullTank: true,
      fuelType: 'Regular 95',
      station: 'Shell Central',
      notes: 'Baseline full tank - city commute'
    },
    {
      id: 'sample_02',
      date: '2026-09-14T17:15',
      odometer: 45020.0,
      volume: 38.5,
      totalCost: 61.60,
      isFullTank: true,
      fuelType: 'Regular 95',
      station: 'BP Highway 1',
      notes: 'Weekend road trip (520 km traveled)'
    },
    {
      id: 'sample_03',
      date: '2026-09-22T12:45',
      odometer: 45280.0,
      volume: 18.0,
      totalCost: 29.16,
      isFullTank: false,
      fuelType: 'Premium 98',
      station: 'TotalEnergies',
      notes: 'Quick partial top-up before mountain pass'
    },
    {
      id: 'sample_04',
      date: '2026-10-01T09:00',
      odometer: 45710.0,
      volume: 34.2,
      totalCost: 55.40,
      isFullTank: true,
      fuelType: 'Regular 95',
      station: 'Shell Central',
      notes: 'Filled to full (mileage combines previous partial)'
    }
  ];

  records = sample;
  saveRecords();
  showToast('Sample demo data loaded (4 fill-ups)!', 'success');
  switchView('dashboard');
}
