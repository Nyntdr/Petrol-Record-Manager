/**
 * FuelTrack - UI & View Rendering Module
 * Manages view switching, card rendering, responsive SVG charts,
 * themes, toast notifications, and modal dialogs.
 */
'use strict';

/**
 * Render the Dashboard view with statistics, extremes, and spending chart
 */
function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  const calcRecords = computeCalculatedRecords(records);

  // Empty state if fewer than 2 records
  if (calcRecords.length < 2) {
    const totalSpentSoFar = records.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);

    container.innerHTML = `
      <div class="hero-stat-card">
        <div class="hero-label">Total Fuel Expenditure</div>
        <div class="hero-value">${formatCurrency(totalSpentSoFar)}</div>
        <div class="hero-sub">
          <span>${records.length} fill-up logged</span>
        </div>
      </div>

      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h3 class="empty-state-title">Awaiting Second Fill-Up</h3>
        <p class="empty-state-desc">
          Log at least 2 sequential fill-ups to unlock trip distance, running cost, and fuel efficiency trends.
        </p>
        <button type="button" class="btn btn-primary" onclick="switchView('add')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          ${records.length === 0 ? 'Log First Fill-Up' : 'Log Next Fill-Up'}
        </button>
        ${records.length === 0 ? `
          <div style="margin-top: 14px;">
            <button type="button" class="chip-btn" onclick="loadSampleData()" style="padding:6px 14px; font-weight:600;">
              ✨ Or Load Demo Data
            </button>
          </div>
        ` : ''}
      </div>
    `;
    return;
  }

  // Calculations for 2+ records
  const totalCost = calcRecords.reduce((sum, r) => sum + r.totalCost, 0);
  const totalVolume = calcRecords.reduce((sum, r) => sum + r.volume, 0);
  const firstOdo = calcRecords[0].odometer;
  const latestOdo = calcRecords[calcRecords.length - 1].odometer;
  const totalDistance = Math.max(0, latestOdo - firstOdo);

  const runningCostPerDist = totalDistance > 0 ? (totalCost / totalDistance) : 0;

  // Overall Fuel Economy between first full tank and last full tank
  const fullTankIndices = [];
  calcRecords.forEach((r, idx) => {
    if (r.isFullTank) fullTankIndices.push(idx);
  });

  let overallEconomyText = '—';
  if (fullTankIndices.length >= 2) {
    const startIdx = fullTankIndices[0];
    const endIdx = fullTankIndices[fullTankIndices.length - 1];
    const fullSpanDistance = calcRecords[endIdx].odometer - calcRecords[startIdx].odometer;
    
    let fullSpanVolume = 0;
    for (let i = startIdx + 1; i <= endIdx; i++) {
      fullSpanVolume += calcRecords[i].volume;
    }

    if (fullSpanDistance > 0 && fullSpanVolume > 0) {
      const overallKmL = fullSpanDistance / fullSpanVolume;
      const overallL100km = (100 * fullSpanVolume) / fullSpanDistance;
      const overallMpg = (fullSpanDistance / KM_PER_MILE) / (fullSpanVolume / LITERS_PER_GAL);

      if (prefs.efficiencyFormat === 'L/100km') {
        overallEconomyText = `${overallL100km.toFixed(2)} L/100km`;
      } else if (prefs.efficiencyFormat === 'MPG') {
        overallEconomyText = `${overallMpg.toFixed(1)} MPG`;
      } else {
        overallEconomyText = `${overallKmL.toFixed(2)} km/L`;
      }
    }
  }

  // Extremes: Best and Worst leg across calculated legs
  const legsWithEconomy = calcRecords.filter(r => r.efficiencyKmL !== null);
  let bestLeg = null;
  let worstLeg = null;

  if (legsWithEconomy.length > 0) {
    if (prefs.efficiencyFormat === 'L/100km') {
      // For L/100km, lower is better
      bestLeg = legsWithEconomy.slice().sort((a, b) => a.efficiencyL100km - b.efficiencyL100km)[0];
      worstLeg = legsWithEconomy.slice().sort((a, b) => b.efficiencyL100km - a.efficiencyL100km)[0];
    } else if (prefs.efficiencyFormat === 'MPG') {
      bestLeg = legsWithEconomy.slice().sort((a, b) => b.efficiencyMpg - a.efficiencyMpg)[0];
      worstLeg = legsWithEconomy.slice().sort((a, b) => a.efficiencyMpg - b.efficiencyMpg)[0];
    } else {
      // km/L, higher is better
      bestLeg = legsWithEconomy.slice().sort((a, b) => b.efficiencyKmL - a.efficiencyKmL)[0];
      worstLeg = legsWithEconomy.slice().sort((a, b) => a.efficiencyKmL - b.efficiencyKmL)[0];
    }
  }

  // Monthly Spending Breakdown (Last 6 Months)
  const monthlySpend = getMonthlySpending(calcRecords);

  let html = `
    <!-- Top Row: Hero Spending Card & Extremes Card (Side-by-side on desktop) -->
    <div class="dashboard-hero-row">
      <div class="hero-stat-card">
        <div class="hero-label">Total Fuel Expenditure</div>
        <div class="hero-value">${formatCurrency(totalCost)}</div>
        <div class="hero-sub">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
          </svg>
          <span>${calcRecords.length} fills recorded across ${formatNumber(totalDistance, 0)} ${prefs.distanceUnit}</span>
        </div>
      </div>

      <div class="card card-extremes">
        <h3 class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          Efficiency Extremes
        </h3>
        <div class="extremes-grid">
          <div class="extreme-box best">
            <div class="extreme-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Best Leg
            </div>
            <div class="extreme-val">
              ${bestLeg ? formatEfficiencyValue(bestLeg).text : '—'}
            </div>
            <div class="extreme-meta" title="${bestLeg ? escapeHtml(bestLeg.station || 'Fuel Station') : ''}">
              ${bestLeg ? `${formatDateDisplay(bestLeg.date).split(',')[0]} • ${escapeHtml(bestLeg.station || 'Station')}` : 'Requires 2 full fills'}
            </div>
          </div>

          <div class="extreme-box worst">
            <div class="extreme-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Worst Leg
            </div>
            <div class="extreme-val">
              ${worstLeg ? formatEfficiencyValue(worstLeg).text : '—'}
            </div>
            <div class="extreme-meta" title="${worstLeg ? escapeHtml(worstLeg.station || 'Fuel Station') : ''}">
              ${worstLeg ? `${formatDateDisplay(worstLeg.date).split(',')[0]} • ${escapeHtml(worstLeg.station || 'Station')}` : 'Requires 2 full fills'}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4 Stats Grid (4 columns on desktop, 2x2 on mobile) -->
    <div class="stats-grid">
      <div class="mini-stat-card">
        <div class="mini-stat-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v10l4 2"/></svg>
          Total Distance
        </div>
        <div class="mini-stat-value">${formatNumber(totalDistance, 0)} <span style="font-size:0.8rem; font-weight:500;">${prefs.distanceUnit}</span></div>
        <div class="mini-stat-sub">From ${formatNumber(firstOdo, 0)} to ${formatNumber(latestOdo, 0)}</div>
      </div>

      <div class="mini-stat-card">
        <div class="mini-stat-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22h12M4 9h10M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/></svg>
          Fuel Consumed
        </div>
        <div class="mini-stat-value">${formatNumber(totalVolume, 1)} <span style="font-size:0.8rem; font-weight:500;">${prefs.volumeUnit}</span></div>
        <div class="mini-stat-sub">Across all logged stops</div>
      </div>

      <div class="mini-stat-card">
        <div class="mini-stat-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Running Cost
        </div>
        <div class="mini-stat-value">${formatCurrency(runningCostPerDist)} <span style="font-size:0.8rem; font-weight:500;">/ ${prefs.distanceUnit}</span></div>
        <div class="mini-stat-sub">Average cost per unit</div>
      </div>

      <div class="mini-stat-card">
        <div class="mini-stat-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          Overall Economy
        </div>
        <div class="mini-stat-value" style="color:var(--primary);">${overallEconomyText}</div>
        <div class="mini-stat-sub">Full-to-full average</div>
      </div>
    </div>

    <!-- Pure CSS/SVG Monthly Spending Chart -->
    <div class="card card-chart">
      <h3 class="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Last 6 Months Spending
      </h3>
      <div class="chart-container" id="monthly-chart-box">
        ${generateMonthlySvgChart(monthlySpend)}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Generate an interactive SVG Bar Chart without external libraries
 */
function generateMonthlySvgChart(monthlyData) {
  const maxVal = Math.max(...monthlyData.map(d => d.amount), 50);
  const width = 480;
  const height = 190;
  const padTop = 26;
  const padBottom = 28;
  const padLeft = 16;
  const padRight = 16;
  const plotHeight = height - padTop - padBottom;
  const plotWidth = width - padLeft - padRight;
  const barCount = monthlyData.length;
  const colWidth = plotWidth / barCount;
  const barWidth = 38;

  let gridLines = '';
  for (let p = 0.25; p <= 1.0; p += 0.25) {
    const yPos = padTop + plotHeight * (1 - p);
    gridLines += `<line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" class="chart-grid-line" />`;
  }

  let barsHtml = '';
  monthlyData.forEach((item, idx) => {
    const xCenter = padLeft + idx * colWidth + colWidth / 2;
    const xPos = xCenter - barWidth / 2;
    const barH = item.amount > 0 ? Math.max(6, (item.amount / maxVal) * plotHeight) : 2;
    const yPos = padTop + plotHeight - barH;
    const isCurrentMonth = idx === barCount - 1;

    const fill = isCurrentMonth ? 'var(--primary)' : 'rgba(16, 185, 129, 0.4)';
    const formattedAmount = `${prefs.currencySymbol}${Math.round(item.amount)}`;

    barsHtml += `
      <g>
        <rect 
          x="${xPos}" 
          y="${yPos}" 
          width="${barWidth}" 
          height="${barH}" 
          rx="6" 
          ry="6" 
          fill="${fill}" 
          class="chart-bar"
          onclick="showToast('${item.label}: ${formatCurrency(item.amount)}', 'info')"
        >
          <title>${item.label}: ${formatCurrency(item.amount)}</title>
        </rect>
        ${item.amount > 0 ? `
          <text x="${xCenter}" y="${yPos - 6}" class="chart-value-label">${formattedAmount}</text>
        ` : ''}
        <text x="${xCenter}" y="${height - 8}" class="chart-label" style="${isCurrentMonth ? 'font-weight:700; fill:var(--primary);' : ''}">${item.label}</text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      ${barsHtml}
    </svg>
  `;
}

/**
 * Reset Add Entry form to fresh state
 */
function setupFormDefaults() {
  const dateField = document.getElementById('field-date');
  const odoField = document.getElementById('field-odometer');
  const volField = document.getElementById('field-volume');
  const costField = document.getElementById('field-cost');
  const fullTankSwitch = document.getElementById('field-fulltank');
  const stationField = document.getElementById('field-station');
  const fuelTypeField = document.getElementById('field-fueltype');
  const notesField = document.getElementById('field-notes');

  dateField.value = getLocalDatetimeString();
  odoField.value = '';
  volField.value = '';
  costField.value = '';
  fullTankSwitch.checked = true;
  stationField.value = '';
  fuelTypeField.value = '';
  notesField.value = '';

  clearFormErrors();
  updateUnitPriceLive();
  updateOdometerHelper();

  document.getElementById('form-view-title').textContent = 'Log Fill-Up';
  document.getElementById('form-view-subtitle').textContent = 'Enter odometer, volume & cost';
  document.getElementById('btn-submit-text').textContent = 'Save Fill-Up';
  document.getElementById('edit-mode-actions').style.display = 'none';

  document.getElementById('accordion-optional-fields').classList.remove('open');
  document.getElementById('btn-toggle-accordion').classList.remove('open');
}

/**
 * Pre-populate form for editing an existing record
 */
function populateFormForEdit(recordId) {
  const record = records.find(r => r.id === recordId);
  if (!record) return;

  editingRecordId = recordId;

  document.getElementById('field-date').value = record.date;
  document.getElementById('field-odometer').value = record.odometer;
  document.getElementById('field-volume').value = record.volume;
  document.getElementById('field-cost').value = record.totalCost;
  document.getElementById('field-fulltank').checked = Boolean(record.isFullTank);
  document.getElementById('field-station').value = record.station || '';
  document.getElementById('field-fueltype').value = record.fuelType || '';
  document.getElementById('field-notes').value = record.notes || '';

  if (record.station || record.fuelType || record.notes) {
    document.getElementById('accordion-optional-fields').classList.add('open');
    document.getElementById('btn-toggle-accordion').classList.add('open');
  }

  document.getElementById('form-view-title').textContent = 'Edit Fill-Up';
  document.getElementById('form-view-subtitle').textContent = 'Modify logged fuel record details';
  document.getElementById('btn-submit-text').textContent = 'Update Entry';
  document.getElementById('edit-mode-actions').style.display = 'flex';

  clearFormErrors();
  updateUnitPriceLive();
  updateOdometerHelper();
  switchView('add');
}

/**
 * Update previous odometer helper label
 */
function updateOdometerHelper() {
  const helper = document.getElementById('odometer-prev-text');
  const sorted = records.slice().sort((a, b) => (Number(a.odometer) || 0) - (Number(b.odometer) || 0));

  if (editingRecordId) {
    const editIdx = sorted.findIndex(r => r.id === editingRecordId);
    if (editIdx > 0) {
      const prev = sorted[editIdx - 1];
      helper.textContent = `Prev: ${Number(prev.odometer).toLocaleString()} ${prefs.distanceUnit}`;
    } else {
      helper.textContent = `First chronological entry`;
    }
  } else {
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      helper.textContent = `Last: ${Number(last.odometer).toLocaleString()} ${prefs.distanceUnit}`;
    } else {
      helper.textContent = `No previous reading logged`;
    }
  }
}

