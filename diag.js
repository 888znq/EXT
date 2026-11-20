(() => {
  const D = { started: new Date().toISOString(), requests: {}, frame: [] };
  const clean = (u) => String(u).split('?')[0];
  const names = (h) => (h || []).map((x) => x.name.toLowerCase());
  const val = (h, n) => (h || []).find((x) => x.name.toLowerCase() === n)?.value;
  const cookieNames = (c) => (c ? c.split(';').map((s) => s.split('=')[0].trim()).filter(Boolean) : []);
  const rec = (d) =>
    (D.requests[d.requestId] ||= {
      url: clean(d.url),
      type: d.type,
      frameId: d.frameId,
      parentFrameId: d.parentFrameId,
      frameType: d.frameType,
      initiator: d.initiator,
      t: Math.round(d.timeStamp)
    });
  const F = {
    urls: ['*://*.po.market/*', '*://*.po.trade/*'],
    types: ['websocket', 'sub_frame', 'main_frame']
  };

  try {
    const wr = chrome.webRequest;
    wr.onBeforeSendHeaders.addListener(
      (d) => {
        const r = rec(d);
        r.hasCookie = names(d.requestHeaders).includes('cookie');
        r.cookieNames = cookieNames(val(d.requestHeaders, 'cookie'));
        r.origin = val(d.requestHeaders, 'origin') || null;
        r.secFetchSite = val(d.requestHeaders, 'sec-fetch-site') || null;
        r.requestHeaderNames = names(d.requestHeaders);
      },
      F,
      ['requestHeaders', 'extraHeaders']
    );
    wr.onHeadersReceived.addListener(
      (d) => {
        const r = rec(d);
        r.status = d.statusCode;
        r.statusLine = d.statusLine;
        r.responseHeaderNames = names(d.responseHeaders);
      },
      F,
      ['responseHeaders', 'extraHeaders']
    );
    wr.onErrorOccurred.addListener((d) => {
      rec(d).error = d.error;
    }, F);
    wr.onCompleted.addListener((d) => {
      const r = rec(d);
      r.completed = true;
      if (r.status == null) r.status = d.statusCode;
    }, F);
  } catch (e) {
    console.warn('[diag] webRequest unavailable', e);
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.__diag) {
      const m = Object.assign({}, e.data);
      delete m.__diag;
      m.fromOrigin = e.origin;
      D.frame.push(m);
    }
  });

  const redact = (r) =>
    JSON.parse(
      JSON.stringify(r, (k, v) =>
        k === 'value' && typeof v === 'string' && v.length > 40 ? v.slice(0, 6) + '...[truncated]' : v
      )
    );

  async function dnr() {
    const o = {};
    const api = chrome.declarativeNetRequest;
    try { o.dynamicRules = (await api.getDynamicRules()).map(redact); } catch (e) { o.dynamicRules = String(e); }
    try { o.sessionRules = (await api.getSessionRules()).map(redact); } catch (e) { o.sessionRules = String(e); }
    try { o.enabledStaticRulesets = await api.getEnabledRulesets(); } catch (e) { o.enabledStaticRulesets = String(e); }
    try {
      const m = await api.getMatchedRules({});
      o.matchedRules = m.rulesMatchedInfo.map((x) => ({
        ruleId: x.rule.ruleId,
        rulesetId: x.rule.rulesetId,
        tabId: x.tabId
      }));
    } catch (e) {
      o.matchedRules = String(e);
    }
    const mf = chrome.runtime.getManifest();
    o.manifestRuleResources = (mf.declarative_net_request && mf.declarative_net_request.rule_resources) || null;
        return o;
    }

    function diagCopyTxt(t, btn) {
      var done = function (ok) {
        btn.textContent = ok ? 'COPIED' : 'COPY FAILED';
        setTimeout(function () { btn.textContent = 'COPY DIAG'; }, 1500);
      };
      var fb = function () {
        var ok = false;
        try {
          var ta = document.createElement('textarea');
          ta.value = t;
          ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch (e) {}
        done(ok);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(function () { done(true); }, fb);
          return;
        }
      } catch (e0) {}
      fb();
    }

    function diagMakeBtn() {
      if (document.getElementById('diagCopyBtn')) return;
      var b = document.createElement('button');
      b.id = 'diagCopyBtn';
      b.textContent = 'COPY DIAG';
      b.style.cssText = 'position:fixed;right:6px;bottom:50px;z-index:2147483647;background:#0ff;color:#000;border:0;font:bold 10px monospace;padding:4px 8px;cursor:pointer;opacity:.85;';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        b.textContent = 'WORKING';
        window.diagJSON().then(
          function (t) { diagCopyTxt(t, b); },
          function (err) { diagCopyTxt('diag error: ' + err, b); }
        );
      });
      document.body.appendChild(b);
    }

    if (document.body) diagMakeBtn();
    else document.addEventListener('DOMContentLoaded', diagMakeBtn);

    window.diagJSON = async () => {
    const reqs = Object.values(D.requests);
    const summary = {};
    reqs.forEach((r) => {
      const k = r.type + ' ' + r.url + ' => ' + (r.error || 'status ' + r.status);
      summary[k] = (summary[k] || 0) + 1;
    });
    return JSON.stringify(
      {
        started: D.started,
        now: new Date().toISOString(),
        extensionOrigin: location.origin,
        summary: summary,
        requests: reqs.slice(-40),
        frame: D.frame.slice(-60),
        dnr: await dnr()
      },
      null,
      2
    );
  };

    function diagCopy(t, btn) {
      var done = function (ok) {
        btn.textContent = ok ? 'COPIED' : 'COPY FAILED';
        setTimeout(function () { btn.textContent = 'COPY DIAG'; }, 1500);
      };
      var fb = function () {
        var ok = false;
        try {
          var ta = document.createElement('textarea');
          ta.value = t;
          ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch (e) {}
        done(ok);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(function () { done(true); }, fb);
          return;
        }
      } catch (e0) {}
      fb();
    }

    function diagButton() {
      if (document.getElementById('diagCopyBtn')) return;
      var b = document.createElement('button');
      b.id = 'diagCopyBtn';
      b.textContent = 'COPY DIAG';
      b.style.cssText = 'position:fixed;right:6px;bottom:50px;z-index:2147483647;background:#0ff;color:#000;border:0;font:bold 10px monospace;padding:4px 8px;cursor:pointer;opacity:.85;';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        b.textContent = 'WORKING';
        window.diagJSON().then(
          function (t) { diagCopy(t, b); },
          function (err) { diagCopy('diag error: ' + err, b); }
        );
      });
      document.body.appendChild(b);
    }

    if (document.body) diagButton();
    else document.addEventListener('DOMContentLoaded', diagButton);

    console.log('[diag] ready. Wait about 60s with the pane on Real, then tap the COPY DIAG button (or run: copy(await diagJSON()))');
  })();
