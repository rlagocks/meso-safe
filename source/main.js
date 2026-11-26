// 메소 금고 가계부 윈도우 앱
// 화면은 웹 주소(GitHub Pages)에서 열어서, 웹을 고치면 PC 앱도 자동으로 새 버전이 뜬다.
// 기록은 Firebase 계정에 저장되고, 인터넷이 없을 때는 마지막으로 연 화면과 기록이 보인다.
const { app, BrowserWindow, shell, Menu, session, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REMOTE = 'https://rlagocks.github.io/meso-safe/';
const REMOTE_ORIGIN = new URL(REMOTE).origin;
// 예전 버전이 쓰던 주소. 로그인 전에 이 PC에만 적어 둔 기록이 여기 저장돼 있다. (바꾸지 말 것)
const PORT = 47913;
const LOCAL = `http://localhost:${PORT}/`;
const ROOT = path.join(__dirname, 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css' };
const LEGACY_PAGE = '<!doctype html><meta charset="utf-8"><title>legacy</title>';

// 예전 주소의 화면 (인터넷이 없고 아직 한 번도 웹 주소를 못 열었을 때 대신 쓴다) + 예전 기록 꺼내기용 빈 페이지
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/__legacy') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(LEGACY_PAGE); }
      if (p === '/') p = '/index.html';
      const file = path.normalize(path.join(ROOT, p));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    });
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

// 예전 주소(localhost)에 남아 있는 가계부 기록을 읽어 온다. 지우지 않고 읽기만 한다.
async function readLegacy() {
  const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  try {
    await w.loadURL(LOCAL + '__legacy');
    return await w.webContents.executeJavaScript(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('meso-safe')) o[k] = localStorage.getItem(k); } return o; })()`);
  } catch (e) { return {}; }
  finally { w.destroy(); }
}

let legacy = {};
// preload.js가 웹 화면을 열기 직전에 물어본다 → 비어 있는 칸에만 채워 넣는다 (덮어쓰지 않음)
ipcMain.on('legacy-data', e => { e.returnValue = e.senderFrame && e.senderFrame.origin === REMOTE_ORIGIN ? legacy : {}; });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(async () => {
    let serverOk = true;
    try { await startServer(); } catch (e) { serverOk = false; }
    if (serverOk) legacy = await readLegacy();

    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1240, height: 880, minWidth: 380, minHeight: 560,
      title: '메소 금고 가계부', backgroundColor: '#ffd23f',
      icon: path.join(__dirname, 'build', 'icon.png'),
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
    });

    const isApp = url => url.startsWith(REMOTE) || url.startsWith(LOCAL);
    // 바깥 링크는 기본 브라우저로 연다
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      if (!isApp(url)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
    });

    // 웹 주소가 안 열리면(처음 실행인데 인터넷이 없을 때 등) 앱에 들어 있는 화면으로 연다
    let fellBack = false;
    win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
      if (!isMain || fellBack || !url.startsWith(REMOTE) || code === -3) return;
      fellBack = true;
      if (serverOk) win.loadURL(LOCAL);
    });

    // 캐시 때문에 옛 화면이 뜨지 않도록 항상 새로 확인한다 (서비스 워커가 오프라인일 때만 저장본을 쓴다)
    win.loadURL(REMOTE, { extraHeaders: 'pragma: no-cache\n' });

    // 기록이 디스크에 바로 써지도록 몇 초마다, 그리고 끌 때 저장한다 (강제 종료 대비)
    const flush = () => { try { session.defaultSession.flushStorageData(); } catch (e) {} };
    setInterval(flush, 3000);
    win.on('close', flush);
    app.on('before-quit', flush);
  });

  app.on('window-all-closed', () => app.quit());
}
