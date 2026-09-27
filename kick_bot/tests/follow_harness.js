// Runs the real main.js with a fake Electron and fake Kick responses.
const Module = require('module'), vm = require('vm'), fs = require('fs'), os = require('os'), path = require('path');
const mainPath = path.resolve(process.argv[2]);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-'));
const handlers = {};
// scenario per token: follow -> list of responses (or 'throw'), me -> is_following value / status
const SC = {
  tokA: { name: '200 OK',                     follow: [{ s: 200, b: '{}' }],                 me: true },
  tokB: { name: '204 No Content',             follow: [{ s: 204, b: '' }],                   me: true },
  tokC: { name: '400 "Already following"',    follow: [{ s: 400, b: '{"message":"Already following"}' }], me: true },
  tokD: { name: 'page reload mid-request',    follow: ['throw', 'throw'],                    me: true },
  tokE: { name: '500 but followed on Kick',   follow: [{ s: 500, b: 'err' }],                me: true },
  tokF: { name: '500 and NOT followed',       follow: [{ s: 500, b: 'err' }],                me: false },
  tokG: { name: '429 and NOT followed',       follow: [{ s: 429, b: '' }],                   me: false },
};
const calls = {};
function makeFetch(tok) {
  return (url, init) => {
    const sc = SC[tok];
    if (url.endsWith('/me')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ is_following: sc.me }) });
    const r = sc.follow[Math.min(calls[tok]++, sc.follow.length - 1)];
    return Promise.resolve({ status: r.s, text: () => Promise.resolve(r.b) });
  };
}
class BrowserWindow {
  constructor() { this.destroyed = false; const self = this;
    this.webContents = { on() {}, isCrashed: () => false, getURL: () => 'https://kick.com/chan',
      executeJavaScript(src) {
        const tok = /Bearer ' \+ "([^"]+)"/.exec(src)[1];
        calls[tok] ??= 0;
        const sc = SC[tok];
        if (!src.includes('/me"') && sc.follow[calls[tok]] === 'throw') { calls[tok]++; return Promise.reject(new Error('Script failed to execute')); }
        const ctx = { window: { KPSDK: { isReady: () => true } }, fetch: makeFetch(tok), setTimeout, setInterval, clearInterval, Date, String };
        return vm.runInNewContext(src, ctx);
      } };
  }
  showInactive() {} setIgnoreMouseEvents() {} loadURL() { return Promise.resolve(); }
  isDestroyed() { return this.destroyed; } destroy() { this.destroyed = true; }
}
const ses = () => ({ cookies: { remove: async () => {}, set: async () => {} }, webRequest: { onBeforeRequest() {} }, setProxy: async () => {} });
const electron = {
  app: { getPath: () => dataDir, whenReady: () => new Promise(() => {}), on() {} },
  ipcMain: { handle: (n, f) => { handlers[n] = f; } },
  session: { fromPartition: ses }, BrowserWindow, net: { fetch }, dialog: {}, shell: {}, Menu: {}, contextBridge: {}, ipcRenderer: {},
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'electron' ? electron : origLoad.call(this, req, ...rest); };
require(mainPath);
(async () => {
  const slug = 'chan';
  const bots = [];
  for (const tok of Object.keys(SC)) bots.push(await handlers['bots:add'](null, SC[tok].name, tok));
  for (const b of bots) {
    const r = await handlers['kick:follow-channel'](null, slug, b.id);
    console.log(`  ${b.name.padEnd(28)} -> ${r.ok ? 'OK' : 'FAIL: ' + r.error}`);
  }
  const follows = await handlers['kick:get-follows']();
  const followedCount = bots.filter((b) => follows[`${b.id}::${slug}`]).length; // same formula as the UI
  console.log(`  UI: Подписаны: ${followedCount} / ${bots.length}  (реально подписаны на Kick: ${Object.values(SC).filter(s => s.me).length})`);
  process.exit(0);
})();
