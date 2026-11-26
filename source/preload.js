// 웹 화면이 뜨기 직전에, 예전 버전(이 PC에만 저장)에서 적어 둔 기록을 새 주소의 저장 공간으로 복사한다.
// 이미 값이 있는 칸은 건드리지 않으므로 몇 번을 실행해도 기존 데이터가 지워지거나 덮어써지지 않는다.
// 로그인하면 가계부가 "이 기기에 적은 기록 N개를 계정으로 옮길까요?"라고 물어본다.
const { ipcRenderer } = require('electron');
try {
  if (location.origin === 'https://rlagocks.github.io') {
    const data = ipcRenderer.sendSync('legacy-data') || {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && localStorage.getItem(k) === null) localStorage.setItem(k, v);
    }
  }
} catch (e) {}
