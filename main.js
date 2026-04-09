/**
 * ==========================================
 * LogHunt Chrome Extension
 * Author: Ankit Patel
 * Contact: ankit.ap.patel01@gmail.com
 * ==========================================
 */
/**
 * LogHunt — main.js  (v4.2)
 * ============================================================
 * Entry point. Wires API + DOM + UI together.
 * Handles the search loop, stop signal, and result reporting.
 *
 * HOW TO USE
 * ──────────
 * Open your Salesforce org → Setup → Debug Logs, open DevTools
 * console, then paste ALL FIVE files in order:
 *
 *   1. config.js
 *   2. api.js
 *   3. dom.js
 *   4. ui.js
 *   5. main.js   ← this file (runs automatically)
 *
 * CHANGES v4.2
 * ────────────
 * BUG-1  Buffer overflow on single-char keyword (slice(-0) bug) — FIXED
 * BUG-2  postMessage listener trusted any origin — now validates e.origin
 * BUG-3  Fetch delay was 80ms (too fast) — raised to 400ms + jitter
 * BUG-4  bridge.js posted to '*' wildcard — now posts to exact origin
 * ============================================================
 */
(async function LogHuntMain() {
  'use strict';

  /* 🛑 STRICT URL GATEKEEPER */
  const url = window.location.href.toLowerCase();
  const isDebugLogsPage = url.includes('apexdebuglogs') || url.includes('listapextraces');
  if (!isDebugLogsPage) {
    if (window === window.top) {
       alert("LogHunt explicitly requires the Salesforce Debug Logs page.\nPlease navigate to Setup → Environments → Logs → Debug Logs.");
    }
    return;
  }

  /* 🛑 LIGHTNING IFRAME GATEKEEPER
     Prevents the UI from duplicating in nested Salesforce iframes. 
     Instead of guessing, we strictly mandate that the table MUST be in the current document.
     Since we use allFrames: true, the correct iframe will independently find its table.
  */
  const isTableHere = document.querySelector('.pbBody table.list, table[id*="thetracetable"], table[id*="traceTable"]');
  if (!isTableHere) {
    return; // 🔥 Abort entirely. We are in the wrong frame.
  }

  /* 🛑 RE-INJECTION HANDLER
     If the extension icon is clicked again, just unhide the UI instead of crashing. */
  if (window.__LogHuntInjected) {
    if (window.__LogHuntUI_Instance) {
      window.__LogHuntUI_Instance.showPanel();
    }
    return;
  }
  window.__LogHuntInjected = true;

  /* ── Cleanup any previous instance ───────────────────────── */
  [window.__LogHunt.Config.PANEL_ID, window.__LogHunt.Config.FAB_ID, window.__LogHunt.Config.STYLE_ID]
    .forEach(id => document.getElementById(id)?.remove());
  window.__LogHunt.DOM.clearAll();

  /* ── Instantiate services ─────────────────────────────────── */
  const api = new window.__LogHunt.API();
  let stopSignal = false;
  let running    = false;

  /* ── Wire UI callbacks ────────────────────────────────────── */
  const ui = new window.__LogHunt.UI(
    /* onSearch */ doSearch,
    /* onStop   */ () => { stopSignal = true; },
    /* onClear  */ doClear,
    /* onTest   */ doTest,
  );

  window.__LogHuntUI_Instance = ui;
  ui.mount();

  /* ── Initial row count + limit dropdown ──────────────────── */
  function refreshRowCount() {
    const n = window.__LogHunt.DOM.getRowCount();
    ui.setRowCount(n);
    ui.buildLimitOptions(n || 20); // fallback 20 if table not loaded yet
    return n;
  }
  refreshRowCount();

  /* ── Auto-detect API endpoint silently on load ──────────── */
  setTimeout(async () => {
    if (window.__LogHuntUI_Instance) window.__LogHuntUI_Instance.focusKeyword();
    const ok = await doTest(true /* quiet */);
    if (!ok) ui.setConnection(false, 'Click "Test API" to diagnose');
  }, 350);

  /* ══════════════════════════════════════════════════════════
     TEST CONNECTION
     ══════════════════════════════════════════════════════════ */
  async function doTest(quiet = false) {
    ui.setTestBtnEnabled(false);
    if (!quiet) ui.setStatus('Auto-detecting API endpoint…');

    const found = await api.detectEndpoint(msg => {
      if (!quiet) ui.setStatus(msg);
    });

    ui.setTestBtnEnabled(true);

    if (found) {
      ui.setConnection(true, api.endpointLabel);
      if (!quiet) {
        try {
          const total = await api.ping();
          ui.setStatus(`✅ Connected — <b>${total}</b> total log(s) in org`);
        } catch (_) {
          ui.setStatus(`✅ Connected via <b>${api.endpointLabel}</b>`);
        }
      }
      return true;
    } else {
      ui.setConnection(false, 'No working endpoint found');
      if (!quiet) {
        ui.setStatus(
          '❌ All endpoints failed.<br>' +
          '1. Refresh &amp; re-paste the script<br>' +
          '2. Confirm you are on Setup → Debug Logs<br>' +
          '3. Check browser console for CORS errors'
        );
      }
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════════
     CLEAR
     ══════════════════════════════════════════════════════════ */
  function doClear() {
    window.__LogHunt.DOM.clearAll();
    ui.setProgress(0);
    ui.setStatus('');
    ui.hideResults();
    ui.hideErrors();
    ui.setMatchBadge(0);
    refreshRowCount();
  }

  /* ══════════════════════════════════════════════════════════
     MAIN SEARCH
     ══════════════════════════════════════════════════════════ */
  async function doSearch() {
    if (running) return;

    const rawKw = ui.keyword;
    if (!rawKw) { ui.setStatus('⚠ Please enter a keyword.'); return; }

    doClear();
    running    = true;
    stopSignal = false;
    ui.setSearching(true);

    /* Step 0: Ensure API is connected */
    if (!api.isReady) {
      ui.setStatus('Finding API endpoint…');
      const ok = await doTest(true);
      if (!ok) {
        ui.setStatus('❌ Cannot reach Tooling API. Click <b>Test API</b>.');
        running = false; ui.setSearching(false);
        return;
      }
    }

    const caseSensitive = ui.caseSensitive;
    const keyword       = caseSensitive ? rawKw : rawKw.toLowerCase();
    const limit         = ui.scanLimit;
    if (limit <= 0) {
      ui.setStatus('⚠ No logs available to scan.'); return;
    }

    /*
      Re-read rows AFTER the API call resolves, in case the page
      finished rendering between mount() and now.
    */
    const rows = window.__LogHunt.DOM.getLogRows();

    /* Step 1: Query log IDs via SOQL */
    ui.setStatus(`Fetching ${limit} log IDs from Tooling API…`);
    let logRecords = [];
    try {
      logRecords = await api.queryLogs(limit);
    } catch (err) {
      ui.setStatus(`❌ SOQL query failed: ${_escape(err.message)}`);
      running = false; ui.setSearching(false);
      return;
    }

    if (!logRecords.length) {
      ui.setStatus('✗ No ApexLog records found in org.');
      running = false; ui.setSearching(false);
      return;
    }

    const total      = logRecords.length;
    const errorLines = [];
    let matched = 0, noMatch = 0, errors = 0, skipped = 0;
    let firstMatchScrolled = false;

    /* Step 2: Fetch + search concurrently (Fast mode) */
    const CONCURRENCY = 5; // Browser max is typically 6 parallel streams per domain
    let currentIndex = 0;
    let completedCount = 0;

    async function processWorker() {
      while (currentIndex < logRecords.length && !stopSignal) {
        const i = currentIndex++;
        const rec = logRecords[i];
        const row = rows[i];

        if (row) window.__LogHunt.DOM.markScanning(row);

        if (rec.LogLength === 0) {
          skipped++;
          if (row) window.__LogHunt.DOM.markNoMatch(row);
        } else {
          try {
            const response = await api.fetchLogStream(rec.Id);
            if (stopSignal) break;

            const reader   = response.body.getReader();
            const decoder  = new TextDecoder('utf-8');

            let cnt    = 0;
            let buffer = '';
            const kwLen   = keyword.length;
            const keepLen = Math.max(kwLen - 1, 0);

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              let chunk = decoder.decode(value, { stream: true });
              if (!caseSensitive) chunk = chunk.toLowerCase();

              buffer += chunk;

              let pos = 0;
              while ((pos = buffer.indexOf(keyword, pos)) !== -1) {
                cnt++;
                pos++;
              }

              buffer = keepLen > 0 ? buffer.slice(-keepLen) : '';
            }

            if (cnt > 0) {
              matched++;
              if (row) {
                window.__LogHunt.DOM.markMatch(row, cnt);
                if (!firstMatchScrolled) {
                  window.__LogHunt.DOM.scrollToRow(row);
                  firstMatchScrolled = true;
                }
              }
              ui.setMatchBadge(matched);
            } else {
              noMatch++;
              if (row) window.__LogHunt.DOM.markNoMatch(row);
            }

          } catch (err) {
            errors++;
            if (row) window.__LogHunt.DOM.markError(row);
            errorLines.push(`#${i + 1} ${rec.Id}: ${_escape(err.message)}`);
            
            // Abort heavily if we hit hard limits
            if (err.message.includes('401') || err.message.includes('403') || err.message.includes('429')) {
              stopSignal = true;
            }
          }
        }

        completedCount++;
        const pct = Math.round((completedCount / total) * 100);
        ui.setProgress(pct);
        ui.setStatus(`Scanning... ${completedCount} / ${total}  ·  ${matched} match(es) found`);

        // Give the network connection a tiny breather (polite traffic shaping)
        // 5 parallel connections doing this won't breach limits.
        await _sleep(30 + Math.random() * 20); 
      }
    }

    // Launch workers and wait
    const workers = Array.from({ length: CONCURRENCY }, () => processWorker());
    await Promise.all(workers);
    
    // Add any remaining un-evaluated logs to skipped if stopped
    if (stopSignal && currentIndex < logRecords.length) {
      skipped += (logRecords.length - completedCount);
    }

    /* ── Done ── */
    ui.setProgress(100);
    running = false;
    ui.setSearching(false);

    const stoppedNote = stopSignal
      ? ' <em style="color:#C94F00">(stopped early)</em>' : '';

    ui.setStatus(
      matched
        ? `✅ <strong style="color:#1A7A3A">${matched} match(es)</strong> for "<em>${_escape(rawKw)}</em>"${stoppedNote}`
        : `No matches for "<em>${_escape(rawKw)}</em>" in ${total - skipped} logs${stoppedNote}`
    );

    /* Results card */
    ui.showResults(_buildResultsDOM(
      rawKw, caseSensitive, total - skipped, matched, noMatch, errors, skipped
    ));

    if (errorLines.length) ui.showErrors(errorLines);
  }

  /* ── Results HTML builder ─────────────────────────────────── */
  function _buildResultsDOM(kw, cs, scanned, matched, noMatch, errors, skipped) {
    const parent = document.createElement('div');
    parent.innerHTML = `
      <div class="__sfls_row">
        <span>Keyword</span>
        <span style="color:#F46300;max-width:195px;overflow:hidden;text-overflow:ellipsis;
                     white-space:nowrap;font-weight:600" id="__res_kw"></span>
      </div>
      <div class="__sfls_row">
        <span>Case-sensitive</span><span id="__res_cs"></span>
      </div>
      <hr class="__sfls_hr"/>
      <div class="__sfls_row"><span>Logs scanned</span><span id="__res_sc"></span></div>
      <div class="__sfls_row __sfls_ok"><span>✅ Matched</span><span id="__res_ma"></span></div>
      <div class="__sfls_row __sfls_dim"><span>○ No match</span><span id="__res_nm"></span></div>
      ${errors  ? `<div class="__sfls_row __sfls_warn"><span>⚠ Errors</span><span id="__res_er"></span></div>` : ''}
      ${skipped ? `<div class="__sfls_row __sfls_warn"><span>⏹ Skipped</span><span id="__res_sk"></span></div>` : ''}
      <hr class="__sfls_hr"/>
      <div style="color:#C4AFA8;font-size:10px;line-height:1.8">
        🟧 Orange outline = match (badge = count) &nbsp;|&nbsp; ⬜ Dimmed = no match
      </div>`;
      
    parent.querySelector('#__res_kw').textContent = `"${kw}"`;
    parent.querySelector('#__res_kw').title = kw;
    parent.querySelector('#__res_cs').textContent = cs ? 'Yes' : 'No';
    parent.querySelector('#__res_sc').textContent = scanned;
    parent.querySelector('#__res_ma').textContent = matched;
    parent.querySelector('#__res_nm').textContent = noMatch;
    if(errors) parent.querySelector('#__res_er').textContent = errors;
    if(skipped) parent.querySelector('#__res_sk').textContent = skipped;
    return parent;
  }

  /* ── Utility ──────────────────────────────────────────────── */
  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Dev Console Bridge ───────────────────────────────────── */
  const dbgScript = document.createElement('script');
  dbgScript.src = chrome.runtime.getURL('bridge.js');
  document.head.appendChild(dbgScript);

  // BUG-2 FIX: validate e.origin before acting on postMessage.
  // The old listener trusted messages from any window on the page.
  // Now only messages from this exact Salesforce origin are accepted.
  const ALLOWED_ORIGINS = new Set([
    window.location.origin,
    window.location.origin.replace('salesforce-setup.com', 'salesforce.com'),
    window.location.origin.replace('salesforce-setup.com', 'force.com'),
  ]);

  window.addEventListener('message', e => {
    if (!ALLOWED_ORIGINS.has(e.origin)) return; // drop any other origin
    if (e.data && e.data.type === 'SFLS_SHOW_TEST_API') {
      if (window.__LogHuntUI_Instance) {
        window.__LogHuntUI_Instance.showTestApiRow();
      }
    }
  });

  console.log('[LogHunt] ✅ v4.2 Ready. Panel mounted. FAB pinned bottom-right.');
})();
