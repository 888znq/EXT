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
      if (chrome.cookies && chrome.cookies.onChanged) {
        chrome.cookies.onChanged.addListener(function (info) {
          if (!info || info.removed || !info.cookie) return;
          if (!isPoCookieDomain(info.cookie.domain)) return;
          if (info.cookie.sameSite === 'no_restriction' && info.cookie.secure) return;
          fixPoCookie(info.cookie);
        });
      }
      fixAllPoCookies();

      // Handles the "reload after patch" and cookie-upgrade requests sent from index.js.
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
        }
      });
