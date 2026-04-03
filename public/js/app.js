/* ===== App: ビュー管理・認証・ユーティリティ ===== */

const App = {
  currentUser: null,
  MAX_ROOMS: 3,

  async init() {
    try {
      const result = await auth.signInAnonymously();
      App.currentUser = result.user;
    } catch (e) {
      console.error('Auth error:', e);
      App.toast('認証に失敗しました');
    }

    // セッション内で認証済みならトップ画面へ
    if (sessionStorage.getItem('quiz-battle-access') === 'ok') {
      App.goTo('top');
    }
  },

  async verifyGate() {
    const input = document.getElementById('gate-code').value.trim();
    if (!input) { App.toast('アクセスコードを入力してください'); return; }

    App.showLoading();
    try {
      const doc = await db.collection('config').doc('access').get();
      if (!doc.exists) {
        App.toast('アクセスコードが未設定です');
        App.hideLoading();
        return;
      }
      if (doc.data().passcode !== input) {
        App.toast('アクセスコードが正しくありません');
        App.hideLoading();
        return;
      }
      sessionStorage.setItem('quiz-battle-access', 'ok');
      App.goTo('top');
    } catch (e) {
      console.error(e);
      App.toast('認証に失敗しました');
    }
    App.hideLoading();
  },

  goTo(viewName) {
    // アクセスコード未認証ならゲート画面に戻す（ゲート自体への遷移は許可）
    if (viewName !== 'gate' && sessionStorage.getItem('quiz-battle-access') !== 'ok') {
      viewName = 'gate';
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + viewName);
    if (el) el.classList.add('active');

    if (viewName === 'host-setup') Host.initSetup();
    window.scrollTo(0, 0);
  },

  showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
  },

  hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
  },

  toast(msg, duration = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._tid);
    el._tid = setTimeout(() => { el.style.display = 'none'; }, duration);
  },

  generateRoomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  },

  formatTime(ms) {
    return (ms / 1000).toFixed(1) + '秒';
  },

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  quizTypeLabel(type) {
    return { choice: '選択問題', text: '記述問題', sort: '並び替え問題' }[type] || type;
  },

  optionColors: ['opt-color-0','opt-color-1','opt-color-2','opt-color-3','opt-color-4','opt-color-5','opt-color-6','opt-color-7'],
};

// 初期化
App.init();
