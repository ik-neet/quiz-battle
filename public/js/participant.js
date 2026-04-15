/* ===== Participant: 参加者ロジック ===== */

const Participant = {
  roomCode: null,
  roomRef: null,
  participantRef: null,
  unsubRoom: null,
  unsubParticipants: null,
  quizStartTime: 0,
  hasAnswered: false,
  lastStatus: null,
  timerInterval: null,

  /* ---------- 入室 ---------- */

  async joinRoom() {
    const code = document.getElementById('join-room-code').value.trim();
    const name = document.getElementById('join-name').value.trim();

    if (!code || code.length !== 4) { App.toast('4桁のルームコードを入力してください'); return; }
    if (!name) { App.toast('ニックネームを入力してください'); return; }
    if (!App.currentUser) { App.toast('認証中です...しばらくお待ちください'); return; }

    App.showLoading();
    try {
      const roomDoc = await db.collection('rooms').doc(code).get();
      if (!roomDoc.exists) {
        App.toast('ルームが見つかりません');
        App.hideLoading();
        return;
      }

      const roomData = roomDoc.data();
      if (roomData.status !== 'waiting') {
        App.toast('このルームはすでに開始されています');
        App.hideLoading();
        return;
      }

      this.roomCode = code;
      this.roomRef = db.collection('rooms').doc(code);
      this.participantRef = this.roomRef.collection('participants').doc(App.currentUser.uid);

      await this.participantRef.set({
        name: name,
        score: 0,
        totalTimeMs: 0,
        hasAnswered: false,
        currentAnswer: null,
        currentAnswerTimeMs: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      document.getElementById('participant-room-code-display').textContent = code;
      this.listenToRoom();
      this.listenToParticipantsLobby();
      App.goTo('participant-lobby');
    } catch (e) {
      console.error(e);
      App.toast('入室に失敗しました');
    }
    App.hideLoading();
  },

  listenToParticipantsLobby() {
    if (this.unsubParticipants) this.unsubParticipants();
    this.unsubParticipants = this.roomRef.collection('participants').onSnapshot(snap => {
      const list = document.getElementById('participant-list-lobby');
      if (list) {
        const names = [];
        snap.forEach(doc => names.push(doc.data().name));
        list.innerHTML = names.map(n => `<span class="participant-chip">${App.escapeHtml(n)}</span>`).join('');
      }
    });
  },

  listenToRoom() {
    if (this.unsubRoom) this.unsubRoom();
    this.unsubRoom = this.roomRef.onSnapshot(snap => {
      if (!snap.exists) {
        this.onRoomDeleted();
        return;
      }
      const data = snap.data();
      this.onRoomUpdate(data);
    });
  },

  onRoomUpdate(data) {
    const status = data.status;

    if (status === 'playing' && this.lastStatus !== 'playing') {
      this.onQuizStart(data);
    } else if (status === 'tally' && this.lastStatus !== 'tally') {
      this.onTally(data);
    } else if (status === 'reveal' && this.lastStatus !== 'reveal') {
      this.onReveal(data);
    } else if (status === 'finished' && this.lastStatus !== 'finished') {
      this.onFinished(data);
    }

    this.lastStatus = status;
  },

  /* ---------- クイズ開始 ---------- */

  onQuizStart(data) {
    const quiz = data.currentQuiz;
    if (!quiz) return;

    this.hasAnswered = false;
    this.quizStartTime = Date.now();
    this._currentQuizOptions = quiz.options || null;

    App.goTo('participant-game');

    document.getElementById('p-quiz-progress').textContent = `Q${data.currentQuizIndex + 1} / ${data.totalQuizzes}`;
    document.getElementById('p-quiz-type-badge').textContent = App.quizTypeLabel(quiz.type);
    document.getElementById('p-quiz-question').textContent = quiz.question;

    // 表示切替
    document.getElementById('p-state-answering').style.display = 'block';
    document.getElementById('p-state-answered').style.display = 'none';
    document.getElementById('p-state-result').style.display = 'none';

    const optGrid = document.getElementById('p-quiz-options');
    const textArea = document.getElementById('p-text-input-area');
    const sortArea = document.getElementById('p-sort-area');

    optGrid.style.display = 'none';
    textArea.style.display = 'none';
    sortArea.style.display = 'none';

    if (quiz.type === 'choice') {
      optGrid.style.display = 'grid';
      optGrid.innerHTML = quiz.options.map((o, i) =>
        `<button class="option-btn ${App.optionColors[i]}" onclick="Participant.submitChoiceAnswer(${i})">${App.escapeHtml(o)}</button>`
      ).join('');
    } else if (quiz.type === 'text') {
      textArea.style.display = 'block';
      document.getElementById('p-text-answer').value = '';
      document.getElementById('p-text-answer').focus();
    } else if (quiz.type === 'sort') {
      sortArea.style.display = 'block';
      this.sortItems = [...quiz.options];
      this.renderSortList();
    }

    // タイマー
    this.startTimer(quiz.timeLimit);
  },

  startTimer(seconds) {
    clearInterval(this.timerInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('p-timer');
    timerEl.textContent = remaining;
    timerEl.classList.remove('urgent');

    this.timerInterval = setInterval(() => {
      remaining--;
      timerEl.textContent = Math.max(0, remaining);
      if (remaining <= 5) timerEl.classList.add('urgent');
      if (remaining <= 0) clearInterval(this.timerInterval);
    }, 1000);
  },

  /* ---------- 並び替え ---------- */

  sortItems: [],

  renderSortList() {
    const list = document.getElementById('p-sort-list');
    list.innerHTML = this.sortItems.map((item, i) => `
      <div class="sort-item">
        <span class="sort-num">${i + 1}</span>
        <span class="sort-text">${App.escapeHtml(item)}</span>
        <div class="sort-actions">
          <button onclick="Participant.moveSortItem(${i}, -1)" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
          <button onclick="Participant.moveSortItem(${i}, 1)" ${i === this.sortItems.length - 1 ? 'disabled' : ''}>&#9660;</button>
        </div>
      </div>
    `).join('');
  },

  moveSortItem(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.sortItems.length) return;
    [this.sortItems[idx], this.sortItems[newIdx]] = [this.sortItems[newIdx], this.sortItems[idx]];
    this.renderSortList();
  },

  /* ---------- 回答送信 ---------- */

  async submitChoiceAnswer(idx) {
    if (this.hasAnswered) return;
    await this.submitAnswer(idx);
  },

  async submitTextAnswer() {
    if (this.hasAnswered) return;
    const answer = document.getElementById('p-text-answer').value.trim();
    if (!answer) { App.toast('回答を入力してください'); return; }
    await this.submitAnswer(answer);
  },

  async submitSortAnswer() {
    if (this.hasAnswered) return;
    await this.submitAnswer([...this.sortItems]);
  },

  async submitAnswer(answer) {
    this.hasAnswered = true;
    const elapsed = Date.now() - this.quizStartTime;

    try {
      await this.participantRef.update({
        hasAnswered: true,
        currentAnswer: answer,
        currentAnswerTimeMs: elapsed
      });
    } catch (e) {
      console.error(e);
      App.toast('回答の送信に失敗しました');
      this.hasAnswered = false;
      return;
    }

    // 回答内容と回答時間を表示
    let answerDisplay;
    if (Array.isArray(answer)) {
      answerDisplay = answer.join(' → ');
    } else if (typeof answer === 'number' && this._currentQuizOptions) {
      answerDisplay = this._currentQuizOptions[answer] || String(answer);
    } else {
      answerDisplay = String(answer);
    }

    const detailEl = document.getElementById('p-answered-detail');
    detailEl.innerHTML = `
      <div class="detail-answer">あなたの回答: ${App.escapeHtml(answerDisplay)}</div>
      <div class="detail-time">回答時間: ${App.formatTime(elapsed)}</div>
    `;

    document.getElementById('p-state-answering').style.display = 'none';
    document.getElementById('p-state-answered').style.display = 'block';
    // タイマーは止めない（残り時間を表示し続ける）
  },

  /* ---------- 集計・発表 ---------- */

  onTally(data) {
    clearInterval(this.timerInterval);
    // 回答済み表示を維持（未回答なら時間切れ表示）
    if (!this.hasAnswered) {
      document.getElementById('p-state-answering').style.display = 'none';
      document.getElementById('p-state-answered').style.display = 'block';
      document.querySelector('#p-state-answered .answered-message p').textContent = '時間切れ!';
    }
  },

  async onReveal(data) {
    // 自分の結果を取得
    const myDoc = await this.participantRef.get();
    const myData = myDoc.data();

    const display = document.getElementById('p-result-display');
    const isCorrect = myData.isCorrect !== undefined ? myData.isCorrect :
      (myData.score > (this._prevScore || 0));

    // 前回スコア記録
    this._prevScore = myData.score;

    display.innerHTML = `
      <div class="result-icon">${isCorrect ? '⭕' : '❌'}</div>
      <div class="result-text">${isCorrect ? '正解!' : '不正解...'}</div>
      <div class="result-answer">正解: ${App.escapeHtml(data.currentAnswer || '')}</div>
      <div class="result-answer" style="margin-top:0.5rem">あなたのスコア: ${myData.score || 0}pt</div>
    `;

    document.getElementById('p-state-answering').style.display = 'none';
    document.getElementById('p-state-answered').style.display = 'none';
    document.getElementById('p-state-result').style.display = 'block';
  },

  async onFinished(data) {
    clearInterval(this.timerInterval);

    // 最終結果取得（クライアント側ソート）
    const snap = await this.roomRef.collection('participants').get();

    const ranking = [];
    snap.forEach(doc => {
      ranking.push({ id: doc.id, ...doc.data() });
    });
    ranking.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.totalTimeMs || 0) - (b.totalTimeMs || 0));

    let myRank = 0;
    let myData = null;
    ranking.forEach((p, i) => {
      if (p.id === App.currentUser.uid) {
        myRank = i + 1;
        myData = p;
      }
    });

    // 個人結果
    const personalEl = document.getElementById('p-final-result');
    if (myData) {
      personalEl.innerHTML = `
        <div class="place">${myRank}位</div>
        <div class="place-label">${myRank === 1 ? '優勝!' : myRank <= 3 ? '入賞!' : ''}</div>
        <div class="stats">${myData.score || 0}pt / 合計時間: ${App.formatTime(myData.totalTimeMs || 0)}</div>
      `;
    }

    // 全順位
    document.getElementById('p-final-ranking').innerHTML = ranking.map((p, i) => `
      <div class="rank-row" ${p.id === App.currentUser.uid ? 'style="background:#EBF5FB"' : ''}>
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${App.escapeHtml(p.name)}</span>
        <span class="rank-score">${p.score || 0}pt</span>
        <span class="rank-time">${App.formatTime(p.totalTimeMs || 0)}</span>
      </div>
    `).join('');

    App.goTo('participant-final');
    this.cleanup();
  },

  onRoomDeleted() {
    clearInterval(this.timerInterval);
    this.cleanup();
    document.getElementById('abort-modal').style.display = 'flex';
  },

  cleanup() {
    clearInterval(this.timerInterval);
    if (this.unsubRoom) this.unsubRoom();
    if (this.unsubParticipants) this.unsubParticipants();
  }
};
