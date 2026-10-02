/**
 * FuelTrack - Calculator & Formatting Engine Module
 * Implements standard automotive full-to-full mileage calculation,
 * metric/imperial unit conversions, and display formatting.
 */
'use strict';

// Unit Conversion Constants (Exact)
const KM_PER_MILE = 1.609344;
const LITERS_PER_GAL = 3.785411784;

/**
 * Standard Automotive Full-to-Full Fuel Economy Logic
 * - Sorts records ascending by odometer reading
 * - Accumulates partial volumes across non-full stops
 * - Measures distance traveled from the preceding full tank baseline
 */
function computeCalculatedRecords(inputRecords) {
  if (!inputRecords || !inputRecords.length) return [];

  // Create shallow copies with numeric normalization and sort ascending by odometer
  const sorted = inputRecords.slice().sort((a, b) => {
    const odoA = Number(a.odometer) || 0;
    const odoB = Number(b.odometer) || 0;
    if (odoA !== odoB) return odoA - odoB;
    return new Date(a.date) - new Date(b.date);
  });

  let lastFullTankOdo = null;
  let accumulatedVolumeSinceFull = 0;

  const calculated = sorted.map((rec, idx) => {
    const item = Object.assign({}, rec);
    item.odometer = Number(item.odometer) || 0;
    item.volume = Number(item.volume) || 0;
    item.totalCost = Number(item.totalCost) || 0;
    item.isFullTank = Boolean(item.isFullTank);

    // Distance delta from immediately prior recorded entry
    if (idx === 0) {
      item.deltaOdo = 0;
    } else {
      item.deltaOdo = Math.max(0, item.odometer - sorted[idx - 1].odometer);
    }

    // Unit price for this stop
    item.unitPrice = item.volume > 0 ? (item.totalCost / item.volume) : 0;

    // Full-to-Full Mileage Evaluation
    if (idx === 0) {
      // First chronological record establishes the baseline
      item.isBaseline = true;
      item.isPartial = !item.isFullTank;
      item.efficiencyKmL = null;
      item.efficiencyL100km = null;
      item.efficiencyMpg = null;

      if (item.isFullTank) {
        lastFullTankOdo = item.odometer;
        accumulatedVolumeSinceFull = 0;
      } else {
        lastFullTankOdo = null;
        accumulatedVolumeSinceFull = item.volume;
      }
    } else {
      if (!item.isFullTank) {
        // Partial fill-up: mileage cannot be accurately calculated
        item.isBaseline = false;
        item.isPartial = true;
        item.efficiencyKmL = null;
        item.efficiencyL100km = null;
        item.efficiencyMpg = null;
        accumulatedVolumeSinceFull += item.volume;
      } else {
        // Full tank fill-up
        item.isBaseline = false;
        item.isPartial = false;

        if (lastFullTankOdo !== null) {
          const legDistance = item.odometer - lastFullTankOdo;
          const legTotalVolume = accumulatedVolumeSinceFull + item.volume;

          if (legDistance > 0 && legTotalVolume > 0) {
            // Metric Calculations
            item.efficiencyKmL = legDistance / legTotalVolume;
            item.efficiencyL100km = (100 * legTotalVolume) / legDistance;
            // Imperial MPG Calculation: miles / gallons
            const legMiles = legDistance / KM_PER_MILE;
            const legGallons = legTotalVolume / LITERS_PER_GAL;
            item.efficiencyMpg = legMiles / legGallons;
          } else {
            item.efficiencyKmL = null;
            item.efficiencyL100km = null;
            item.efficiencyMpg = null;
          }

          // Reset tracker for subsequent legs
          lastFullTankOdo = item.odometer;
          accumulatedVolumeSinceFull = 0;
        } else {
          // First full tank encountered after initial partial fills; sets new baseline
          item.isBaseline = true;
          item.efficiencyKmL = null;
          item.efficiencyL100km = null;
          item.efficiencyMpg = null;
          lastFullTankOdo = item.odometer;
          accumulatedVolumeSinceFull = 0;
        }
      }
    }

    return item;
  });

  return calculated;
}

/**
 * Format currency amount with active symbol
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `${prefs.currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format localized numbers with specified decimal places
 */
function formatNumber(num, decimals = 1) {
  const n = Number(num) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format fuel efficiency value based on chosen preference (km/L, L/100km, MPG)
 */
function formatEfficiencyValue(calcItem) {
  if (!calcItem || calcItem.efficiencyKmL === null) {
    if (calcItem && calcItem.isPartial) {
      return { text: 'Partial Tank (Mileage skipped)', isPartial: true };
    }
    return { text: 'Baseline Entry', isBaseline: true };
  }

  const fmt = prefs.efficiencyFormat;
  if (fmt === 'L/100km') {
    return {
      text: `${calcItem.efficiencyL100km.toFixed(2)} L/100km`,
      value: calcItem.efficiencyL100km,
      unit: 'L/100km'
    };
  } else if (fmt === 'MPG') {
    return {
      text: `${calcItem.efficiencyMpg.toFixed(1)} MPG`,
      value: calcItem.efficiencyMpg,
      unit: 'MPG'
    };
  } else {
    return {
      text: `${calcItem.efficiencyKmL.toFixed(2)} km/L`,
      value: calcItem.efficiencyKmL,
      unit: 'km/L'
    };
  }
}

/**
 * Format ISO datetime string into human readable format
 */
function formatDateDisplay(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/**
 * Get formatted local datetime string for <input type="datetime-local">
 */
function getLocalDatetimeString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Group fill-up expenditure across the trailing 6 calendar months
 */
function getMonthlySpending(calcRecords) {
  const result = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthLabel = d.toLocaleString(undefined, { month: 'short' });

    const spend = calcRecords.reduce((sum, r) => {
      const rd = new Date(r.date);
      if (rd.getFullYear() === y && rd.getMonth() === m) {
        return sum + (Number(r.totalCost) || 0);
      }
      return sum;
    }, 0);

    result.push({
      label: monthLabel,
      year: y,
      month: m,
      amount: spend
    });
  }
  return result;
}
