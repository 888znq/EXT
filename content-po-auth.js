(function () {
  'use strict';

  if (window === window.top) return;
  var extOrigin = '';
  try {
    extOrigin = chrome.runtime.getURL('').replace(/\/$/, '');
  } catch (e) {
    return;
  }
  var anc = location.ancestorOrigins;
  if (!anc || anc.length !== 1 || anc[0] !== extOrigin) return;

  var lastSess = '';
  var inflight = false;

  function emit(val) {
    try {
      document.dispatchEvent(new CustomEvent('__extos_po_sess', { detail: String(val || '') }));
    } catch (e) {}
  }

  function fetchSession(force) {
    if (inflight && !force) return;
    inflight = true;
    try {
      chrome.runtime.sendMessage({ type: 'GET_PO_SESSION' }, function (resp) {
        inflight = false;
        if (chrome.runtime.lastError) {
          emit(lastSess);
          return;
        }
        var val = resp && typeof resp.ci_session === 'string' ? resp.ci_session : '';
        if (val) lastSess = val;
        emit(val || lastSess);
      });
    } catch (e) {
      inflight = false;
    }
  }

  document.addEventListener('__extos_po_req', function () {
    if (lastSess) emit(lastSess);
    fetchSession(true);
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) fetchSession(false);
  });

  fetchSession(true);
})();
