/**
 * ==========================================
 * LogHunt Chrome Extension
 * Author: Ankit Patel
 * Contact: ankit.ap.patel01@gmail.com
 * ==========================================
 */
/**
 * LogHunt — api.js
 * Handles all communication with the Salesforce Tooling API.
 * Automatically detects a working same-origin or Bearer endpoint.
 */
window.__LogHunt = window.__LogHunt || {};
window.__LogHunt.API = class LogHuntAPI {
  constructor() {
    this._working = null; // { base: string, bearer: boolean }
    this._sessionId = null;
  }

  /* ── Session ID discovery ─────────────────────────────────── */
  async _fetchSessionIdFromBackground() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'GET_SESSION_TOKEN' }, (response) => {
          if (chrome.runtime.lastError || !response || !response.token) {
            resolve(null);
          } else {
            resolve(response.token);
          }
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  _buildHeaders(useBearer = false) {
    const h = { Accept: 'application/json' };
    if (useBearer && this._sessionId) {
      h['Authorization'] = `Bearer ${this._sessionId}`;
    }
    return h;
  }

  /* ── Candidate base URLs ──────────────────────────────────── */
  _getCandidateBases() {
    const host   = window.location.hostname;
    const origin = window.location.origin;
    const bases  = ['', origin]; // '' = relative (same-origin, best)

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

  async _probe(base, useBearer) {
    try {
      const url = `${base}/services/data/${window.__LogHunt.Config.API_VER}/tooling/query?q=SELECT+Id+FROM+ApexLog+LIMIT+1`;
      const r   = await fetch(url, {
        credentials: useBearer ? 'omit' : 'include',
        headers: this._buildHeaders(useBearer),
      });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  /**
   * Find the first working [base, useBearer] combination.
   * Calls progressCb(message) as it tries each option.
   */
  async detectEndpoint(progressCb) {
    if (this._working) return this._working;

    const bases    = this._getCandidateBases();
    this._sessionId = await this._fetchSessionIdFromBackground();
    const hasSid   = !!this._sessionId;
    const attempts = [];

    for (const b of bases) {
      attempts.push([b, false]);
      if (hasSid) attempts.push([b, true]);
    }

    for (const [base, bearer] of attempts) {
      progressCb?.(`Probing ${base || '(relative)'}${bearer ? ' +Bearer' : ''}…`);
      if (await this._probe(base, bearer)) {
        this._working = { base, bearer };
        return this._working;
      }
    }
    return null;
  }

  get isReady() { return !!this._working; }

  get endpointLabel() {
    if (!this._working) return 'not connected';
    return (this._working.base || 'relative') + (this._working.bearer ? ' +Bearer' : '');
  }

  /* ── Core fetch helpers ───────────────────────────────────── */
  async _get(path) {
    const { base, bearer } = this._working;
    const res = await fetch(base + path, {
      credentials: bearer ? 'omit' : 'include',
      headers: this._buildHeaders(bearer),
    });
    if (res.status === 401) throw new Error('401 Session Expired! Please refresh Salesforce to authenticate.');
    if (res.status === 403) throw new Error('403 API Limit Exceeded!');
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json();
  }

  async _getRaw(url) {
    const { bearer } = this._working;
    const res = await fetch(url, {
      credentials: bearer ? 'omit' : 'include',
      headers: this._buildHeaders(bearer),
    });
    if (res.status === 401) throw new Error('401 Session Expired! Please refresh Salesforce to authenticate.');
    if (res.status === 403) throw new Error('403 API Limit Exceeded!');
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 150)}`);
    }
    return res.text();
  }

  /* ── Public API methods ───────────────────────────────────── */

  /** Lightweight connectivity check. Returns total log count or -1. */
  async ping() {
    const d = await this._get(
      `/services/data/${window.__LogHunt.Config.API_VER}/tooling/query?q=SELECT+Id+FROM+ApexLog+LIMIT+1`
    );
    return d.totalSize ?? -1;
  }

  /**
   * Query the N most-recent ApexLog IDs via SOQL.
   * @param {number} limit
   * @returns {Array<{Id, LogUser, StartTime, Status}>}
   */
  async queryLogs(limit) {
    const soql = [
      'SELECT Id, LogUser.Name, StartTime, Status, LogLength',
      'FROM ApexLog',
      'ORDER BY StartTime DESC',
      `LIMIT ${limit}`,
    ].join(' ');
    const path = `/services/data/${window.__LogHunt.Config.API_VER}/tooling/query?q=${encodeURIComponent(soql)}`;
    const data = await this._get(path);
    return data.records || [];
  }

  /**
   * Fetch a readable Response stream of one ApexLog record.
   * @param {string} logId  — 15- or 18-char Salesforce ID
   * @returns {Response}
   */
  async fetchLogStream(logId) {
    const { base, bearer } = this._working;
    const url = `${base}/services/data/${window.__LogHunt.Config.API_VER}/tooling/sobjects/ApexLog/${logId}/Body`;
    const res = await fetch(url, {
      credentials: bearer ? 'omit' : 'include',
      headers: this._buildHeaders(bearer),
    });
    if (res.status === 401) throw new Error('401 Session Expired! Please refresh Salesforce to authenticate.');
    if (res.status === 403) throw new Error('403 API Limit Exceeded!');
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 150)}`);
    }
    return res;
  }
}
