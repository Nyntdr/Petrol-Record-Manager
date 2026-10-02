/**
 * FuelTrack - Storage & State Management Module
 * Handles local persistence, corrupted data fallback, safe JSON access, and XSS sanitization.
 */
'use strict';

// Storage Keys
const STORAGE_KEY_DATA = 'petrol_tracker_data';
const STORAGE_KEY_PREFS = 'petrol_tracker_prefs';

// Default Preferences
const DEFAULT_PREFS = {
  currencySymbol: '$',
  distanceUnit: 'km',       // 'km' | 'miles'
  volumeUnit: 'L',          // 'L' | 'gal'
  efficiencyFormat: 'km/L', // 'km/L' | 'L/100km' | 'MPG'
  theme: 'dark'             // 'dark' | 'light' | 'system'
};

// Global App State
let records = [];
let prefs = Object.assign({}, DEFAULT_PREFS);
let currentView = 'dashboard';
let editingRecordId = null;
let filters = {
  search: '',
  startDate: '',
  endDate: ''
};

/**
 * Load fuel records and preferences from localStorage with error guards
 */
function loadStorageData() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY_DATA);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else {
        console.warn('Invalid records structure in localStorage, initialized empty.');
        records = [];
      }
    } else {
      records = [];
    }
  } catch (err) {
    console.error('Failed reading records from localStorage:', err);
    records = [];
    if (typeof showToast === 'function') {
      showToast('Corrupted data detected, initialized empty records', 'error');
    }
  }

  try {
    const rawPrefs = localStorage.getItem(STORAGE_KEY_PREFS);
    if (rawPrefs) {
      const parsed = JSON.parse(rawPrefs);
      if (parsed && typeof parsed === 'object') {
        prefs = Object.assign({}, DEFAULT_PREFS, parsed);
      }
    }
  } catch (err) {
    console.error('Failed reading preferences from localStorage:', err);
    prefs = Object.assign({}, DEFAULT_PREFS);
  }
}

/**
 * Persist records to localStorage
 */
function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(records));
    return true;
  } catch (err) {
    console.error('Failed saving records to localStorage:', err);
    if (typeof showToast === 'function') {
      showToast('Storage quota exceeded or storage unavailable!', 'error');
    }
    return false;
  }
}

/**
 * Persist preferences to localStorage
 */
function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    return true;
  } catch (err) {
    console.error('Failed saving preferences:', err);
    return false;
  }
}

/**
 * Security: Escape user inputs to prevent XSS before rendering into HTML
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a unique ID for records
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'ft_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}
