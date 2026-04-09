/**
 * ==========================================
 * LogHunt Chrome Extension
 * Author: Ankit Patel
 * Contact: ankit.ap.patel01@gmail.com
 * ==========================================
 */
/**
 * LogHunt — config.js
 * All constants and configuration in one place.
 */
window.__LogHunt = window.__LogHunt || {};
window.__LogHunt.Config = {
  API_VER:             'v59.0',
  FETCH_DELAY_MS:      400,   // FIX-5: was 80ms — too aggressive, risks org-level API limit
  FETCH_DELAY_JITTER:  200,   // FIX-5: adds 0–200ms random jitter to avoid burst bursts
  PANEL_ID:       '__sfls_panel',
  FAB_ID:         '__sfls_fab',
  STYLE_ID:       '__sfls_style',
  DATA_ATTR:      'data-sfls',
  BADGE_CLASS:    '__sfls_badge',

  /* Row CSS classes injected into the SF table */
  ROW_CLASSES: {
    match:   'sfls-match',
    nomatch: 'sfls-nomatch',
    scan:    'sfls-scan',
    error:   'sfls-error',
  },

  /* Selectors used to find the debug-log table */
  TABLE_SELECTORS: [
    'table[id*="thetracetable"]',
    'table[id*="traceTable"]',
    '.pbBody table.list',
    'table.list',
  ],
};
