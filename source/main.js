// 메소 금고 가계부 윈도우 앱
// 앱 파일을 이 컴퓨터 안(localhost)에서 열어서, 기록이 껐다 켜도 그대로 남게 한다.
const { app, BrowserWindow, shell, Menu, session } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 47913; // 고정 포트: 바꾸면 저장된 기록이 안 보이므로 그대로 둔다
const ROOT = path.join(__dirname, 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css' };

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(async () => {
    try { await startServer(); }
    catch (e) {
      const { dialog } = require('electron');
      dialog.showErrorBox('메소 금고 가계부', '프로그램을 열지 못했어요. 이미 켜져 있는지 확인하거나 컴퓨터를 다시 시작해 주세요.');
      return app.quit();
    }
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1240, height: 880, minWidth: 380, minHeight: 560,
      title: '메소 금고 가계부', backgroundColor: '#ffd23f',
      icon: path.join(__dirname, 'build', 'icon.png'),
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, sandbox: true }
    });
    // 바깥 링크는 기본 브라우저로 연다
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url) && !url.startsWith(`http://localhost:${PORT}`)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.loadURL(`http://localhost:${PORT}/`);
    // 기록이 디스크에 바로 써지도록 몇 초마다, 그리고 끌 때 저장한다 (강제 종료 대비)
    const flush = () => { try { session.defaultSession.flushStorageData(); } catch (e) {} };
    setInterval(flush, 3000);
    win.on('close', flush);
    app.on('before-quit', flush);
  });

  app.on('window-all-closed', () => app.quit());
}
