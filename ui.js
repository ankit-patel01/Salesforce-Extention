/**
 * ==========================================
 * LogHunt Chrome Extension
 * Author: Ankit Patel
 * Contact: ankit.ap.patel01@gmail.com
 * ==========================================
 */
/**
 * LogHunt — ui.js
 * Builds and manages the floating panel UI and FAB button.
 * Pure presentation layer — zero API calls here.
 */
window.__LogHunt = window.__LogHunt || {};
window.__LogHunt.UI = class LogHuntUI {
  constructor(onSearch, onStop, onClear, onTest) {
    this._onSearch = onSearch;
    this._onStop   = onStop;
    this._onClear  = onClear;
    this._onTest   = onTest;
    this._panelVisible = true;
    this._panel = null;
    this._fab   = null;
    this._host  = null;
    this._shadow = null;
  }

  /* ══════════════════════════════════════════════════════════
     BOOT — inject fonts, styles, FAB, panel
     ══════════════════════════════════════════════════════════ */
  mount() {
    this._host = document.createElement('div');
    this._host.id = 'loghunt-host';
    this._shadow = this._host.attachShadow({ mode: 'closed' });
    document.body.appendChild(this._host);

    this._injectStyles();
    this._mountFAB();
    this._mountPanel();
    this._bindEvents();
    this._autoDragPanel();
  }

  destroy() {
    if (this._host) this._host.remove();
    delete window.__LogHuntInjected;
  }

  /* ── FAB ────────────────────────────────────────────────── */
  _mountFAB() {
    const fab = document.createElement('div');
    fab.id        = window.__LogHunt.Config.FAB_ID;
    fab.title     = 'LogHunt — click to open';
    fab.innerHTML = `
      <div id="__sfls_fab_inner">
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <circle cx="13" cy="13" r="8.5" stroke="white" stroke-width="2.5"/>
          <line x1="19.5" y1="19.5" x2="27" y2="27" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M13 18c-2.5 0-4-1.5-4-3.5 0-1.2.7-2 1.4-2.5-.1.6 0 1.2.5 1.6
                   C11.4 11.8 13 10 13 8c0 0 1.5 1.5 1.5 3.5 0 .5-.1 1-.4 1.4
                   .5-.3 1-.9 1-1.9.8.8 1.4 2 1.4 3C16.5 16 15 18 13 18z"
                fill="white"/>
        </svg>
        <span id="__sfls_fab_label">Log<br>Hunt</span>
        <span id="__sfls_fab_badge" style="display:none">0</span>
      </div>`;
    this._shadow.appendChild(fab);
    this._fab = fab;
  }

  /* ── Panel ──────────────────────────────────────────────── */
  _mountPanel() {
    const panel = document.createElement('div');
    panel.id = window.__LogHunt.Config.PANEL_ID;
    panel.innerHTML = `
      <!-- HEADER -->
      <div id="__sfls_hdr">
        <div id="__sfls_hdr_logo">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <circle cx="13" cy="13" r="8.5" stroke="#F46300" stroke-width="2.5"/>
            <line x1="19.5" y1="19.5" x2="27" y2="27" stroke="#F46300" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M13 18c-2.5 0-4-1.5-4-3.5 0-1.2.7-2 1.4-2.5-.1.6 0 1.2.5 1.6
                     C11.4 11.8 13 10 13 8c0 0 1.5 1.5 1.5 3.5 0 .5-.1 1-.4 1.4
                     .5-.3 1-.9 1-1.9.8.8 1.4 2 1.4 3C16.5 16 15 18 13 18z"
                  fill="#F46300"/>
          </svg>
          <div id="__sfls_hdr_title">
            <span id="__sfls_hdr_name">LogHunt</span>
            <span id="__sfls_hdr_sub">SF Debug Log Searcher</span>
          </div>
        </div>
        <div class="__sfls_hdr_actions">
          <span id="__sfls_drag" title="Drag">⠿</span>
          <button id="__sfls_minimize" title="Minimize">−</button>
          <button id="__sfls_close"    title="Close">✕</button>
        </div>
      </div>

      <!-- BODY -->
      <div id="__sfls_body">

        <!-- Connection pill -->
        <div id="__sfls_conn_row" style="display:none">
          <span id="__sfls_conn_dot">○</span>
          <span id="__sfls_conn_txt">Connecting…</span>
          <button id="__sfls_test_btn">Test API</button>
        </div>

        <div class="__sfls_section_label">SEARCH</div>

        <!-- Keyword input -->
        <div id="__sfls_input_row">
          <div id="__sfls_input_wrap">
            <span id="__sfls_input_icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="#C4AFA8" stroke-width="2.2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input id="__sfls_kw" type="text"
                   placeholder="Class name, Record ID, method…"
                   autocomplete="off" spellcheck="false"/>
          </div>
          <label id="__sfls_case_lbl" title="Case-sensitive">
            <input type="checkbox" id="__sfls_case"/> Aa
          </label>
        </div>

        <!-- Scan limit — defaults to visible row count -->
        <div id="__sfls_limit_row">
          <span class="__sfls_lbl">Scan</span>
          <select id="__sfls_limit">
            <!-- Options populated dynamically based on row count -->
          </select>
          <span id="__sfls_row_count"></span>
        </div>

        <!-- Buttons -->
        <div id="__sfls_btn_row">
          <button id="__sfls_search_btn">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 style="vertical-align:-1px;margin-right:4px">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Search Logs
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

        <!-- Status -->
        <div id="__sfls_status"></div>

        <!-- Results card -->
        <div id="__sfls_results"></div>

        <!-- Error detail -->
        <details id="__sfls_err_det" style="display:none">
          <summary>▸ Fetch error log</summary>
          <div id="__sfls_err_log"></div>
        </details>

      </div>

      <!-- FOOTER -->
      <div id="__sfls_footer">
        <span>LogHunt v4 · Tooling API</span>
        <span>API ${window.__LogHunt.Config.API_VER}</span>
      </div>
    `;
    this._shadow.appendChild(panel);
    this._panel = panel;
  }

  /* ── Event binding ──────────────────────────────────────── */
  _bindEvents() {
    const $  = id => this._shadow.querySelector('#' + id);

    $('__sfls_search_btn').addEventListener('click', () => this._onSearch());
    $('__sfls_stop_btn'  ).addEventListener('click', () => this._onStop());
    $('__sfls_clear_btn').addEventListener('click', () => { this.clearKeyword(); this._onClear(); });
    $('__sfls_test_btn'  ).addEventListener('click', () => this._onTest(false));
    $('__sfls_kw'        ).addEventListener('keydown', e => { if (e.key === 'Enter') this._onSearch(); });

    $('__sfls_minimize').addEventListener('click', () => this.hidePanel());
    $('__sfls_close'   ).addEventListener('click', () => {
      this._onClear();
      this.destroy();
    });

    this._fab.addEventListener('click', () =>
      this._panelVisible ? this.hidePanel() : this.showPanel()
    );
  }

  /* ── Drag ───────────────────────────────────────────────── */
  _autoDragPanel() {
    const hdr = this._shadow.querySelector('#__sfls_hdr');
    let ox = 0, oy = 0, active = false;

    hdr.addEventListener('mousedown', e => {
      const skip = ['__sfls_close','__sfls_minimize'];
      if (skip.includes(e.target.id)) return;
      active = true;
      const r = this._panel.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
    });
    document.addEventListener('mousemove', e => {
      if (!active) return;
      this._panel.style.left   = (e.clientX - ox) + 'px';
      this._panel.style.top    = (e.clientY - oy) + 'px';
      this._panel.style.right  = 'auto';
      this._panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { active = false; });
  }

  /* ── Panel show / hide ──────────────────────────────────── */
  showPanel() {
    this._panel.style.display = 'block';
    this._panelVisible = true;
    this._fab.title = 'LogHunt — click to hide';
  }
  hidePanel() {
    this._panel.style.display = 'none';
    this._panelVisible = false;
    this._fab.title = 'LogHunt — click to open';
  }

  /* ── Limit dropdown (auto-sets from visible rows) ────────── */
  /**
   * Rebuild the <select> so its first option = visible row count,
   * then offers 50 / 100 / 200 as larger options.
   * Default selection = visible row count.
   */
  buildLimitOptions(visibleRows) {
    const sel = this._shadow.querySelector('#__sfls_limit');
    sel.innerHTML = '';

    const options = new Set([visibleRows].filter(n => n > 0));
    [...options].sort((a, b) => a - b).forEach(n => {
      const opt = document.createElement('option');
      opt.value       = n;
      opt.textContent = `${n} rows (visible)`;
      opt.selected = true;
      sel.appendChild(opt);
    });
  }

  /* ── Getters for search inputs ────────────────────────────── */
  get keyword() { return this._shadow.querySelector('#__sfls_kw').value.trim(); }
  clearKeyword() { this._shadow.querySelector('#__sfls_kw').value = ''; }
  focusKeyword() { 
    const kw = this._shadow.querySelector('#__sfls_kw');
    if (kw) kw.focus(); 
  }
  get caseSensitive() { return this._shadow.querySelector('#__sfls_case').checked; }
  get scanLimit()     { return parseInt(this._shadow.querySelector('#__sfls_limit').value, 10) || 0; }

  /* ── State setters ─────────────────────────────────────────── */
  setSearching(isSearching) {
    this._shadow.querySelector('#__sfls_search_btn').disabled =  isSearching;
    this._shadow.querySelector('#__sfls_stop_btn').disabled = !isSearching;
  }

  setTestBtnEnabled(v) {
    this._shadow.querySelector('#__sfls_test_btn').disabled = !v;
  }

  setProgress(pct) {
    this._shadow.querySelector('#__sfls_prog_bar').style.width = pct + '%';
    this._shadow.querySelector('#__sfls_prog_pct').textContent = pct + '%';
  }

  setStatus(html) {
    this._shadow.querySelector('#__sfls_status').innerHTML = html;
  }

  setStatusText(text) {
    this._shadow.querySelector('#__sfls_status').textContent = text;
  }

  setRowCount(n) {
    this._shadow.querySelector('#__sfls_row_count').textContent =
      n ? `${n} on page` : 'none found';
  }

  setConnection(ok, label) {
    const dot = this._shadow.querySelector('#__sfls_conn_dot');
    const txt = this._shadow.querySelector('#__sfls_conn_txt');
    dot.style.color  = ok ? '#1A7A3A' : '#C94F00';
    dot.textContent  = ok ? '●' : '✕';
    txt.textContent  = label;
    txt.title        = label;
  }

  showTestApiRow() {
    const row = this._shadow.querySelector('#__sfls_conn_row');
    if (row) row.style.display = 'flex';
  }

  setMatchBadge(n) {
    const b = this._shadow.querySelector('#__sfls_fab_badge');
    if (n > 0) { b.textContent = n; b.style.display = 'block'; }
    else        { b.style.display = 'none'; }
  }

  showResults(node) {
    const el = this._shadow.querySelector('#__sfls_results');
    el.textContent = '';
    el.appendChild(node);
    el.style.display = 'block';
  }

  hideResults() {
    const el = this._shadow.querySelector('#__sfls_results');
    el.style.display = 'none';
    el.innerHTML     = '';
  }

  showErrors(lines) {
    const det = this._shadow.querySelector('#__sfls_err_det');
    const log = this._shadow.querySelector('#__sfls_err_log');
    log.textContent = '';
    lines.forEach(l => {
      const d = document.createElement('div');
      d.textContent = '• ' + l;
      log.appendChild(d);
    });
    det.style.display = 'block';
  }

  hideErrors() {
    this._shadow.querySelector('#__sfls_err_det').style.display = 'none';
    this._shadow.querySelector('#__sfls_err_log').innerHTML = '';
  }

  /* ── Styles ─────────────────────────────────────────────── */
  _injectStyles() {
    const style = document.createElement('style');
    style.id    = window.__LogHunt.Config.STYLE_ID;
    style.textContent = `
      /* ── Shared font ── */
      #${window.__LogHunt.Config.PANEL_ID}, #${window.__LogHunt.Config.FAB_ID} {
        font-family: Consolas, Monaco, 'Courier New', monospace;
      }

      /* ════════════════════════════════════
         FAB
         ════════════════════════════════════ */
      #${window.__LogHunt.Config.FAB_ID} {
        position: fixed;
        bottom: 24px; right: 24px;
        z-index: 2147483646;
        cursor: pointer;
        filter: drop-shadow(0 4px 16px rgba(244,99,0,.35));
        transition: filter .2s, transform .2s;
      }
      #${window.__LogHunt.Config.FAB_ID}:hover {
        filter: drop-shadow(0 6px 22px rgba(244,99,0,.55));
        transform: scale(1.06);
      }
      #${window.__LogHunt.Config.FAB_ID}:active { transform: scale(.96); }
      #__sfls_fab_inner {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        width: 58px; height: 58px;
        background: linear-gradient(145deg, #F46300, #C94F00);
        border-radius: 16px;
        border: 2px solid rgba(255,255,255,.22);
        position: relative; gap: 2px;
      }
      #__sfls_fab_label {
        font-size: 8px; font-weight: 700;
        color: rgba(255,255,255,.92);
        text-align: center; line-height: 1.2;
        letter-spacing: .3px;
      }
      #__sfls_fab_badge {
        position: absolute; top: -6px; right: -6px;
        background: #1A7A3A; color: white;
        font-size: 9px; font-weight: 700;
        padding: 1px 5px; border-radius: 10px;
        border: 2px solid white;
        min-width: 18px; text-align: center;
      }

      /* ════════════════════════════════════
         PANEL
         ════════════════════════════════════ */
      #${window.__LogHunt.Config.PANEL_ID} {
        position: fixed;
        /* Positioned ABOVE the FAB with a safe gap */
        bottom: 96px; right: 24px;
        z-index: 2147483647;
        width: 360px;
        max-height: calc(100vh - 120px);
        display: flex;
        flex-direction: column;
        background: #FFFFFF;
        border: 1.5px solid #FFD4B0;
        border-radius: 14px;
        box-shadow:
          0 0 0 1px rgba(244,99,0,.07),
          0 8px 20px rgba(244,99,0,.09),
          0 24px 48px rgba(0,0,0,.13);
        overflow: hidden;
        user-select: none;
        animation: __sfls_in .22s cubic-bezier(.22,1,.36,1);
      }
      @keyframes __sfls_in {
        from { opacity:0; transform:translateY(10px) scale(.97); }
        to   { opacity:1; transform:translateY(0)    scale(1); }
      }

      /* ── Header ── */
      #__sfls_hdr {
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 11px 13px 10px;
        background: linear-gradient(135deg,#FFF5EE,#FFF9F5);
        border-bottom: 1.5px solid #FFD4B0;
        cursor: move;
        flex-shrink: 0;
      }
      #__sfls_hdr_logo { display:flex; align-items:center; gap:9px; }
      #__sfls_hdr_title { display:flex; flex-direction:column; gap:1px; }
      #__sfls_hdr_name {
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-weight: 900; font-size: 17px;
        color: #1C1412; letter-spacing: -.3px; line-height:1;
      }
      #__sfls_hdr_sub {
        font-size: 8.5px; color: #B8A89E;
        letter-spacing: .6px; text-transform: uppercase; font-weight: 500;
      }
      .__sfls_hdr_actions { display:flex; align-items:center; gap:2px; }
      #__sfls_drag {
        cursor:move; color:#D4C4BC; font-size:15px; padding:3px 5px;
      }
      .__sfls_hdr_actions button {
        background:none; border:none; cursor:pointer;
        color:#C4AFA8; font-size:15px; line-height:1;
        padding:3px 5px; border-radius:5px;
        transition:background .15s,color .15s;
      }
      .__sfls_hdr_actions button:hover { background:#FFE8D6; color:#F46300; }

      /* ── Body ── */
      #__sfls_body { padding:13px; background:#FFFFFF; overflow-y:auto; flex:1; min-height:0; }

      /* Connection pill */
      #__sfls_conn_row {
        display:flex; align-items:center; gap:7px;
        padding:5px 9px; margin-bottom:11px;
        background:#FFF9F5; border:1.5px solid #FFD4B0; border-radius:7px;
        font-size:10px; color:#A09090;
      }
      #__sfls_conn_dot { font-size:11px; transition:color .3s; }
      #__sfls_conn_txt { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #__sfls_test_btn {
        padding:2px 8px; background:#FFF; border:1.5px solid #F46300;
        border-radius:5px; color:#F46300;
        font-family: Consolas, Monaco, 'Courier New', monospace; font-size:10px; font-weight:700;
        cursor:pointer; flex-shrink:0; transition:background .15s,color .15s;
      }
      #__sfls_test_btn:hover { background:#F46300; color:#FFF; }
      #__sfls_test_btn:disabled { opacity:.4; cursor:not-allowed; }

      /* Section label */
      .__sfls_section_label {
        font-size:9px; font-weight:700; letter-spacing:1.2px;
        color:#C4AFA8; margin-bottom:7px;
      }

      /* Keyword input */
      #__sfls_input_row { display:flex; gap:6px; margin-bottom:8px; }
      #__sfls_input_wrap { flex:1; position:relative; }
      #__sfls_input_icon {
        position:absolute; left:9px; top:50%;
        transform:translateY(-50%);
        pointer-events:none; display:flex; align-items:center;
      }
      #__sfls_kw {
        width:100%; padding:8px 8px 8px 29px;
        background:#FFF9F5; border:1.5px solid #E8DED8; border-radius:7px;
        color:#1C1412;
        font-family: Consolas, Monaco, 'Courier New', monospace; font-size:12px;
        outline:none; transition:border-color .2s,box-shadow .2s; box-sizing:border-box;
      }
      #__sfls_kw::placeholder { color:#C4AFA8; }
      #__sfls_kw:focus { border-color:#F46300; box-shadow:0 0 0 3px rgba(244,99,0,.1); }
      #__sfls_case_lbl {
        display:flex; align-items:center; gap:4px; padding:0 9px;
        background:#FFF9F5; border:1.5px solid #E8DED8; border-radius:7px;
        cursor:pointer; color:#A09090; font-size:11px; font-weight:700;
        white-space:nowrap; flex-shrink:0; transition:border-color .15s;
      }
      #__sfls_case_lbl:hover { border-color:#F46300; color:#F46300; }
      #__sfls_case_lbl input { cursor:pointer; accent-color:#F46300; }

      /* Limit row */
      #__sfls_limit_row {
        display:flex; align-items:center; gap:7px;
        margin-bottom:10px; font-size:11px; color:#A09090;
      }
      .__sfls_lbl { flex-shrink:0; }
      #__sfls_limit {
        padding:4px 7px; background:#FFF9F5;
        border:1.5px solid #E8DED8; border-radius:6px;
        color:#1C1412;
        font-family: Consolas, Monaco, 'Courier New', monospace; font-size:11px;
        outline:none; cursor:pointer;
      }
      #__sfls_row_count { margin-left:auto; font-size:10px; color:#C4AFA8; }

      /* Buttons */
      #__sfls_btn_row { display:flex; gap:6px; margin-bottom:10px; }
      #__sfls_btn_row button {
        flex:1; padding:8px 4px; border:none; border-radius:7px;
        cursor:pointer;
        font-family: Consolas, Monaco, 'Courier New', monospace; font-size:11px; font-weight:700;
        transition:all .15s;
      }
      #__sfls_btn_row button:active { transform:scale(.97); }
      #__sfls_search_btn {
        background:linear-gradient(135deg,#F46300,#C94F00);
        color:#FFF; box-shadow:0 2px 8px rgba(244,99,0,.28);
      }
      #__sfls_search_btn:hover:not(:disabled) {
        background:linear-gradient(135deg,#FF7A1A,#D95F00);
        box-shadow:0 4px 14px rgba(244,99,0,.4);
      }
      #__sfls_stop_btn {
        background:#FFF0E6; color:#C94F00; border:1.5px solid #F4C4A0;
      }
      #__sfls_stop_btn:hover:not(:disabled) { background:#FFE0CC; }
      #__sfls_clear_btn {
        background:#F5F0EE; color:#A09090; border:1.5px solid #E8DED8;
      }
      #__sfls_clear_btn:hover { background:#EDE8E5; color:#7A6A62; }
      button:disabled { opacity:.38; cursor:not-allowed; }

      /* Progress */
      #__sfls_prog_wrap { display:flex; align-items:center; gap:8px; margin-bottom:9px; }
      #__sfls_prog_track {
        flex:1; height:4px; background:#F5EFEA; border-radius:2px; overflow:hidden;
      }
      #__sfls_prog_bar {
        height:100%; width:0%;
        background:linear-gradient(90deg,#F46300,#FF8C3A);
        border-radius:2px; transition:width .18s ease;
      }
      #__sfls_prog_pct { font-size:10px; color:#C4AFA8; width:28px; text-align:right; flex-shrink:0; }

      /* Status */
      #__sfls_status { min-height:15px; font-size:11px; color:#7A6A62; margin-bottom:8px; line-height:1.6; }

      /* Results */
      #__sfls_results {
        background:#FFF9F5; border:1.5px solid #FFD4B0;
        border-radius:9px; padding:10px 12px; display:none;
        font-size:11px; line-height:2;
      }
      .__sfls_row  { display:flex; justify-content:space-between; color:#5A4A42; }
      .__sfls_ok   { color:#1A7A3A; font-weight:700; }
      .__sfls_dim  { color:#C4AFA8; }
      .__sfls_warn { color:#C94F00; font-weight:600; }
      .__sfls_hr   { border:none; border-top:1px solid #FFD4B0; margin:4px 0; }

      /* Error details */
      #__sfls_err_det { margin-top:8px; font-size:10px; color:#C94F00; }
      #__sfls_err_det summary { cursor:pointer; }
      #__sfls_err_log {
        margin-top:4px; max-height:100px; overflow-y:auto;
        background:#FFF5EE; border:1px solid #F4C4A0;
        border-radius:6px; padding:7px;
        color:#C94F00; line-height:1.7; word-break:break-all; font-size:10px;
      }

      /* Footer */
      #__sfls_footer {
        display:flex; justify-content:space-between;
        padding:6px 13px; background:#FFF5EE;
        border-top:1px solid #FFD4B0; font-size:9px; color:#C4AFA8; letter-spacing:.4px;
        flex-shrink: 0;
      }

    `;
    this._shadow.appendChild(style);

    // FIX: Inject table highlighting CSS directly into the main document,
    // otherwise the Shadow DOM completely traps the CSS and rows won't style.
    if (!document.getElementById(window.__LogHunt.Config.STYLE_ID + '_global')) {
      const globalStyle = document.createElement('style');
      globalStyle.id = window.__LogHunt.Config.STYLE_ID + '_global';
      globalStyle.textContent = `
        .${window.__LogHunt.Config.ROW_CLASSES.match} {
          outline: 2px solid #F46300 !important;
          outline-offset: -1px !important;
        }
        .${window.__LogHunt.Config.ROW_CLASSES.nomatch} { opacity:.48 !important; }
        
        .${window.__LogHunt.Config.BADGE_CLASS} {
          display:inline-block;
          background:#FFF0E0; color:#C94F00;
          border:1px solid #F4C4A0; border-radius:4px;
          padding:0 5px; font-size:9px; font-weight:700;
          font-family: Consolas, Monaco, 'Courier New', monospace;
          vertical-align:middle; margin-right:5px; letter-spacing:.4px;
        }
      `;
      document.head.appendChild(globalStyle);
    }
  }
}
