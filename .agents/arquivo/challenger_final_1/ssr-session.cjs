// Reproduces what the zone page (and host page) render after the localStorage-reading effect runs,
// using the REAL page and @mfe/shell-ui sources, transpiled in memory (no files written), React 18.3.1 server renderer.
// Limitation: server renderer, not a DOM. Effects other than the localStorage reader are not run.
const path = require('node:path'); const Module = require('node:module');
const ROOT = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe';
const zr = Module.createRequire(path.join(ROOT, 'apps/remote-app/package.json'));
const ts = zr('typescript'); const React = zr('react');
const REAL = { react: zr.resolve('react'), 'react/jsx-runtime': zr.resolve('react/jsx-runtime'), 'react-dom/server': zr.resolve('react-dom/server') };
const STUB_HEAD = path.join(__dirname, '__stub_head.js'); const STUB_GSD = path.join(__dirname, '__stub_gsd.js');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (REAL[req]) return REAL[req];
  if (req === 'next/head') return STUB_HEAD;
  if (req === '../lib/getServerData') return STUB_GSD;
  if (req === '@mfe/shell-ui') return path.join(ROOT, 'packages/shell-ui/src/index.ts');
  return origResolve.call(this, req, parent, ...rest);
};
const origLoad = Module._load;
Module._load = function (req, parent, isMain) { if (req === 'next/head') return { __esModule: true, default: () => null }; if (req === '../lib/getServerData') return { getServerData: async () => ({}) }; return origLoad.call(this, req, parent, isMain); };
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (m, filename) => {
  const src = require('node:fs').readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};
// run only the localStorage-reading effect, once per render, inside render (render-phase update => rerender with new state)
let ran = new Set();
const realUseEffect = React.useEffect;
React.useEffect = function (fn, deps) { const k = fn.toString(); if (/getItem|getSessionFromStorage/.test(k) && !ran.has(k)) { ran.add(k); fn(); } return undefined; };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = globalThis;
const { renderToString } = zr('react-dom/server');
const Zone = require(path.join(ROOT, 'apps/remote-app/pages/index.tsx')).default;
const Host = require(path.join(ROOT, 'apps/host/pages/index.tsx')).default;
const serverData = { origin: 'x', timestamp: 't', cached: false, serverNodeVersion: 'v', requestId: 'r', metrics: { memoryUsageMb: 1, platform: 'linux', cpuArch: 'x64' }, session: undefined };
const DEF = require(path.join(ROOT, 'packages/shell-ui/src/index.ts')).DEFAULT_SESSION;
const big = 'A'.repeat(2_000_000);
const cases = [
  ['absent', null],
  ['non-JSON', '{bad json'],
  ['JSON null', 'null'],
  ['JSON string', '"usr_admin_01"'],
  ['JSON array', '[]'],
  ['xss userId only', JSON.stringify({ userId: '<img src=x onerror=alert(1)>' })],
  ['xss in every field', JSON.stringify({ userId: '"><img src=x onerror=alert(1)>', userName: '<img src=x onerror=alert(2)>', email: '</p><script>alert(3)</script>', role: '" onmouseover="alert(4)', tenant: '<svg onload=alert(5)>' })],
  ['missing fields', JSON.stringify({ userId: 'u' })],
  ['userId empty (falsy)', JSON.stringify({ userId: '', userName: 'Evil' })],
  ['userName object', JSON.stringify({ userId: 'u', userName: { a: 1 } })],
  ['role object', JSON.stringify({ userId: 'u', userName: 'n', role: { a: 1 } })],
  ['fake react element', JSON.stringify({ userId: 'u', userName: { $$typeof: 'Symbol(react.element)', type: 'script', props: { children: 'alert(1)' } } })],
  ['userName array', JSON.stringify({ userId: 'u', userName: ['<b>', 'x'] })],
  ['userId object', JSON.stringify({ userId: { a: 1 }, userName: 'n' })],
  ['huge userName 2e6 chars', JSON.stringify({ ...DEF, userName: big })],
  ['valid preset viewer', JSON.stringify({ userId: 'usr_viewer_03', userName: 'Mariana Lima (Viewer)', email: 'mariana.lima@guest.io', role: 'viewer', tenant: 'tenant-public-demo' })],
];
const errs = []; const origErr = console.error; console.error = (...a) => errs.push(a.map(String).join(' ').slice(0, 160));
for (const [page, C, props] of [['zone /remote-app', Zone, { serverData }], ['host /', Host, { hostRenderTimestamp: 't', initialSession: DEF, initialRoute: '/' }]]) {
  for (const [label, value] of cases) {
    store.clear(); if (value !== null) store.set('host_user_session', value); ran = new Set(); errs.length = 0;
    const t = performance.now(); let html = null, err = null;
    try { html = renderToString(React.createElement(C, props)); } catch (e) { err = e.message.split('\n')[0].slice(0, 140); }
    const ms = +(performance.now() - t).toFixed(1);
    const rec = { page, case: label, threw: err, ms };
    if (html) Object.assign(rec, {
      htmlLen: html.length,
      rawTagInjected: /<img|<script>alert|<svg onload/.test(html),
      escapedSeen: /&lt;img|&lt;script|&lt;svg/.test(html),
      attrBreakout: /onmouseover="alert/.test(html),
      zoneBannerUser: (html.match(/User: <strong>([^<]{0,60})/) || [])[1] ?? null,
      hostActiveSession: (html.match(/Active Session<\/dt><dd class="data-value">([^<]{0,60})/) || [])[1] ?? null,
      selectedOption: (html.match(/<option[^>]*selected=""[^>]*>([^<]*)/) || [])[1] ?? null,
      roleClass: (html.match(/class="role-tag ([^"]{0,60})"/) || [])[1] ?? null,
      reactWarnings: errs.slice(0, 2),
    });
    console.log(JSON.stringify(rec));
  }
}
