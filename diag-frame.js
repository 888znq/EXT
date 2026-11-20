(() => {
  if (window === window.top) return;

  const clean = (u) => String(u).split('?')[0];
  const send = (m) => {
    try {
      window.parent.postMessage(Object.assign({ __diag: true, t: Math.round(performance.now()) }, m), '*');
    } catch (e) {}
  };
  const cookieNames = () =>
    document.cookie.split(';').map((s) => s.split('=')[0].trim()).filter(Boolean);

  send({ k: 'frame-start', href: clean(location.href), cookieNames: cookieNames() });
  setTimeout(() => send({ k: 'frame-30s', cookieNames: cookieNames() }), 30000);

  const Orig = window.WebSocket;
  window.WebSocket = new Proxy(Orig, {
    construct(target, args) {
      const url = clean(args[0]);
      const t0 = performance.now();
      let opened = false;
      send({ k: 'ws-new', url: url });
      let ws;
      try {
        ws = new target(...args);
      } catch (e) {
        send({ k: 'ws-throw', url: url, msg: String(e && e.message) });
        throw e;
      }
      ws.addEventListener('open', () => {
        opened = true;
        send({ k: 'ws-open', url: url, ms: Math.round(performance.now() - t0) });
      });
      ws.addEventListener('close', (e) =>
        send({ k: 'ws-close', url: url, opened: opened, code: e.code, ms: Math.round(performance.now() - t0) })
      );
      return ws;
    }
  });
})();
