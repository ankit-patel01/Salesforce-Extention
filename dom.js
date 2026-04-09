/**
 * ==========================================
 * LogHunt Chrome Extension
 * Author: Ankit Patel
 * Contact: ankit.ap.patel01@gmail.com
 * ==========================================
 */
/**
 * LogHunt — dom.js
 * All DOM interaction: finding table rows, applying highlights,
 * injecting badges, and cleanup.
 *
 * CRITICAL FIX: The Salesforce Debug Log page renders inside a
 * Visualforce iframe embedded in the Lightning shell. The table
 * lives in that iframe's document, NOT in window.document.
 * This class finds the correct document automatically.
 */
window.__LogHunt = window.__LogHunt || {};
window.__LogHunt.DOM = class LogHuntDOM {

  /* ── Find the document that contains the debug-log table ─── */

  /**
   * Returns the Document object that actually contains the log table.
   * Checks the current document first, then any same-origin iframes.
   */
  static getTableDocument() {
    // 1. Current document (works when pasted directly into iframe console)
    if (LogHuntDOM._tableExistsIn(document)) return document;

    // 2. Search all iframes for the one hosting the VF table
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        const fd = frame.contentDocument || frame.contentWindow?.document;
        if (fd && LogHuntDOM._tableExistsIn(fd)) return fd;
      } catch (_) {
        // cross-origin iframe — skip
      }
    }
    return document; // fallback
  }

  static _tableExistsIn(doc) {
    return window.__LogHunt.Config.TABLE_SELECTORS.some(sel => doc.querySelector(sel));
  }

  /* ── Log row detection ────────────────────────────────────── */

  /**
   * Returns all visible <tr> rows from the debug-log table.
   * Searches the correct document automatically.
   */
  static getLogRows() {
    const doc = window.__LogHunt.DOM.getTableDocument();
    for (const sel of window.__LogHunt.Config.TABLE_SELECTORS) {
      const tbl = doc.querySelector(sel);
      if (!tbl) continue;
      const rows = [...tbl.querySelectorAll('tbody tr')]
        .filter(r => r.querySelectorAll('td').length >= 3);
      if (rows.length) return rows;
    }
    return [];
  }

  /** Returns the count of visible log rows. */
  static getRowCount() {
    return window.__LogHunt.DOM.getLogRows().length;
  }

  /* ── Row highlighting ─────────────────────────────────────── */

  /**
   * Mark a row as currently being scanned.
   */
  static markScanning(row) {
    window.__LogHunt.DOM._saveOriginal(row);
    row.dataset[window.__LogHunt.Config.DATA_ATTR.replace('data-', '')] = 'scan';
    row.classList.add(window.__LogHunt.Config.ROW_CLASSES.scan);
  }

  /**
   * Mark a row as a keyword match.
   * Also injects a badge showing the occurrence count.
   *
   * ── HIGHLIGHT FIX ──
   * The previous code applied CSS classes but the Salesforce VF page
   * has inline style="background-color:..." on rows that override
   * class-based rules. We now force the background via inline style
   * AND the class (for the orange outline).
   */
  static markMatch(row, occurrenceCount) {
    row.classList.remove(window.__LogHunt.Config.ROW_CLASSES.scan);
    row.dataset[window.__LogHunt.Config.DATA_ATTR.replace('data-', '')] = 'match';

    // Force override any inline Salesforce background
    row.style.setProperty('background-color', '#FFF8EC', 'important');
    row.style.setProperty('outline', '2px solid #F46300', 'important');
    row.classList.add(window.__LogHunt.Config.ROW_CLASSES.match);

    window.__LogHunt.DOM._injectBadge(row, occurrenceCount);
  }

  /**
   * Mark a row as searched but no match found.
   */
  static markNoMatch(row) {
    row.classList.remove(window.__LogHunt.Config.ROW_CLASSES.scan);
    row.dataset[window.__LogHunt.Config.DATA_ATTR.replace('data-', '')] = 'nomatch';

    row.style.setProperty('background-color', '#FAFAF9', 'important');
    row.style.setProperty('opacity', '0.5', 'important');
    row.classList.add(window.__LogHunt.Config.ROW_CLASSES.nomatch);
  }

  /**
   * Mark a row as errored during fetch.
   */
  static markError(row) {
    row.classList.remove(window.__LogHunt.Config.ROW_CLASSES.scan);
    row.dataset[window.__LogHunt.Config.DATA_ATTR.replace('data-', '')] = 'error';
    row.style.setProperty('background-color', '#FFF5F5', 'important');
    row.classList.add(window.__LogHunt.Config.ROW_CLASSES.error);
  }

  /* ── Badge injection ──────────────────────────────────────── */

  static _injectBadge(row, count) {
    const td = row.querySelector('td');
    if (!td || td.querySelector('.' + window.__LogHunt.Config.BADGE_CLASS)) return;

    const badge       = document.createElement('span');
    badge.className   = window.__LogHunt.Config.BADGE_CLASS;
    badge.textContent = `MATCH ×${count}`;
    td.prepend(badge);
  }

  /* ── Scroll into view ─────────────────────────────────────── */

  static scrollToRow(row) {
    try {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {
      row.scrollIntoView(false);
    }
  }

  /* ── Save / restore original row state ───────────────────── */

  static _saveOriginal(row) {
    if (!row.dataset.sflsOrig) {
      // Save the current inline background so we can restore it on clear
      row.dataset.sflsOrig = row.style.backgroundColor || '';
    }
  }

  /* ── Full cleanup ─────────────────────────────────────────── */

  /**
   * Remove all highlights and badges from every previously-touched row.
   */
  static clearAll() {
    const allClasses = Object.values(window.__LogHunt.Config.ROW_CLASSES);
    // Check both main doc and iframes
    const docs = [document];
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        const fd = frame.contentDocument || frame.contentWindow?.document;
        if (fd) docs.push(fd);
      } catch (_) {}
    }

    for (const doc of docs) {
      doc.querySelectorAll('[data-sfls-orig]').forEach(row => {
        // Restore original background
        row.style.backgroundColor = row.dataset.sflsOrig || '';
        row.style.removeProperty('outline');
        row.style.removeProperty('opacity');

        allClasses.forEach(c => row.classList.remove(c));
        row.querySelector('.' + window.__LogHunt.Config.BADGE_CLASS)?.remove();

        delete row.dataset.sflsOrig;
        delete row.dataset.sfls;
      });
    }
  }
}
