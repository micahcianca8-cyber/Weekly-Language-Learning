/* Language Rotation tracker — everything runs client-side. Data lives in
 * this browser's localStorage always, and optionally also in a private
 * GitHub Gist (your own, via your own personal access token) so it can
 * follow you from phone to desktop. No other server is involved. */
(function(){
  'use strict';

  // ---------- Local state ----------
  var STORAGE_KEY = 'lr-data-v1';

  function defaultState(){
    return {
      week: { checks: {} },
      month: { checks: {} },
      tracker: {
        spanish: { video: '', app: '', notes: '', updatedAt: null },
        italian: { video: '', app: '', notes: '', updatedAt: null },
        serbian: { video: '', app: '', notes: '', updatedAt: null }
      },
      streak: { days: {} },
      updatedAt: 0
    };
  }

  function deepMerge(base, extra){
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(extra).forEach(function(k){
      var ev = extra[k];
      if (ev && typeof ev === 'object' && !Array.isArray(ev) && base[k] && typeof base[k] === 'object') {
        base[k] = deepMerge(base[k], ev);
      } else {
        base[k] = ev;
      }
    });
    return base;
  }

  var state = defaultState();
  try {
    var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored) state = deepMerge(defaultState(), stored);
  } catch(e) {}

  function saveLocal(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function touch(){
    state.updatedAt = Date.now();
    saveLocal();
    scheduleSync();
  }

  // ---------- Date helpers (for the streak) ----------
  function pad2(n){ return n < 10 ? '0' + n : '' + n; }
  function isoDate(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayIso(){ return isoDate(new Date()); }
  function addDaysIso(iso, delta){
    var p = iso.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + delta);
    return isoDate(d);
  }
  function computeStreak(days){
    var today = todayIso();
    var cursor = days[today] ? today : addDaysIso(today, -1);
    if (!days[cursor]) return 0;
    var count = 0;
    while (days[cursor]) { count++; cursor = addDaysIso(cursor, -1); }
    return count;
  }
  function markActiveToday(){
    var today = todayIso();
    if (state.streak.days[today]) return;
    state.streak.days[today] = true;
    renderStreak();
    touch();
  }
  function renderStreak(){
    var el = document.getElementById('streak-num');
    if (el) el.textContent = String(computeStreak(state.streak.days));
  }

  // ---------- Weekly / monthly checkboxes ----------
  var CHECK_SCOPES = { week: [], month: [] };
  document.querySelectorAll('.chk input[type=checkbox]').forEach(function(b){
    var scope = b.getAttribute('data-scope') || 'week';
    (CHECK_SCOPES[scope] || CHECK_SCOPES.week).push(b);
  });

  function applyChecks(){
    Object.keys(CHECK_SCOPES).forEach(function(scope){
      var checks = state[scope].checks || {};
      CHECK_SCOPES[scope].forEach(function(b){
        b.checked = !!checks[b.getAttribute('data-id')];
      });
    });
  }
  applyChecks();

  Object.keys(CHECK_SCOPES).forEach(function(scope){
    CHECK_SCOPES[scope].forEach(function(b){
      b.addEventListener('change', function(){
        var id = b.getAttribute('data-id');
        state[scope].checks[id] = b.checked;
        touch();
        if (b.checked) markActiveToday();
      });
    });
  });

  function wireReset(btnId, scope, promptText){
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function(){
      var ok = true;
      try { ok = window.confirm(promptText); } catch(e) { ok = true; }
      if (!ok) return;
      state[scope].checks = {};
      applyChecks();
      touch();
    });
  }
  wireReset('reset-week-btn', 'week', 'Reset all checkmarks for a new week?');
  wireReset('reset-month-btn', 'month', 'Reset the end-of-month review checklist?');

  // ---------- "Where you're at" tracker ----------
  var TRACK_LANGS = ['spanish', 'italian', 'serbian'];
  var TRACK_FIELDS = ['video', 'app', 'notes'];
  var trackerDebounce = {};

  function fieldEl(lang, field){ return document.querySelector('.track-input[data-lang="' + lang + '"][data-field="' + field + '"]'); }
  function savedEl(lang){ return document.querySelector('.track-saved[data-lang="' + lang + '"]'); }

  function formatSaved(ts){
    if (!ts) return 'Not saved yet';
    try {
      var d = new Date(ts);
      return 'Saved ' + d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch(e) { return 'Saved'; }
  }

  function applyTracker(skipFocused){
    TRACK_LANGS.forEach(function(lang){
      TRACK_FIELDS.forEach(function(field){
        var el = fieldEl(lang, field);
        if (!el) return;
        if (skipFocused && document.activeElement === el) return;
        var val = state.tracker[lang][field] || '';
        if (el.value !== val) el.value = val;
      });
      var se = savedEl(lang);
      if (se) se.textContent = formatSaved(state.tracker[lang].updatedAt);
    });
  }
  applyTracker(false);

  function commitTrackerField(lang, field, value){
    state.tracker[lang][field] = value;
    state.tracker[lang].updatedAt = Date.now();
    applyTracker(true);
    touch();
  }

  document.querySelectorAll('.track-input').forEach(function(el){
    var lang = el.getAttribute('data-lang');
    var field = el.getAttribute('data-field');
    var key = lang + ':' + field;
    el.addEventListener('input', function(){
      clearTimeout(trackerDebounce[key]);
      trackerDebounce[key] = setTimeout(function(){ commitTrackerField(lang, field, el.value); }, 700);
    });
    el.addEventListener('blur', function(){
      clearTimeout(trackerDebounce[key]);
      commitTrackerField(lang, field, el.value);
    });
  });

  renderStreak();

  // ---------- GitHub Gist sync ----------
  // Your token and Gist ID are stored only in this browser's localStorage
  // and sent only to https://api.github.com, straight from this page.
  // Nothing passes through any other server.
  var GH_TOKEN_KEY = 'lr-gh-token';
  var GH_GIST_KEY = 'lr-gh-gistid';
  var GIST_FILENAME = 'language-rotation-data.json';

  function ghToken(){ try { return localStorage.getItem(GH_TOKEN_KEY) || ''; } catch(e){ return ''; } }
  function ghGistId(){ try { return localStorage.getItem(GH_GIST_KEY) || ''; } catch(e){ return ''; } }
  function ghSetCreds(token, gistId){
    try {
      if (token) localStorage.setItem(GH_TOKEN_KEY, token); else localStorage.removeItem(GH_TOKEN_KEY);
      if (gistId) localStorage.setItem(GH_GIST_KEY, gistId); else localStorage.removeItem(GH_GIST_KEY);
    } catch(e) {}
  }

  function ghHeaders(token){
    return { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' };
  }

  function ghRequest(url, opts){
    opts = opts || {};
    return fetch(url, opts).then(function(res){
      if (!res.ok) {
        return res.json().catch(function(){ return {}; }).then(function(body){
          var err = new Error((body && body.message) || ('GitHub API error ' + res.status));
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    });
  }

  function ghCreateGist(token, data){
    var body = {
      description: 'Language Rotation tracker data — created by the app',
      public: false,
      files: {}
    };
    body.files[GIST_FILENAME] = { content: JSON.stringify(data, null, 2) };
    return ghRequest('https://api.github.com/gists', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(token)),
      body: JSON.stringify(body)
    });
  }

  function ghFetchGist(token, gistId){
    return ghRequest('https://api.github.com/gists/' + encodeURIComponent(gistId), { headers: ghHeaders(token) });
  }

  function ghUpdateGist(token, gistId, data){
    var body = { files: {} };
    body.files[GIST_FILENAME] = { content: JSON.stringify(data, null, 2) };
    return ghRequest('https://api.github.com/gists/' + encodeURIComponent(gistId), {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(token)),
      body: JSON.stringify(body)
    });
  }

  function ghParseGist(gist){
    try {
      var file = gist.files && gist.files[GIST_FILENAME];
      if (!file || file.truncated) return null;
      return JSON.parse(file.content);
    } catch(e) { return null; }
  }

  // -- UI wiring --
  var syncBadge = document.getElementById('sync-badge');
  var syncStatusEl = document.getElementById('sync-status');
  var syncMsgEl = document.getElementById('sync-msg');
  var disconnectedBox = document.getElementById('sync-disconnected');
  var connectedBox = document.getElementById('sync-connected');
  var tokenInput = document.getElementById('gh-token');
  var gistIdInput = document.getElementById('gh-gistid');
  var connectBtn = document.getElementById('gh-connect-btn');
  var gistIdDisplay = document.getElementById('gh-gistid-display');
  var copyBtn = document.getElementById('gh-copy-btn');
  var syncNowBtn = document.getElementById('gh-sync-now-btn');
  var disconnectBtn = document.getElementById('gh-disconnect-btn');

  function setBadge(text, cls){
    [syncBadge, syncStatusEl].forEach(function(el){
      if (!el) return;
      el.textContent = text;
      el.classList.remove('ok', 'err');
      if (cls) el.classList.add(cls);
    });
  }
  function setMsg(text, cls){
    if (!syncMsgEl) return;
    syncMsgEl.textContent = text || '';
    syncMsgEl.classList.remove('ok', 'err');
    if (cls) syncMsgEl.classList.add(cls);
  }

  function showConnectedUI(gistId){
    if (disconnectedBox) disconnectedBox.hidden = true;
    if (connectedBox) connectedBox.hidden = false;
    if (gistIdDisplay) gistIdDisplay.textContent = gistId;
  }
  function showDisconnectedUI(){
    if (disconnectedBox) disconnectedBox.hidden = false;
    if (connectedBox) connectedBox.hidden = true;
  }

  var syncWriteInFlight = false;
  var syncWriteQueued = false;
  var syncDebounceTimer = null;

  function scheduleSync(){
    if (!ghToken() || !ghGistId()) return; // not connected — local-only is fine
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(pushRemote, 900);
  }

  function pushRemote(){
    var token = ghToken(), gistId = ghGistId();
    if (!token || !gistId) return;
    if (syncWriteInFlight) { syncWriteQueued = true; return; }
    syncWriteInFlight = true;
    setBadge('Syncing…');
    ghUpdateGist(token, gistId, state).then(function(){
      setBadge('Synced via GitHub', 'ok');
      setMsg('Last synced ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), 'ok');
    }).catch(function(err){
      setBadge('Sync error — saved on this device only', 'err');
      setMsg(describeError(err), 'err');
    }).then(function(){
      syncWriteInFlight = false;
      if (syncWriteQueued) { syncWriteQueued = false; pushRemote(); }
    });
  }

  function describeError(err){
    if (err && err.status === 401) return 'GitHub rejected that token. Check it was copied in full and has the "gist" scope.';
    if (err && err.status === 404) return 'That Gist ID wasn’t found for this token — check the ID, or leave it blank to create a new one.';
    if (err && err.status === 403) return 'GitHub rate-limited or blocked this request. It will retry on the next change.';
    if (err && err.message) return err.message;
    return 'Could not reach GitHub — check your connection.';
  }

  function connectAndPull(token, gistIdOrBlank){
    setMsg('Connecting…');
    if (gistIdOrBlank) {
      return ghFetchGist(token, gistIdOrBlank).then(function(gist){
        var remote = ghParseGist(gist);
        if (remote && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
          state = deepMerge(defaultState(), remote);
          saveLocal();
          applyChecks();
          applyTracker(false);
          renderStreak();
        }
        ghSetCreds(token, gistIdOrBlank);
        showConnectedUI(gistIdOrBlank);
        setBadge('Synced via GitHub', 'ok');
        setMsg('Connected and pulled the latest saved data.', 'ok');
        // push our (possibly merged) state back so both sides agree
        pushRemote();
      });
    }
    return ghCreateGist(token, state).then(function(gist){
      ghSetCreds(token, gist.id);
      showConnectedUI(gist.id);
      setBadge('Synced via GitHub', 'ok');
      setMsg('Created a new private Gist. Copy the ID below into the app on your other device.', 'ok');
    });
  }

  if (connectBtn) {
    connectBtn.addEventListener('click', function(){
      var token = (tokenInput && tokenInput.value || '').trim();
      var gistId = (gistIdInput && gistIdInput.value || '').trim();
      if (!token) { setMsg('Paste a token first.', 'err'); return; }
      connectAndPull(token, gistId).catch(function(err){
        setBadge('Not connected', null);
        setMsg(describeError(err), 'err');
      });
    });
  }
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', function(){
      var token = ghToken(), gistId = ghGistId();
      if (!token || !gistId) return;
      setMsg('Syncing…');
      ghFetchGist(token, gistId).then(function(gist){
        var remote = ghParseGist(gist);
        if (remote && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
          state = deepMerge(defaultState(), remote);
          saveLocal();
          applyChecks();
          applyTracker(false);
          renderStreak();
          setMsg('Pulled newer data from your other device.', 'ok');
        } else {
          setMsg('Already up to date.', 'ok');
        }
        return pushRemote();
      }).catch(function(err){
        setMsg(describeError(err), 'err');
      });
    });
  }
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', function(){
      var ok = true;
      try { ok = window.confirm('Disconnect this device from GitHub sync? Your data stays in the Gist and on this device — this only stops this device from syncing to it.'); } catch(e) { ok = true; }
      if (!ok) return;
      ghSetCreds('', '');
      showDisconnectedUI();
      setBadge('Saved on this device only');
      setMsg('');
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', function(){
      var id = ghGistId();
      if (!id) return;
      try {
        navigator.clipboard.writeText(id).then(function(){
          copyBtn.textContent = 'Copied';
          setTimeout(function(){ copyBtn.textContent = 'Copy'; }, 1500);
        });
      } catch(e) {}
    });
  }

  // On load: if already connected, pull the latest and reconcile.
  (function initSync(){
    var token = ghToken(), gistId = ghGistId();
    if (!token || !gistId) { setBadge('Saved on this device only'); showDisconnectedUI(); return; }
    showConnectedUI(gistId);
    setBadge('Syncing…');
    ghFetchGist(token, gistId).then(function(gist){
      var remote = ghParseGist(gist);
      if (remote) {
        if ((remote.updatedAt || 0) > (state.updatedAt || 0)) {
          state = deepMerge(defaultState(), remote);
          saveLocal();
          applyChecks();
          applyTracker(false);
          renderStreak();
        } else if ((state.updatedAt || 0) > (remote.updatedAt || 0)) {
          // local is newer (e.g. changes made while offline) — push it up
          pushRemote();
          return;
        }
      }
      setBadge('Synced via GitHub', 'ok');
      setMsg('Up to date as of ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), 'ok');
    }).catch(function(err){
      setBadge('Sync error — saved on this device only', 'err');
      setMsg(describeError(err), 'err');
    });
  })();

  // ---------- Service worker (offline app-shell caching) ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }
})();
