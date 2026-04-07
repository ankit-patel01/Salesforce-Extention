/**
 * ============================================================
 *  SF Debug Log Keyword Searcher  v4  — White & Orange Edition
 *
 *  FEATURES:
 *  • Salesforce floating logo pill — always visible, click to
 *    show/hide the panel, never lost off-screen
 *  • White & burnt-orange editorial design
 *  • Same-origin relative API calls (no CORS issues)
 *  • Tooling API SOQL for log IDs (no DOM link parsing)
 *  • Auto-detects working API endpoint + Bearer fallback
 *
 *  Paste into browser console on: Setup → Debug Logs
 * ============================================================
  */
(async function SFLogSearcher() {
  'use strict';
  // 🛑 LIGHTNING IFRAME GATEKEEPER
  // Only allow the UI to open in the specific window/frame that contains the table
  const isTableHere = document.querySelector('table.list, table[id*="traceTable"]');
  if (!isTableHere) {
    if (window !== window.top) return; // Exit if inside a random hidden background iframe
    if (document.querySelector('iframe')) return; // Exit main Lightning window, let the iframe handle it
  }
  const API_VER        = 'v59.0';
  const FETCH_DELAY_MS = 100;

  /* ── CLEANUP previous instance ─────────────────────────────  */
  ['__sfls_panel','__sfls_style','__sfls_fab'].forEach(id => {
    document.getElementById(id)?.remove();
  });
  document.querySelectorAll('[data-sfls]').forEach(row => {
    row.style.background = row.dataset.sflsOrig ?? '';
    ['sfls-match','sfls-nomatch','sfls-scan','sfls-error']
      .forEach(c => row.classList.remove(c));
    row.querySelector('.__sfls_badge')?.remove();
    delete row.dataset.sfls; delete row.dataset.sflsOrig;
  });

  /* ── FONTS ─────────────────────────────────────────────────  */
  if (!document.getElementById('__sfls_font')) {
    document.head.appendChild(Object.assign(document.createElement('link'), {
      id: '__sfls_font', rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Playfair+Display:wght@700;900&display=swap'
    }));
  }

  /* ══════════════════════════════════════════════════════════
     API LAYER  (same-origin first, Bearer fallback)
     ══════════════════════════════════════════════════════════  */
  let _workingBase = null;

  function findSessionId() {
    const fns = [
      () => window.Sfdc?.Client?.sessionId,
      () => window._sfdcSessionId,
      () => window.__sfdcSessionId,
      () => window.UserContext?.sessionId,
      () => window.sforce?.connection?.sessionId,
      () => {
        for (const s of document.querySelectorAll('script:not([src])')) {
          const m = s.textContent.match(/"sessionId"\s*:\s*"([^"]{20,})"/);
          if (m) return m[1];
        }
      },
      () => { const m = document.cookie.match(/(?:^|;)\s*sid=([^;]+)/); return m?.[1]; }
    ];
    for (const fn of fns) { try { const v = fn(); if (v) return v; } catch(_) {} }
    return null;
  }

  function buildHeaders(useBearer = false) {
    const h = { 'Accept': 'application/json' };
    if (useBearer) { const sid = findSessionId(); if (sid) h['Authorization'] = `Bearer ${sid}`; }
    return h;
  }

  function getCandidateBases() {
    const host = window.location.hostname, origin = window.location.origin;
    const bases = ['', origin];
    if (host.includes('salesforce-setup.com')) {
      const a = origin.replace('salesforce-setup.com', 'salesforce.com');
      if (a !== origin) bases.push(a);
    }
    if (host.startsWith('setup.') && host.includes('force.com')) {
      const a = origin.replace(/^https:\/\/setup\./, 'https://');
      if (a !== origin) bases.push(a);
    }
    return bases;
  }

  async function probeBase(base, useBearer) {
    try {
      const r = await fetch(`${base}/services/data/${API_VER}/tooling/query?q=SELECT+Id+FROM+ApexLog+LIMIT+1`,
        { credentials: 'include', headers: buildHeaders(useBearer) });
      return r.ok;
    } catch (_) { return false; }
  }

  async function detectWorkingBase(cb) {
    if (_workingBase) return _workingBase;
    const bases = getCandidateBases(), sid = findSessionId();
    const attempts = [];
    for (const b of bases) { attempts.push([b, false]); if (sid) attempts.push([b, true]); }
    for (const [base, bearer] of attempts) {
      cb?.(`Probing ${base || '(relative)'}${bearer ? ' +Bearer' : ''}…`);
      if (await probeBase(base, bearer)) { _workingBase = { base, bearer }; return _workingBase; }
    }
    return null;
  }

  async function apiGet(path) {
    const { base, bearer } = _workingBase;
    const res = await fetch(base + path, { credentials: 'include', headers: buildHeaders(bearer) });
    if (!res.ok) { const t = await res.text().catch(()=>''); throw new Error(`HTTP ${res.status}: ${t.slice(0,200)}`); }
    return res.json();
  }

  async function fetchLogBody(logId) {
    const { base, bearer } = _workingBase;
    const res = await fetch(`${base}/services/data/${API_VER}/tooling/sobjects/ApexLog/${logId}/Body`,
      { credentials: 'include', headers: buildHeaders(bearer) });
    if (!res.ok) { const t = await res.text().catch(()=>''); throw new Error(`HTTP ${res.status}: ${t.slice(0,150)}`); }
    return res.text();
  }

  async function queryLogIds(limit) {
    const soql = `SELECT Id,LogUser.Name,StartTime,Status FROM ApexLog ORDER BY StartTime DESC LIMIT ${limit}`;
    const data = await apiGet(`/services/data/${API_VER}/tooling/query?q=${encodeURIComponent(soql)}`);
    return data.records || [];
  }

  function getLogRows() {
    for (const sel of ['table[id*="thetracetable"]','table[id*="traceTable"]','.pbBody table.list','table.list']) {
      const tbl = document.querySelector(sel);
      if (!tbl) continue;
      const rows = [...tbl.querySelectorAll('tbody tr')].filter(r => r.querySelectorAll('td').length >= 3);
      if (rows.length) return rows;
    }
    return [];
  }

  /* ══════════════════════════════════════════════════════════
     LOGO SVG — flame + magnifier mark
     ══════════════════════════════════════════════════════════  */
  const LOGO_SVG = `
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Magnifier circle -->
      <circle cx="13" cy="13" r="8.5" stroke="#F46300" stroke-width="2.5"/>
      <!-- Magnifier handle -->
      <line x1="19.5" y1="19.5" x2="27" y2="27" stroke="#F46300" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Flame inside glass -->
      <path d="M13 18c-2.5 0-4-1.5-4-3.5 0-1.2.7-2 1.4-2.5-.1.6 0 1.2.5 1.6C11.4 11.8 13 10 13 8c0 0 1.5 1.5 1.5 3.5 0 .5-.1 1-.4 1.4.5-.3 1-.9 1-1.9.8.8 1.4 2 1.4 3C16.5 16 15 18 13 18z" fill="#F46300"/>
    </svg>`;

  const LOGO_SVG_WHITE = `
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="13" cy="13" r="8.5" stroke="white" stroke-width="2.5"/>
      <line x1="19.5" y1="19.5" x2="27" y2="27" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M13 18c-2.5 0-4-1.5-4-3.5 0-1.2.7-2 1.4-2.5-.1.6 0 1.2.5 1.6C11.4 11.8 13 10 13 8c0 0 1.5 1.5 1.5 3.5 0 .5-.1 1-.4 1.4.5-.3 1-.9 1-1.9.8.8 1.4 2 1.4 3C16.5 16 15 18 13 18z" fill="white"/>
    </svg>`;

  /* ══════════════════════════════════════════════════════════
     Salesforce FLOATING LOGO (FAB)
     Always stays at bottom-right, click to toggle panel
     ══════════════════════════════════════════════════════════  */
  const fab = document.createElement('div');
  fab.id = '__sfls_fab';
  fab.title = 'SF Log Searcher — click to open';
  fab.innerHTML = `
    <div id="__sfls_fab_inner">
      ${LOGO_SVG_WHITE}
      <span id="__sfls_fab_label">Log Search</span>
      <span id="__sfls_fab_badge" style="display:none">0</span>
    </div>
  `;
  document.body.appendChild(fab);

  /* ══════════════════════════════════════════════════════════
     MAIN PANEL
     ══════════════════════════════════════════════════════════  */
  const panel = document.createElement('div');
  panel.id = '__sfls_panel';
  panel.innerHTML = `

    <!-- ── HEADER ── -->
    <div id="__sfls_hdr">
      <div id="__sfls_hdr_logo">
        <img id="__sfls_Salesforce_logo" 
             src="${chrome.runtime.getURL('icon16.png')}" 
             alt="Log" />
             
        <div id="__sfls_hdr_title">
          <span id="__sfls_hdr_name">LogHunt</span>
          <span id="__sfls_hdr_sub">Debug Log Searcher</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span id="__sfls_drag" title="Drag to move">⠿</span>
        <button id="__sfls_minimize" title="Minimize">−</button>
        <button id="__sfls_close" title="Close">✕</button>
      </div>
    </div>

    <!-- ── BODY ── -->
    <div id="__sfls_body">

      <!-- Connection pill -->
      <div id="__sfls_conn_row">
        <span id="__sfls_conn_dot">○</span>
        <span id="__sfls_conn_txt">Connecting…</span>
        <button id="__sfls_test_btn">Test API</button>
      </div>

      <!-- Divider label -->
      <div class="__sfls_section_label">SEARCH</div>

      <!-- Keyword input -->
      <div id="__sfls_input_row">
        <div id="__sfls_input_wrap">
          <span id="__sfls_input_icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8A89E" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input id="__sfls_kw" type="text"
                 placeholder="Class name, Record ID, method…"
                 autocomplete="off" spellcheck="false"/>
        </div>
        <label id="__sfls_case_lbl" title="Case-sensitive matching">
          <input type="checkbox" id="__sfls_case"/> Aa
        </label>
      </div>

      <!-- Scan limit -->
      <div id="__sfls_limit_row">
        <span class="__sfls_limit_lbl">Scan latest</span>
        <select id="__sfls_limit">
          <option value="20" selected>20 logs</option>
          <option value="50">50 logs</option>
          <option value="100">100 logs</option>
          <option value="200">200 logs</option>
        </select>
        <span id="__sfls_row_count"></span>
      </div>

      <!-- Action buttons -->
      <div id="__sfls_btn_row">
        <button id="__sfls_search_btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-right:4px">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          Search All Logs
        </button>
        <button id="__sfls_stop_btn" disabled>■ Stop</button>
        <button id="__sfls_clear_btn">Clear</button>
      </div>

      <!-- Progress -->
      <div id="__sfls_prog_wrap">
        <div id="__sfls_prog_track">
          <div id="__sfls_prog_bar"></div>
        </div>
        <span id="__sfls_prog_pct">0%</span>
      </div>

      <!-- Status line -->
      <div id="__sfls_status"></div>

      <!-- Results card -->
      <div id="__sfls_results"></div>

      <!-- Error detail -->
      <details id="__sfls_err_det" style="display:none">
        <summary>▸ Fetch error log</summary>
        <div id="__sfls_err_log"></div>
      </details>

    </div>

    <!-- ── FOOTER ── -->
    <div id="__sfls_footer">
      <span>v4 · Tooling API · Same-origin</span>
      <span id="__sfls_api_ver">API ${API_VER}</span>
    </div>
  `;
  document.body.appendChild(panel);

  /* ══════════════════════════════════════════════════════════
     STYLES
     ══════════════════════════════════════════════════════════  */
  const style = document.createElement('style');
  style.id = '__sfls_style';
  style.textContent = `

    /* ── FONTS & ROOT ──  */
    #__sfls_panel, #__sfls_fab {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
    }

    /* ══════════════════════════════════════
       Salesforce FAB (Floating Action Button)
       ══════════════════════════════════════  */
    #__sfls_fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      cursor: pointer;
      filter: drop-shadow(0 4px 16px rgba(244,99,0,.35));
      transition: filter .2s, transform .2s;
    }
    #__sfls_fab:hover {
      filter: drop-shadow(0 6px 22px rgba(244,99,0,.55));
      transform: scale(1.05);
    }
    #__sfls_fab:active { transform: scale(.97); }
    #__sfls_fab_inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 58px; height: 58px;
      background: linear-gradient(145deg, #F46300, #C94F00);
      border-radius: 16px;
      border: 2px solid rgba(255,255,255,.25);
      position: relative;
      gap: 1px;
    }
    #__sfls_fab_label {
      font-size: 8px;
      font-weight: 700;
      color: rgba(255,255,255,.9);
      text-align: center;
      line-height: 1.2;
      letter-spacing: .3px;
    }
    #__sfls_fab_badge {
      position: absolute;
      top: -6px; right: -6px;
      background: #1A7A3A;
      color: white;
      font-size: 9px; font-weight: 700;
      padding: 1px 5px;
      border-radius: 10px;
      border: 2px solid white;
      min-width: 18px;
      text-align: center;
    }

    /* ══════════════════════════════════════
       MAIN PANEL
       ══════════════════════════════════════  */
    #__sfls_panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      z-index: 2147483647;
      width: 380px;
      background: #FFFFFF;
      border: 1.5px solid #FFD4B0;
      border-radius: 16px;
      box-shadow:
        0 0 0 1px rgba(244,99,0,.08),
        0 8px 16px rgba(244,99,0,.08),
        0 24px 48px rgba(0,0,0,.12);
      overflow: hidden;
      user-select: none;
      /* Slide-in animation  */
      animation: __sfls_slidein .22s cubic-bezier(.22,1,.36,1);
    }
    @keyframes __sfls_slidein {
      from { opacity:0; transform: translateY(12px) scale(.97); }
      to   { opacity:1; transform: translateY(0)   scale(1); }
    }
    #__sfls_panel.--collapsed #__sfls_body,
    #__sfls_panel.--collapsed #__sfls_footer {
      display: none;
    }

   /* ── YOUR NEW HEADER STYLE ──  */
   /* ── COMPACT PANEL ──  */
    #__sfls_panel {
      position: fixed; 
      top: 15px; 
      right: 15px; 
      z-index: 2147483647;
      width: 310px; /* Reduced from 375px  */
      background: #ffffff;
      border: 1px solid #FFD4B0; 
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.1);
      font-family: 'Segoe UI', sans-serif;
      overflow: hidden;
    }

    /* ── TIGHTER HEADER ──  */
    #__sfls_hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px; /* Thinner padding  */
      background: linear-gradient(135deg, #FFF5EE 0%, #FFF9F5 100%);
      border-bottom: 1.5px solid #FFD4B0;
      cursor: move;
    }

    #__sfls_hdr_logo img {
      height: 20px !important; /* Smaller logo  */
      width: auto;
    }

    #__sfls_hdr_name {
      font-family: 'Playfair Display', serif;
      font-weight: 900;
      font-size: 15px; /* Scaled down from 18px  */
      color: #1C1412;
      line-height: 1;
    }

    #__sfls_hdr_sub {
      font-size: 8px; /* Micro text  */
      color: #B8A89E;
      text-transform: uppercase;
      font-weight: 500;
    }

    /* ── COMPACT BODY ──  */
    #__sfls_body { 
      padding: 10px; /* Reduced from 15px  */
    }

    #__sfls_input_row { 
      gap: 5px; 
      margin-bottom: 8px; 
    }

    #__sfls_kw { 
      padding: 6px 8px; /* Tighter inputs  */
      font-size: 11px;
    }

    #__sfls_btn_row button {
      padding: 6px 2px; /* Smaller buttons  */
      font-size: 10px;
    }
#__sfls_hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 12px;
  background: linear-gradient(135deg, #FFF5EE 0%, #FFF9F5 100%);
  border-bottom: 1.5px solid #FFD4B0;
  cursor: move;
}

#__sfls_hdr_logo {
  display: flex;
  align-items: center;
  gap: 12px; /* Slightly increased gap for the logo  */
}

#__sfls_hdr_title {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

#__sfls_hdr_name {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 900;
  font-size: 18px;
  color: #1C1412;
  letter-spacing: -.4px;
  line-height: 1;
}

#__sfls_hdr_sub {
  font-size: 9px;
  color: #B8A89E;
  letter-spacing: .6px;
  text-transform: uppercase;
  font-weight: 500;
}

/* Updated Button Styles for Light Theme  */
.__sfls_hdr_btn {
  background: none;
  border: none;
  color: #1C1412;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  padding: 0 4px;
}

.__sfls_hdr_btn:hover {
  opacity: 1;
  color: #f37021; /* Turns orange on hover  */
}
    #__sfls_hdr > div button,
    #__sfls_minimize {
      background: none;
      border: none;
      cursor: pointer;
      color: #C4AFA8;
      font-size: 16px;
      line-height: 1;
      padding: 3px 5px;
      border-radius: 5px;
      transition: background .15s, color .15s;
    }
    #__sfls_hdr > div button:hover { background: #FFE8D6; color: #F46300; }
    #__sfls_drag {
      cursor: move;
      color: #D4C4BC;
      font-size: 16px;
      padding: 3px 4px;
    }

    /* ── BODY ──  */
    #__sfls_body { padding: 14px; background: #FFFFFF; }

    /* Connection row  */
    #__sfls_conn_row {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 10px;
      background: #FFF9F5;
      border: 1.5px solid #FFD4B0;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 10px;
      color: #A09090;
    }
    #__sfls_conn_dot { font-size: 11px; transition: color .3s; }
    #__sfls_conn_txt {
      flex: 1;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 10px;
    }
    #__sfls_test_btn {
      padding: 3px 9px;
      background: #FFFFFF;
      border: 1.5px solid #F46300;
      border-radius: 5px;
      color: #F46300;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px; font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
      transition: background .15s, color .15s;
      letter-spacing: .3px;
    }
    #__sfls_test_btn:hover { background: #F46300; color: #FFFFFF; }
    #__sfls_test_btn:disabled { opacity: .4; cursor: not-allowed; }

    /* Section label  */
    .__sfls_section_label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #C4AFA8;
      margin-bottom: 7px;
    }

    /* Input  */
    #__sfls_input_row { display: flex; gap: 7px; margin-bottom: 9px; }
    #__sfls_input_wrap {
      flex: 1;
      position: relative;
    }
    #__sfls_input_icon {
      position: absolute;
      left: 10px; top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      display: flex; align-items: center;
    }
    #__sfls_kw {
      width: 100%;
      padding: 9px 10px 9px 32px;
      background: #FFF9F5;
      border: 1.5px solid #E8DED8;
      border-radius: 8px;
      color: #1C1412;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      outline: none;
      transition: border-color .2s, box-shadow .2s;
      box-sizing: border-box;
    }
    #__sfls_kw::placeholder { color: #C4AFA8; }
    #__sfls_kw:focus {
      border-color: #F46300;
      box-shadow: 0 0 0 3px rgba(244,99,0,.1);
    }
    #__sfls_case_lbl {
      display: flex; align-items: center; gap: 4px;
      padding: 0 10px;
      background: #FFF9F5;
      border: 1.5px solid #E8DED8;
      border-radius: 8px;
      cursor: pointer;
      color: #A09090;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;
      transition: border-color .15s;
    }
    #__sfls_case_lbl:hover { border-color: #F46300; color: #F46300; }
    #__sfls_case_lbl input { cursor: pointer; accent-color: #F46300; }

    /* Limit row  */
    #__sfls_limit_row {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 11px;
      font-size: 11px; color: #A09090;
    }
    .__sfls_limit_lbl { flex-shrink: 0; }
    #__sfls_limit {
      padding: 4px 8px;
      background: #FFF9F5;
      border: 1.5px solid #E8DED8;
      border-radius: 6px;
      color: #1C1412;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px; outline: none; cursor: pointer;
    }
    #__sfls_row_count { margin-left: auto; font-size: 10px; color: #C4AFA8; }

    /* Buttons  */
    #__sfls_btn_row { display: flex; gap: 7px; margin-bottom: 11px; }
    #__sfls_btn_row button {
      flex: 1; padding: 9px 4px; border: none; border-radius: 8px;
      cursor: pointer;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px; font-weight: 700;
      transition: all .15s; letter-spacing: .2px;
    }
    #__sfls_btn_row button:active { transform: scale(.97); }
    #__sfls_search_btn {
      background: linear-gradient(135deg, #F46300, #C94F00);
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(244,99,0,.3);
    }
    #__sfls_search_btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #FF7A1A, #D95F00);
      box-shadow: 0 4px 14px rgba(244,99,0,.4);
    }
    #__sfls_stop_btn {
      background: #FFF0E6;
      color: #C94F00;
      border: 1.5px solid #F4C4A0;
    }
    #__sfls_stop_btn:hover:not(:disabled) { background: #FFE0CC; }
    #__sfls_clear_btn {
      background: #F5F0EE;
      color: #A09090;
      border: 1.5px solid #E8DED8;
    }
    #__sfls_clear_btn:hover { background: #EDE8E5; color: #7A6A62; }
    button:disabled { opacity: .4; cursor: not-allowed; }

    /* Progress  */
    #__sfls_prog_wrap {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 9px;
    }
    #__sfls_prog_track {
      flex: 1; height: 4px;
      background: #F5EFEA;
      border-radius: 2px; overflow: hidden;
    }
    #__sfls_prog_bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #F46300, #FF8C3A);
      border-radius: 2px;
      transition: width .2s ease;
    }
    #__sfls_prog_pct {
      font-size: 10px; color: #C4AFA8;
      width: 28px; text-align: right; flex-shrink: 0;
    }

    /* Status  */
    #__sfls_status {
      min-height: 16px;
      font-size: 11px; color: #7A6A62;
      margin-bottom: 9px; line-height: 1.6;
    }

    /* Results card  */
    #__sfls_results {
      background: #FFF9F5;
      border: 1.5px solid #FFD4B0;
      border-radius: 10px;
      padding: 11px 12px;
      display: none;
      font-size: 11px;
      line-height: 2;
    }
    .__sfls_row  { display: flex; justify-content: space-between; color: #5A4A42; }
    .__sfls_ok   { color: #1A7A3A; font-weight: 700; }
    .__sfls_dim  { color: #C4AFA8; }
    .__sfls_warn { color: #C94F00; font-weight: 600; }
    .__sfls_hr   { border: none; border-top: 1px solid #FFD4B0; margin: 5px 0; }

    /* Error details  */
    #__sfls_err_det { margin-top: 8px; font-size: 10px; color: #C94F00; }
    #__sfls_err_det summary { cursor: pointer; }
    #__sfls_err_log {
      margin-top: 5px; max-height: 110px; overflow-y: auto;
      background: #FFF5EE; border: 1px solid #F4C4A0;
      border-radius: 6px; padding: 8px;
      color: #C94F00; line-height: 1.7; word-break: break-all;
      font-size: 10px;
    }

    /* ── FOOTER ──  */
    #__sfls_footer {
      display: flex; justify-content: space-between;
      padding: 7px 14px;
      background: #FFF5EE;
      border-top: 1px solid #FFD4B0;
      font-size: 9px; color: #C4AFA8;
      letter-spacing: .4px;
    }

    /* ══════════════════════════════════════
       SF TABLE ROW HIGHLIGHTS
       ══════════════════════════════════════  */
    .__sfls_badge {
      display: inline-block;
      background: #FFF0E0;
      color: #C94F00;
      border: 1px solid #F4C4A0;
      border-radius: 4px;
      padding: 0 6px;
      font-size: 9px; font-weight: 700;
      font-family: 'IBM Plex Mono', monospace;
      vertical-align: middle; margin-right: 6px;
      letter-spacing: .5px;
    }
    .sfls-match {
      background: #FFF8EC !important;
      outline: 2px solid #F46300;
      outline-offset: -1px;
    }
    .sfls-nomatch {
      background: #FAFAF9 !important;
      opacity: .5;
    }
    .sfls-scan {
      background: #FFF5F0 !important;
    }
    .sfls-error {
      background: #FFF5F5 !important;
    }
  `;
  document.head.appendChild(style);

  /* ══════════════════════════════════════════════════════════
     DRAG  (for the main panel)
     ══════════════════════════════════════════════════════════  */
  (function() {
    const hdr = document.getElementById('__sfls_hdr');
    let ox=0, oy=0, on=false;
    hdr.addEventListener('mousedown', e => {
      if (['__sfls_close','__sfls_minimize'].includes(e.target.id)) return;
      on = true;
      const r = panel.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
    });
    document.addEventListener('mousemove', e => {
      if (!on) return;
      panel.style.left   = (e.clientX - ox) + 'px';
      panel.style.top    = (e.clientY - oy) + 'px';
      panel.style.right  = 'auto';
      panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { on = false; });
  })();

  /* ══════════════════════════════════════════════════════════
     FAB / PANEL TOGGLE
     ══════════════════════════════════════════════════════════  */
  let panelVisible = true;

  function showPanel() {
    panel.style.display = 'block';
    panel.classList.remove('--collapsed');
    panelVisible = true;
    fab.title = 'SF Log Searcher — click to hide';
  }
  function hidePanel() {
    panel.style.display = 'none';
    panelVisible = false;
    fab.title = 'SF Log Searcher — click to open';
  }

  fab.addEventListener('click', () => panelVisible ? hidePanel() : showPanel());
  document.getElementById('__sfls_minimize').addEventListener('click', hidePanel);

  /* ══════════════════════════════════════════════════════════
     DOM REFS
     ══════════════════════════════════════════════════════════  */
  const $$ = id => document.getElementById(id);
  const elKw        = $$('__sfls_kw');
  const elCase      = $$('__sfls_case');
  const elLimit     = $$('__sfls_limit');
  const elStatus    = $$('__sfls_status');
  const elResults   = $$('__sfls_results');
  const elBar       = $$('__sfls_prog_bar');
  const elPct       = $$('__sfls_prog_pct');
  const elRowCount  = $$('__sfls_row_count');
  const elSearchBtn = $$('__sfls_search_btn');
  const elStopBtn   = $$('__sfls_stop_btn');
  const elClearBtn  = $$('__sfls_clear_btn');
  const elErrDet    = $$('__sfls_err_det');
  const elErrLog    = $$('__sfls_err_log');
  const elConnDot   = $$('__sfls_conn_dot');
  const elConnTxt   = $$('__sfls_conn_txt');
  const elTestBtn   = $$('__sfls_test_btn');
  const elFabBadge  = $$('__sfls_fab_badge');

  function setConn(ok, label) {
    elConnDot.style.color = ok ? '#1A7A3A' : '#C94F00';
    elConnDot.textContent  = ok ? '●' : '✕';
    elConnTxt.textContent  = label;
  }

  function setProgress(pct) {
    elBar.style.width = pct + '%';
    elPct.textContent = pct + '%';
  }

  function setMatchBadge(n) {
    if (n > 0) {
      elFabBadge.textContent = n;
      elFabBadge.style.display = 'block';
    } else {
      elFabBadge.style.display = 'none';
    }
  }

  function refreshCount() {
    const n = getLogRows().length;
    elRowCount.textContent = n ? `${n} rows` : 'no rows';
  }
  refreshCount();

  /* ══════════════════════════════════════════════════════════
     TEST CONNECTION
     ══════════════════════════════════════════════════════════  */
  async function doTest(quiet = false) {
    elTestBtn.disabled = true;
    if (!quiet) elStatus.textContent = 'Auto-detecting API endpoint…';

    const found = await detectWorkingBase(msg => {
      if (!quiet) elStatus.textContent = msg;
    });

    elTestBtn.disabled = false;

    if (found) {
      const label = (found.base || 'relative') + (found.bearer ? ' +Bearer' : '');
      setConn(true, label);
      if (!quiet) {
        try {
          const d = await apiGet(`/services/data/${API_VER}/tooling/query?q=SELECT+Id+FROM+ApexLog+LIMIT+1`);
          elStatus.innerHTML = `✅ Connected — <b>${d.totalSize ?? '?'}</b> total logs in org`;
        } catch(_) {
          elStatus.innerHTML = `✅ Connected via <b>${label}</b>`;
        }
      }
      return true;
    } else {
      setConn(false, 'No working endpoint found');
      if (!quiet) {
        elStatus.innerHTML = `❌ All endpoints failed.<br>
          1. Refresh the page &amp; re-paste<br>
          2. Confirm you're on Setup → Debug Logs<br>
          3. Check console for CORS errors`;
      }
      return false;
    }
  }

  elTestBtn.addEventListener('click', () => doTest(false));

  /* ══════════════════════════════════════════════════════════
     CLEAR
     ══════════════════════════════════════════════════════════  */
  function doClear() {
    document.querySelectorAll('[data-sfls]').forEach(row => {
      row.style.background = row.dataset.sflsOrig ?? '';
      ['sfls-match','sfls-nomatch','sfls-scan','sfls-error']
        .forEach(c => row.classList.remove(c));
      row.querySelector('.__sfls_badge')?.remove();
      delete row.dataset.sfls; delete row.dataset.sflsOrig;
    });
    setProgress(0);
    elStatus.textContent = '';
    elResults.style.display = 'none'; elResults.innerHTML = '';
    elErrDet.style.display  = 'none'; elErrLog.innerHTML  = '';
    setMatchBadge(0);
    refreshCount();
  }
  elClearBtn.addEventListener('click', doClear);
  $$('__sfls_close').addEventListener('click', () => {
    doClear(); panel.remove(); fab.remove(); style.remove();
  });

  /* ── STOP ──  */
  let stopSignal = false;
  elStopBtn.addEventListener('click', () => { stopSignal = true; });

  /* ══════════════════════════════════════════════════════════
     MAIN SEARCH
     ══════════════════════════════════════════════════════════  */
  let running = false;
  
  async function doSearch() {
    if (running) return;

    const rawKw = elKw.value.trim();
    if (!rawKw) { elStatus.textContent = '⚠ Please enter a keyword.'; return; }

    doClear();
    running = true; stopSignal = false;
    elSearchBtn.disabled = true; elStopBtn.disabled = false;

    /* Ensure connection  */
    if (!_workingBase) {
      elStatus.textContent = 'Finding API endpoint…';
      const ok = await doTest(true);
      if (!ok) {
        elStatus.innerHTML = '❌ Cannot reach Tooling API. Click <b>Test API</b>.';
        running = false; elSearchBtn.disabled = false; elStopBtn.disabled = true;
        return;
      }
    }

    const caseSensitive = elCase.checked;
    const keyword       = caseSensitive ? rawKw : rawKw.toLowerCase();
    const limit         = parseInt(elLimit.value, 10);
    const rows          = getLogRows();

    /* Step 1: Query log IDs  */
    elStatus.textContent = `Fetching ${limit} log IDs via Tooling API…`;
    let logRecords = [];
    try {
      logRecords = await queryLogIds(limit);
    } catch (err) {
      elStatus.innerHTML = `❌ SOQL query failed: ${err.message}`;
      running = false; elSearchBtn.disabled = false; elStopBtn.disabled = true;
      return;
    }

    if (!logRecords.length) {
      elStatus.textContent = '✗ No ApexLog records found in org.';
      running = false; elSearchBtn.disabled = false; elStopBtn.disabled = true;
      return;
    }

    const total      = logRecords.length;
    const errorLines = [];
    let matched = 0, noMatch = 0, errors = 0, skipped = 0;

    /* Step 2: Fetch + search each log body  */
    for (let i = 0; i < logRecords.length; i++) {
      if (stopSignal) { skipped = logRecords.length - i; break; }

      const rec = logRecords[i];
      const row = rows[i];

      if (row) {
        if (!row.dataset.sfls) row.dataset.sflsOrig = row.style.background || '';
        row.dataset.sfls = 'scan';
        row.classList.add('sfls-scan');
      }

      const pct = Math.round((i / total) * 100);
      setProgress(pct);
      elStatus.textContent = `Scanning ${i + 1} / ${total}  ·  ${matched} match(es) found`;

      try {
        const body     = await fetchLogBody(rec.Id);
        const haystack = caseSensitive ? body : body.toLowerCase();
        const found    = haystack.includes(keyword);

        if (row) {
          row.classList.remove('sfls-scan');
          row.dataset.sfls = found ? 'match' : 'nomatch';
          row.classList.add(found ? 'sfls-match' : 'sfls-nomatch');
        }

        if (found) {
          matched++;
          let cnt = 0, pos = 0;
          while ((pos = haystack.indexOf(keyword, pos)) !== -1) { cnt++; pos++; }

          if (row) {
            const td = row.querySelector('td');
            if (td && !td.querySelector('.__sfls_badge')) {
              const b = document.createElement('span');
              b.className  = '__sfls_badge';
              b.textContent = `MATCH ×${cnt}`;
              td.prepend(b);
            }
            if (matched === 1) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }

          setMatchBadge(matched); // update FAB badge live
          console.log(`[LogHunt] ✅ ${rec.Id}  (${rec['LogUser.Name'] ?? ''})  ×${cnt}`);
        } else {
          noMatch++;
        }
      } catch (err) {
        if (row) { row.classList.remove('sfls-scan'); row.classList.add('sfls-error'); row.dataset.sfls = 'error'; }
        errors++;
        errorLines.push(`#${i+1} ${rec.Id}: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
    }

    /* ── DONE ──  */
    setProgress(100);
    running = false; elSearchBtn.disabled = false; elStopBtn.disabled = true;

    const stopped = stopSignal ? ' <em style="color:#C94F00">(stopped)</em>' : '';
    elStatus.innerHTML = matched
      ? `✅ <strong style="color:#1A7A3A">${matched} match(es)</strong> for "<em>${rawKw}</em>"${stopped}`
      : `No matches for "<em>${rawKw}</em>" in ${total - skipped} logs${stopped}`;

    elResults.innerHTML = `
      <div class="__sfls_row">
        <span>Keyword</span>
        <span style="color:#F46300;max-width:200px;overflow:hidden;text-overflow:ellipsis;
                     white-space:nowrap;font-weight:600" title="${rawKw}">"${rawKw}"</span>
      </div>
      <div class="__sfls_row">
        <span>Case-sensitive</span>
        <span>${caseSensitive ? 'Yes' : 'No'}</span>
      </div>
      <hr class="__sfls_hr"/>
      <div class="__sfls_row">
        <span>Logs scanned</span><span>${total - skipped}</span>
      </div>
      <div class="__sfls_row __sfls_ok">
        <span>✅ Matched</span><span>${matched}</span>
      </div>
      <div class="__sfls_row __sfls_dim">
        <span>○ No match</span><span>${noMatch}</span>
      </div>
      ${errors  ? `<div class="__sfls_row __sfls_warn"><span>⚠ Errors</span><span>${errors}</span></div>` : ''}
      ${skipped ? `<div class="__sfls_row __sfls_warn"><span>⏹ Skipped</span><span>${skipped}</span></div>` : ''}
      <hr class="__sfls_hr"/>
      <div style="color:#C4AFA8;font-size:10px;line-height:1.8">
        🟧 Orange outline = matched (badge = count) &nbsp;|&nbsp; ⬜ Dimmed = no match
      </div>
    `;
    elResults.style.display = 'block';

    if (errorLines.length) {
      elErrLog.innerHTML = errorLines.map(l => `<div>• ${l.replace(/</g,'&lt;')}</div>`).join('');
      elErrDet.style.display = 'block';
    }
  }

  elSearchBtn.addEventListener('click', doSearch);
  elKw.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  /* ── Auto-probe on load ────────────────────────────────────  */
  setTimeout(() => {
    elKw.focus();
    doTest(true).then(ok => {
      if (ok) setConn(true, (_workingBase?.base || 'relative') + (_workingBase?.bearer ? ' +Bearer' : ''));
      else    setConn(false, 'Click "Test API" to diagnose');
    });
  }, 350);

  refreshCount();
  console.log('[LogHunt v4] ✅ Ready — white & orange edition. FAB is pinned bottom-right.');
})();