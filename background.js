chrome.action.onClicked.addListener(async function () {
  const url = chrome.runtime.getURL('index.html');

  // If the app window is already open, just focus it instead of opening a duplicate.
  const existingTabs = await chrome.tabs.query({ url });
  if (existingTabs.length > 0) {
    const tab = existingTabs[0];
    await chrome.windows.update(tab.windowId, { focused: true });
        return;
      }

            chrome.windows.create({
          url: url,
          type: 'popup',
          width: 1280,
          height: 860
        });
      });

      const PO_COOKIE_DOMAINS = ['po.trade', 'pocketoption.com', 'po.market'];
      function isPoCookieDomain(domain) {
        const d = String(domain || '').replace(/^\./, '').toLowerCase();
        return PO_COOKIE_DOMAINS.some(function (base) {
          return d === base || d.endsWith('.' + base);
        });
      }
      function isPoSenderUrl(url) {
        try {
          const h = new URL(String(url || '')).hostname.toLowerCase();
          return h === 'po.trade' || h.endsWith('.po.trade') || h === 'pocketoption.com' || h.endsWith('.pocketoption.com');
        } catch (e) {
          return false;
        }
      }
      async function fixPoCookie(c) {
        if (!c || c.partitionKey || !isPoCookieDomain(c.domain)) return false;
        if (c.sameSite === 'no_restriction' && c.secure) return false;
        const host = String(c.domain || '').replace(/^\./, '');
        if (!host || !c.name) return false;
        const det = {
          url: 'https://' + host + (c.path || '/'),
          name: c.name,
          value: c.value || '',
          path: c.path || '/',
          secure: true,
          httpOnly: !!c.httpOnly,
          sameSite: 'no_restriction'
        };
        if (!c.hostOnly) det.domain = c.domain;
        if (!c.session && typeof c.expirationDate === 'number') det.expirationDate = c.expirationDate;
        if (c.storeId) det.storeId = c.storeId;
        try {
          await chrome.cookies.set(det);
          return true;
        } catch (e) {
          return false;
        }
      }
      async function fixAllPoCookies() {
        if (!chrome.cookies || !chrome.cookies.getAll) return 0;
        let updated = 0;
        for (let i = 0; i < PO_COOKIE_DOMAINS.length; i++) {
          let list = [];
          try { list = await chrome.cookies.getAll({ domain: PO_COOKIE_DOMAINS[i] }); } catch (e) {}
          for (let j = 0; j < list.length; j++) {
            if (await fixPoCookie(list[j])) updated++;
          }
        }
        return updated;
      }
      async function getPoSessionCookie(senderUrl) {
        if (!chrome.cookies || !chrome.cookies.getAll) return '';
        const queries = [];
        if (senderUrl) queries.push({ url: senderUrl, name: 'ci_session' });
        queries.push({ domain: 'po.trade', name: 'ci_session' });
        queries.push({ domain: 'pocketoption.com', name: 'ci_session' });
        for (let i = 0; i < queries.length; i++) {
          let list = [];
          try { list = await chrome.cookies.getAll(queries[i]); } catch (e) {}
          const hit = list.find(function (c) { return c && !c.partitionKey && c.value; }) || list.find(function (c) { return c && c.value; });
          if (hit && hit.value) return hit.value;
        }
        return '';
      }
      if (chrome.cookies && chrome.cookies.onChanged) {
        chrome.cookies.onChanged.addListener(function (info) {
          if (!info || info.removed || !info.cookie) return;
          if (!isPoCookieDomain(info.cookie.domain)) return;
          if (info.cookie.sameSite === 'no_restriction' && info.cookie.secure) return;
          fixPoCookie(info.cookie);
        });
      }
      fixAllPoCookies();

      // Handles reload, cookie-upgrade, and iframe ci_session lookup requests.
      chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (msg && msg.type === 'RELOAD_APP') {
          sendResponse({ ok: true });
          setTimeout(function () { chrome.runtime.reload(); }, 100);
        } else if (msg && msg.type === 'FIX_PO_COOKIES') {
          fixAllPoCookies().then(
            function (n) { sendResponse({ ok: true, updated: n }); },
            function () { sendResponse({ ok: false, updated: 0 }); }
          );
          return true;
        } else if (msg && msg.type === 'GET_PO_SESSION') {
          if (!sender || !isPoSenderUrl(sender.url)) {
            sendResponse({ ok: false, ci_session: '' });
            return;
          }
          fixAllPoCookies().then(function () {
            return getPoSessionCookie(sender.url);
          }).then(
            function (val) { sendResponse({ ok: true, ci_session: val || '' }); },
            function () { sendResponse({ ok: false, ci_session: '' }); }
          );
          return true;
        }
      });