/**
 * Live calculated unit price display
 */
function updateUnitPriceLive() {
  const vol = parseFloat(document.getElementById('field-volume').value);
  const cost = parseFloat(document.getElementById('field-cost').value);
  const display = document.getElementById('unit-price-val');

  if (vol > 0 && cost > 0) {
    const pricePerUnit = cost / vol;
    display.textContent = `${prefs.currencySymbol}${pricePerUnit.toFixed(2)} / ${prefs.volumeUnit}`;
  } else {
    display.textContent = `— / ${prefs.volumeUnit}`;
  }
}

/**
 * Clear inline validation errors
 */
function clearFormErrors() {
  ['date', 'odometer', 'volume', 'cost'].forEach(id => {
    const field = document.getElementById(`field-${id}`);
    const err = document.getElementById(`err-${id}`);
    if (field) field.classList.remove('has-error');
    if (err) err.classList.remove('visible');
  });
}

/**
 * Render the Records history screen with search and filters
 */
function renderRecords() {
  const container = document.getElementById('records-list-container');
  const calcRecords = computeCalculatedRecords(records);

  if (calcRecords.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 22h12M4 9h10M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/>
            <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>
          </svg>
        </div>
        <h3 class="empty-state-title">No Fuel Records Yet</h3>
        <p class="empty-state-desc">
          Start keeping track of your fill-ups, distance, fuel prices, and fuel economy today.
        </p>
        <button type="button" class="btn btn-primary" onclick="switchView('add')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add First Fill-Up
        </button>
        <div style="margin-top: 14px;">
          <button type="button" class="chip-btn" onclick="loadSampleData()" style="padding:6px 14px; font-weight:600;">
            ✨ Load Demo Data
          </button>
        </div>
      </div>
    `;
    document.getElementById('filter-count-label').textContent = '0 records';
    document.getElementById('btn-clear-all-filters').style.display = 'none';
    return;
  }

  // Filter processing
  const searchTerms = filters.search.toLowerCase().trim();
  const filtered = calcRecords.filter(rec => {
    if (searchTerms) {
      const station = (rec.station || '').toLowerCase();
      const fuel = (rec.fuelType || '').toLowerCase();
      const notes = (rec.notes || '').toLowerCase();
      if (!station.includes(searchTerms) && !fuel.includes(searchTerms) && !notes.includes(searchTerms)) {
        return false;
      }
    }

    if (filters.startDate) {
      const recDateOnly = rec.date.split('T')[0];
      if (recDateOnly < filters.startDate) return false;
    }
    if (filters.endDate) {
      const recDateOnly = rec.date.split('T')[0];
      if (recDateOnly > filters.endDate) return false;
    }

    return true;
  });

  const displayList = filtered.slice().reverse();

  const isFiltered = Boolean(filters.search || filters.startDate || filters.endDate);
  document.getElementById('filter-count-label').textContent = isFiltered 
    ? `Showing ${displayList.length} of ${records.length} records`
    : `Showing all ${records.length} records`;
  document.getElementById('btn-clear-all-filters').style.display = isFiltered ? 'inline-block' : 'none';

  if (displayList.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3 class="empty-state-title">No Matching Records</h3>
        <p class="empty-state-desc">No records match your active search and date filters.</p>
        <button type="button" class="btn btn-secondary" onclick="clearAllFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  let cardsHtml = '';
  displayList.forEach(rec => {
    const eff = formatEfficiencyValue(rec);
    let effBadgeClass = 'active-mileage';
    if (eff.isPartial) effBadgeClass = 'partial';
    if (eff.isBaseline) effBadgeClass = 'baseline';

    cardsHtml += `
      <article class="record-card" data-id="${rec.id}">
        <!-- Top Row: Date, Station, Cost -->
        <div class="record-top-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="record-date">${formatDateDisplay(rec.date)}</span>
            ${rec.station ? `
              <span class="record-station-badge" title="${escapeHtml(rec.station)}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ${escapeHtml(rec.station)}
              </span>
            ` : ''}
          </div>
          <div class="record-total-cost">${formatCurrency(rec.totalCost)}</div>
        </div>

        <!-- Middle Row: Odometer, Delta Distance, Volume -->
        <div class="record-middle-row">
          <div class="record-stat-item">
            <span class="lbl">Odometer</span>
            <span class="val">${formatNumber(rec.odometer, 0)} <span style="font-size:0.75rem; color:var(--text-secondary);">${prefs.distanceUnit}</span></span>
          </div>
          <div class="record-stat-item">
            <span class="lbl">Trip ΔOdo</span>
            <span class="val">
              ${rec.deltaOdo > 0 ? `<span class="val-delta">+${formatNumber(rec.deltaOdo, 0)}</span> ${prefs.distanceUnit}` : '<span style="color:var(--text-muted);">—</span>'}
            </span>
          </div>
          <div class="record-stat-item">
            <span class="lbl">Pumped</span>
            <span class="val">${formatNumber(rec.volume, 2)} <span style="font-size:0.75rem; color:var(--text-secondary);">${prefs.volumeUnit}</span></span>
          </div>
        </div>

        <!-- Bottom Row: Efficiency Badge & Unit Price -->
        <div class="record-bottom-row">
          <span class="efficiency-badge ${effBadgeClass}">
            ${!eff.isPartial && !eff.isBaseline ? `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            ` : ''}
            ${eff.text}
          </span>
          <span class="record-unit-price">${formatCurrency(rec.unitPrice)} / ${prefs.volumeUnit}</span>
        </div>

        <!-- Optional Fuel Grade & Notes -->
        ${rec.notes || (rec.fuelType && rec.fuelType !== 'Regular 95') ? `
          <div class="record-details-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${rec.fuelType ? `<strong>${escapeHtml(rec.fuelType)}</strong> • ` : ''}${escapeHtml(rec.notes || '')}</span>
          </div>
        ` : ''}

        <!-- Quick Action Buttons -->
        <div class="record-actions">
          <button type="button" class="record-action-btn edit-btn" onclick="populateFormForEdit('${rec.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Edit
          </button>
          <button type="button" class="record-action-btn delete-btn" onclick="promptDeleteRecord('${rec.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      </article>
    `;
  });

  container.innerHTML = cardsHtml;
}

/**
 * Synchronize settings form controls with current state
 */
function updateSettingsUI() {
  document.querySelectorAll('#currency-chip-group .chip-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('data-curr') === prefs.currencySymbol);
  });
  document.getElementById('setting-custom-currency').value = 
    ['$', '€', '₹', 'Rs', '£'].includes(prefs.currencySymbol) ? '' : prefs.currencySymbol;

  const isMetric = prefs.distanceUnit === 'km' && prefs.volumeUnit === 'L';
  document.querySelectorAll('#seg-unit-system .segmented-btn').forEach(btn => {
    const sys = btn.getAttribute('data-system');
    btn.classList.toggle('active', (isMetric && sys === 'metric') || (!isMetric && sys === 'imperial'));
  });

  document.querySelectorAll('#seg-efficiency-format .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-eff') === prefs.efficiencyFormat);
  });

  document.querySelectorAll('#seg-theme-mode .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === prefs.theme);
  });

  const formattedUnit = `${prefs.distanceUnit} · ${prefs.volumeUnit}`;
  const topBadge = document.getElementById('top-units-badge');
  const sidebarBadge = document.getElementById('sidebar-units-badge');
  if (topBadge) topBadge.textContent = formattedUnit;
  if (sidebarBadge) sidebarBadge.textContent = formattedUnit;

  document.getElementById('addon-distance-unit').textContent = prefs.distanceUnit;
  document.getElementById('addon-volume-unit').textContent = prefs.volumeUnit;
  document.getElementById('addon-currency').textContent = prefs.currencySymbol;
}

/**
 * Switch view section with smooth transition
 */
function switchView(viewName) {
  currentView = viewName;

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const targetSec = document.getElementById(`view-${viewName}`);
  if (targetSec) targetSec.classList.add('active');

  document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'records') {
    renderRecords();
  } else if (viewName === 'settings') {
    updateSettingsUI();
  } else if (viewName === 'add') {
    updateOdometerHelper();
    updateUnitPriceLive();
  }

  document.getElementById('main-scroll-area').scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Open confirmation modal for deleting a record
 */
function promptDeleteRecord(recordId) {
  const rec = records.find(r => r.id === recordId);
  if (!rec) return;

  const modal = document.getElementById('app-modal-backdrop');
  const icon = document.getElementById('modal-icon-container');
  const title = document.getElementById('modal-title-text');
  const body = document.getElementById('modal-body-text');
  const footer = document.getElementById('modal-footer-buttons');

  icon.className = 'modal-icon-wrap danger';
  icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
  title.textContent = 'Delete Fill-Up Record?';
  body.innerHTML = `
    Are you sure you want to delete this record?<br><br>
    <strong>Date:</strong> ${formatDateDisplay(rec.date)}<br>
    <strong>Odometer:</strong> ${formatNumber(rec.odometer, 0)} ${prefs.distanceUnit}<br>
    <strong>Cost:</strong> ${formatCurrency(rec.totalCost)}<br><br>
    <span style="color:var(--danger); font-size:0.8rem;">This action cannot be undone.</span>
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-danger" id="btn-modal-confirm-delete">Delete</button>
  `;

  document.getElementById('btn-modal-confirm-delete').onclick = function() {
    records = records.filter(r => r.id !== recordId);
    saveRecords();
    closeModal();
    showToast('Record deleted', 'info');
    renderRecords();
    renderDashboard();
  };

  modal.classList.add('open');
}

/**
 * Open modal for Factory Reset with typed confirmation
 */
function promptFactoryReset() {
  const modal = document.getElementById('app-modal-backdrop');
  const icon = document.getElementById('modal-icon-container');
  const title = document.getElementById('modal-title-text');
  const body = document.getElementById('modal-body-text');
  const footer = document.getElementById('modal-footer-buttons');

  icon.className = 'modal-icon-wrap danger';
  icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  title.textContent = 'Factory Reset App?';
  body.innerHTML = `
    This will permanently erase all <strong>${records.length}</strong> fuel records and restore default preferences.<br><br>
    To confirm, please type <strong>DELETE</strong> below:
    <input type="text" id="input-reset-confirm" class="input-field" placeholder="Type DELETE" style="margin-top:10px; text-transform:uppercase;">
  `;

  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button type="button" class="btn btn-danger" id="btn-modal-confirm-reset" disabled style="opacity:0.5;">Reset Everything</button>
  `;

  const confirmInput = document.getElementById('input-reset-confirm');
  const confirmBtn = document.getElementById('btn-modal-confirm-reset');

  confirmInput.oninput = function() {
    if (confirmInput.value.trim().toUpperCase() === 'DELETE') {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    } else {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
    }
  };

  confirmBtn.onclick = function() {
    records = [];
    prefs = Object.assign({}, DEFAULT_PREFS);
    saveRecords();
    savePrefs();
    applyTheme(prefs.theme);
    closeModal();
    showToast('App has been reset to factory defaults', 'info');
    switchView('dashboard');
  };

  modal.classList.add('open');
  setTimeout(() => confirmInput.focus(), 100);
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('app-modal-backdrop').classList.remove('open');
}

/**
 * Display toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-pill toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else {
    iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon-wrap ${type}">
      ${iconSvg}
    </div>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/**
 * Apply Dark, Light, or System theme
 */
function applyTheme(themeChoice) {
  let resolved = 'dark';
  if (themeChoice === 'system') {
    resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } else {
    resolved = themeChoice;
  }

  const isLight = resolved === 'light';
  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
    updateMetaThemeColor('#ffffff');
  } else {
    document.documentElement.removeAttribute('data-theme');
    updateMetaThemeColor('#1e293b');
  }

  document.querySelectorAll('.theme-icon-sun').forEach(el => {
    el.style.display = isLight ? 'none' : 'block';
  });
  document.querySelectorAll('.theme-icon-moon').forEach(el => {
    el.style.display = isLight ? 'block' : 'none';
  });
}

/**
 * Toggle theme from Top Bar or Sidebar icon button
 */
function toggleThemeHeader() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  prefs.theme = next;
  savePrefs();
  applyTheme(next);
  updateSettingsUI();
  showToast(`Switched to ${next} theme`, 'info');
}

/**
 * Update browser header theme-color meta tag
 */
function updateMetaThemeColor(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
}
