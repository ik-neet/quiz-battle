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
  },

  /** 主催者モードへの遷移（認証済みならスキップ） */
  enterHost() {
    if (sessionStorage.getItem('quiz-battle-host') === 'ok') {
      App.goTo('host-setup');
    } else {
      App.goTo('host-gate');
      document.getElementById('gate-code').value = '';
      document.getElementById('gate-code').focus();
    }
  },

  /** 主催者アクセスコード検証 */
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
      sessionStorage.setItem('quiz-battle-host', 'ok');
      App.goTo('host-setup');
    } catch (e) {
      console.error(e);
      App.toast('認証に失敗しました');
    }
    App.hideLoading();
  },

  goTo(viewName) {
    // 主催者画面は認証必須（gate自体とtopは除く）
    const hostViews = ['host-setup', 'host-lobby', 'host-game', 'host-final'];
    if (hostViews.includes(viewName) && sessionStorage.getItem('quiz-battle-host') !== 'ok') {
      App.enterHost();
      return;
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
