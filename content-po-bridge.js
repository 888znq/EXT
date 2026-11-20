(function () {
  'use strict';

  if (window === window.top) return;
  var anc = location.ancestorOrigins;
  if (!anc || anc.length !== 1 || String(anc[0]).indexOf('chrome-extension://') !== 0) return;

  var cachedSession = '';
  var sessionReady = false;
  var pendingSends = [];

  function decodeCookieVal(v) {
    return String(v || '').replace(/(%[0-9A-Fa-f]{2})+/g, function (m) {
      try { return decodeURIComponent(m); } catch (e) { return m; }
    });
  }

  function requestSession() {
    try {
      document.dispatchEvent(new CustomEvent('__extos_po_req'));
    } catch (e) {}
  }

  function flushPending() {
    if (!pendingSends.length) return;
    var items = pendingSends.splice(0, pendingSends.length);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      clearTimeout(item.timer);
      if (item.ws.readyState !== 1) continue;
      if (cachedSession && item.arr && item.arr[1] && !item.arr[1].session) {
        item.arr[1].session = decodeCookieVal(cachedSession);
      }
      try {
        item.orig.call(item.ws, '42' + JSON.stringify(item.arr));
      } catch (e) {}
    }
  }

  document.addEventListener('__extos_po_sess', function (e) {
    var v = typeof e.detail === 'string' ? e.detail : '';
    if (v) cachedSession = v;
    sessionReady = true;
    flushPending();
  });

  try {
    var proto = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
      ? Document.prototype
      : (typeof HTMLDocument !== 'undefined' && Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie') ? HTMLDocument.prototype : null);
    if (proto) {
      var desc = Object.getOwnPropertyDescriptor(proto, 'cookie');
      if (desc && desc.get && desc.set && desc.configurable) {
        Object.defineProperty(proto, 'cookie', {
          configurable: true,
          enumerable: desc.enumerable,
          get: function () {
            var raw = desc.get.call(this) || '';
            if (cachedSession && !/(?:^|;\s*)ci_session=/.test(raw)) {
              return raw ? raw + '; ci_session=' + cachedSession : 'ci_session=' + cachedSession;
            }
            return raw;
          },
          set: function (val) {
            var s = String(val || '');
            if (/^\s*ci_session=/i.test(s)) {
              setTimeout(requestSession, 120);
            }
            return desc.set.call(this, val);
          }
        });
      }
    }
  } catch (e) {}

  try {
    var origSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (typeof data === 'string' && data.indexOf('42["auth",') === 0) {
        try {
          var arr = JSON.parse(data.slice(2));
          var payload = Array.isArray(arr) && arr[0] === 'auth' ? arr[1] : null;
          if (payload && typeof payload === 'object' && !payload.session && !payload.token && (payload.isDemo === 0 || ('uid' in payload && payload.isDemo !== 1))) {
            if (cachedSession) {
              payload.session = decodeCookieVal(cachedSession);
              return origSend.call(this, '42' + JSON.stringify(arr));
            }
            if (!sessionReady) {
              var ws = this;
              var entry = { ws: ws, arr: arr, orig: origSend, timer: 0 };
              entry.timer = setTimeout(function () {
                var idx = pendingSends.indexOf(entry);
                if (idx >= 0) pendingSends.splice(idx, 1);
                if (ws.readyState === 1) {
                  if (cachedSession && !entry.arr[1].session) entry.arr[1].session = decodeCookieVal(cachedSession);
                  try { origSend.call(ws, '42' + JSON.stringify(entry.arr)); } catch (e2) {}
                }
              }, 1500);
              pendingSends.push(entry);
              requestSession();
              return;
            }
          }
        } catch (e) {}
      }
      return origSend.apply(this, arguments);
    };
  } catch (e) {}

  requestSession();
})();
