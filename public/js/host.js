/* ===== Host: 主催者ロジック ===== */

const Host = {
  quizzes: [],
  editingIndex: -1,
  roomCode: null,
  roomRef: null,
  participants: {},
  participantsRef: null,
  currentQuizIndex: 0,
  timerInterval: null,
  timerRemaining: 0,
  unsubRoom: null,
  unsubParticipants: null,

  /* ---------- セットアップ ---------- */

  initSetup() {
    this.quizzes = [];
    this.editingIndex = -1;
    this.renderQuizList();
    this.onTypeChange();
    this.updateOptionInputs();
    this.clearForm();
  },

  onTypeChange() {
    const type = document.getElementById('quiz-type').value;
    const optSec = document.getElementById('options-section');
    const txtSec = document.getElementById('text-answer-section');
    const correctSec = document.getElementById('correct-answer-section');
    const sortHint = document.getElementById('sort-hint');

    if (type === 'text') {
      optSec.style.display = 'none';
      txtSec.style.display = 'block';
    } else {
      optSec.style.display = 'block';
      txtSec.style.display = 'none';
      if (type === 'sort') {
        correctSec.style.display = 'none';
        sortHint.style.display = 'block';
      } else {
        correctSec.style.display = 'block';
        sortHint.style.display = 'none';
      }
      this.updateOptionInputs();
    }
  },

  updateOptionInputs() {
    const count = parseInt(document.getElementById('option-count').value);
    document.getElementById('option-count-label').textContent = count;
    const list = document.getElementById('options-list');
    const labels = 'ABCDEFGH';

    // 既存の値を保持
    const existing = [];
    list.querySelectorAll('input').forEach(inp => existing.push(inp.value));

    list.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'option-edit-row';
      row.innerHTML = `
        <span class="option-label">${labels[i]}</span>
        <input type="text" placeholder="選択肢${labels[i]}" value="${App.escapeHtml(existing[i] || '')}">
      `;
      list.appendChild(row);
    }

    // 正解セレクトを更新
    const sel = document.getElementById('correct-answer');
    const prevVal = sel.value;
    sel.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = labels[i];
      sel.appendChild(opt);
    }
    if (parseInt(prevVal) < count) sel.value = prevVal;
  },

  clearForm() {
    document.getElementById('quiz-question').value = '';
    document.getElementById('quiz-type').value = 'choice';
    document.getElementById('option-count').value = 4;
    document.getElementById('text-correct-answer').value = '';
    document.getElementById('quiz-time-limit').value = 30;
    document.getElementById('correct-answer').value = 0;
    document.getElementById('btn-add-quiz').textContent = '問題を追加';
    this.editingIndex = -1;
    this.onTypeChange();
    this.updateOptionInputs();
  },

  addQuiz() {
    const type = document.getElementById('quiz-type').value;
    const question = document.getElementById('quiz-question').value.trim();
    const timeLimit = parseInt(document.getElementById('quiz-time-limit').value) || 30;

    if (!question) { App.toast('問題文を入力してください'); return; }

    let options = [];
    let correctAnswer;

    if (type === 'choice' || type === 'sort') {
      const inputs = document.querySelectorAll('#options-list input');
      options = Array.from(inputs).map(i => i.value.trim());
      if (options.some(o => !o)) { App.toast('すべての選択肢を入力してください'); return; }

      if (type === 'choice') {
        correctAnswer = parseInt(document.getElementById('correct-answer').value);
      } else {
        // 並び替え: 正しい順序 = 入力順
        correctAnswer = [...options];
      }
    } else {
      correctAnswer = document.getElementById('text-correct-answer').value.trim();
      if (!correctAnswer) { App.toast('正解を入力してください'); return; }
    }

    const quiz = { type, question, options, correctAnswer, timeLimit };

    if (this.editingIndex >= 0) {
      this.quizzes[this.editingIndex] = quiz;
      App.toast('問題を更新しました');
    } else {
      this.quizzes.push(quiz);
      App.toast('問題を追加しました');
    }

    this.clearForm();
    this.renderQuizList();
  },

  editQuiz(idx) {
    const q = this.quizzes[idx];
    this.editingIndex = idx;
    document.getElementById('quiz-type').value = q.type;
    document.getElementById('quiz-question').value = q.question;
    document.getElementById('quiz-time-limit').value = q.timeLimit;
    this.onTypeChange();

    if (q.type === 'choice' || q.type === 'sort') {
      document.getElementById('option-count').value = q.options.length;
      this.updateOptionInputs();
      const inputs = document.querySelectorAll('#options-list input');
      q.options.forEach((o, i) => { if (inputs[i]) inputs[i].value = o; });
      if (q.type === 'choice') {
        document.getElementById('correct-answer').value = q.correctAnswer;
      }
    } else {
      document.getElementById('text-correct-answer').value = q.correctAnswer;
    }

    document.getElementById('btn-add-quiz').textContent = '問題を更新';
    document.getElementById('quiz-form').scrollIntoView({ behavior: 'smooth' });
  },

  deleteQuiz(idx) {
    this.quizzes.splice(idx, 1);
    if (this.editingIndex === idx) this.clearForm();
    this.renderQuizList();
  },

  renderQuizList() {
    const list = document.getElementById('quiz-list');
    const count = document.getElementById('quiz-count');
    const btn = document.getElementById('btn-create-room');
    count.textContent = this.quizzes.length;
    btn.disabled = this.quizzes.length === 0;

    if (this.quizzes.length === 0) {
      list.innerHTML = '<p class="empty-msg">まだ問題がありません</p>';
      return;
    }

    list.innerHTML = this.quizzes.map((q, i) => `
      <div class="quiz-list-item">
        <span class="quiz-num">Q${i + 1}</span>
        <div class="quiz-info">
          <div class="quiz-text">${App.escapeHtml(q.question)}</div>
          <div class="quiz-meta">${App.quizTypeLabel(q.type)} / ${q.timeLimit}秒</div>
        </div>
        <div class="quiz-list-actions">
          <button class="btn btn-ghost btn-sm" onclick="Host.editQuiz(${i})">編集</button>
          <button class="btn btn-ghost btn-sm" onclick="Host.deleteQuiz(${i})">削除</button>
        </div>
      </div>
    `).join('');
  },

  /* ---------- 部屋作成 ---------- */

  async createRoom() {
    if (this.quizzes.length === 0) return;
    if (!App.currentUser) { App.toast('認証中です...しばらくお待ちください'); return; }

    App.showLoading();
    try {
      let code = App.generateRoomCode();
      // コード重複チェック
      let doc = await db.collection('rooms').doc(code).get();
      let tries = 0;
      while (doc.exists && tries < 10) {
        code = App.generateRoomCode();
        doc = await db.collection('rooms').doc(code).get();
        tries++;
      }

      this.roomCode = code;
      this.roomRef = db.collection('rooms').doc(code);
      this.participantsRef = this.roomRef.collection('participants');

      await this.roomRef.set({
        hostId: App.currentUser.uid,
        status: 'waiting',
        currentQuizIndex: -1,
        totalQuizzes: this.quizzes.length,
        currentQuiz: null,
        currentAnswer: null,
        answerDistribution: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      document.getElementById('host-room-code').textContent = code;
      this.participants = {};
      this.listenToParticipants();
      App.goTo('host-lobby');
    } catch (e) {
      console.error(e);
      App.toast('部屋の作成に失敗しました');
    }
    App.hideLoading();
  },

  listenToParticipants() {
    if (this.unsubParticipants) this.unsubParticipants();
    this.unsubParticipants = this.participantsRef.onSnapshot(snap => {
      this.participants = {};
      snap.forEach(doc => { this.participants[doc.id] = doc.data(); });
      this.renderParticipants();
    });
  },

  renderParticipants() {
    const count = Object.keys(this.participants).length;

    // ロビー
    const lobbyCount = document.getElementById('host-participant-count');
    const lobbyList = document.getElementById('host-participant-list');
    const startBtn = document.getElementById('btn-start-game');
    if (lobbyCount) lobbyCount.textContent = count;
    if (lobbyList) {
      if (count === 0) {
        lobbyList.innerHTML = '<p class="empty-msg">参加者の入室を待っています...</p>';
      } else {
        lobbyList.innerHTML = Object.values(this.participants)
          .map(p => `<span class="participant-chip">${App.escapeHtml(p.name)}</span>`).join('');
      }
    }
    if (startBtn) startBtn.disabled = count === 0;

    // ゲーム中の回答数
    const answeredCount = Object.values(this.participants).filter(p => p.hasAnswered).length;
    const ansCountEl = document.getElementById('host-answer-count');
    if (ansCountEl) ansCountEl.textContent = `回答: ${answeredCount}/${count}`;
  },

  /* ---------- ゲーム進行 ---------- */

  async startGame() {
    this.currentQuizIndex = 0;
    await this.showQuiz(0);
    App.goTo('host-game');
  },

  async showQuiz(idx) {
    const quiz = this.quizzes[idx];
    this.currentQuizIndex = idx;

    // 参加者の回答状態リセット
    const batch = db.batch();
    Object.keys(this.participants).forEach(pid => {
      batch.update(this.participantsRef.doc(pid), {
        hasAnswered: false,
        currentAnswer: null,
        currentAnswerTimeMs: 0
      });
    });
    await batch.commit();

    // 出題データ作成（正解は含めない）
    const quizData = {
      type: quiz.type,
      question: quiz.question,
      timeLimit: quiz.timeLimit,
    };
    if (quiz.type === 'choice') {
      quizData.options = quiz.options;
    } else if (quiz.type === 'sort') {
      quizData.options = App.shuffleArray(quiz.options);
    }

    await this.roomRef.update({
      status: 'playing',
      currentQuizIndex: idx,
      currentQuiz: quizData,
      currentAnswer: null,
      answerDistribution: null,
      quizStartedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // UI更新
    document.getElementById('host-quiz-progress').textContent = `Q${idx + 1} / ${this.quizzes.length}`;
    document.getElementById('host-quiz-type-badge').textContent = App.quizTypeLabel(quiz.type);
    document.getElementById('host-quiz-question').textContent = quiz.question;

    const optDisp = document.getElementById('host-quiz-options');
    if (quiz.type === 'choice') {
      optDisp.innerHTML = quiz.options.map((o, i) =>
        `<div class="option-card ${App.optionColors[i]}">${App.escapeHtml(o)}</div>`
      ).join('');
    } else if (quiz.type === 'sort') {
      optDisp.innerHTML = quizData.options.map((o, i) =>
        `<div class="option-card ${App.optionColors[i]}">${App.escapeHtml(o)}</div>`
      ).join('');
    } else {
      optDisp.innerHTML = '<div class="option-card opt-color-1">記述回答</div>';
    }

    // 状態表示切替
    document.getElementById('host-state-question').style.display = 'block';
    document.getElementById('host-state-tally').style.display = 'none';
    document.getElementById('host-state-reveal').style.display = 'none';

    // タイマー開始
    this.startTimer(quiz.timeLimit);
  },

  startTimer(seconds) {
    clearInterval(this.timerInterval);
    this.timerRemaining = seconds;
    const timerEl = document.getElementById('host-timer');
    timerEl.textContent = seconds;
    timerEl.classList.remove('urgent');

    this.timerInterval = setInterval(() => {
      this.timerRemaining--;
      timerEl.textContent = this.timerRemaining;

      if (this.timerRemaining <= 5) timerEl.classList.add('urgent');

      // 全員回答済みチェック
      const total = Object.keys(this.participants).length;
      const answered = Object.values(this.participants).filter(p => p.hasAnswered).length;
      if (total > 0 && answered >= total) {
        this.timeUp();
        return;
      }

      if (this.timerRemaining <= 0) {
        this.timeUp();
      }
    }, 1000);
  },

  async timeUp() {
    clearInterval(this.timerInterval);
    document.getElementById('host-timer').textContent = '0';

    await this.roomRef.update({ status: 'tally' });

    // 回答集計
    this.showTally();
  },

  showTally() {
    const quiz = this.quizzes[this.currentQuizIndex];
    const answers = {};

    Object.values(this.participants).forEach(p => {
      if (!p.hasAnswered || p.currentAnswer === null || p.currentAnswer === undefined) return;
      let key;
      if (quiz.type === 'sort') {
        key = Array.isArray(p.currentAnswer) ? p.currentAnswer.join(' → ') : String(p.currentAnswer);
      } else {
        key = String(p.currentAnswer);
      }
      answers[key] = (answers[key] || 0) + 1;
    });

    const sorted = Object.entries(answers).sort((a, b) => b[1] - a[1]);
    const total = Object.values(this.participants).filter(p => p.hasAnswered).length || 1;
    const maxCount = sorted.length > 0 ? sorted[0][1] : 0;

    const chartEl = document.getElementById('host-tally-chart');
    if (sorted.length === 0) {
      chartEl.innerHTML = '<p class="empty-msg">回答がありませんでした</p>';
    } else {
      chartEl.innerHTML = sorted.map(([label, count], i) => {
        let displayLabel = label;
        if (quiz.type === 'choice') {
          const idx = parseInt(label);
          if (!isNaN(idx) && quiz.options[idx]) displayLabel = quiz.options[idx];
        }
        const pct = Math.round((count / maxCount) * 100);
        return `
          <div class="tally-row">
            <div class="tally-label">${App.escapeHtml(displayLabel)}</div>
            <div class="tally-bar-wrap">
              <div class="tally-bar ${App.optionColors[i % 8]}" style="width:${pct}%">
                <span>${count}</span>
              </div>
            </div>
            <div class="tally-count">${Math.round(count / total * 100)}%</div>
          </div>
        `;
      }).join('');
    }

    document.getElementById('host-state-question').style.display = 'none';
    document.getElementById('host-state-tally').style.display = 'block';
  },

  async revealAnswer() {
    const quiz = this.quizzes[this.currentQuizIndex];
    let answerDisplay;

    if (quiz.type === 'choice') {
      answerDisplay = quiz.options[quiz.correctAnswer];
    } else if (quiz.type === 'sort') {
      answerDisplay = quiz.correctAnswer.join(' → ');
    } else {
      answerDisplay = quiz.correctAnswer;
    }

    // スコア計算
    const batch = db.batch();
    Object.entries(this.participants).forEach(([pid, p]) => {
      if (!p.hasAnswered) return;
      let correct = false;

      if (quiz.type === 'choice') {
        correct = p.currentAnswer === quiz.correctAnswer;
      } else if (quiz.type === 'text') {
        correct = String(p.currentAnswer).trim() === String(quiz.correctAnswer).trim();
      } else if (quiz.type === 'sort') {
        correct = Array.isArray(p.currentAnswer) &&
          p.currentAnswer.length === quiz.correctAnswer.length &&
          p.currentAnswer.every((v, i) => v === quiz.correctAnswer[i]);
      }

      const newScore = (p.score || 0) + (correct ? 1 : 0);
      const newTime = (p.totalTimeMs || 0) + (p.currentAnswerTimeMs || 0);

      batch.update(this.participantsRef.doc(pid), {
        score: newScore,
        totalTimeMs: newTime
      });
      // ローカル更新
      this.participants[pid].score = newScore;
      this.participants[pid].totalTimeMs = newTime;
      this.participants[pid].isCorrect = correct;
    });
    await batch.commit();

    // Firestoreに正解を反映
    await this.roomRef.update({
      status: 'reveal',
      currentAnswer: answerDisplay
    });

    // 正解表示
    document.getElementById('host-correct-answer').textContent = answerDisplay;

    // スコアボード
    const ranking = Object.entries(this.participants)
      .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, time: p.totalTimeMs || 0, isCorrect: p.isCorrect }))
      .sort((a, b) => b.score - a.score || a.time - b.time);

    document.getElementById('host-scoreboard').innerHTML = ranking.map((p, i) => `
      <div class="score-row">
        <span class="score-rank">${i + 1}</span>
        <span class="score-name">${App.escapeHtml(p.name)} ${p.isCorrect ? '⭕' : '❌'}</span>
        <span class="score-pts">${p.score}pt</span>
      </div>
    `).join('');

    // 次の問題 or 最終結果
    const isLast = this.currentQuizIndex >= this.quizzes.length - 1;
    const nextBtn = document.getElementById('btn-next-quiz');
    nextBtn.textContent = isLast ? '最終結果を見る' : '次の問題へ';

    document.getElementById('host-state-tally').style.display = 'none';
    document.getElementById('host-state-reveal').style.display = 'block';
  },

  async nextQuiz() {
    const nextIdx = this.currentQuizIndex + 1;
    if (nextIdx >= this.quizzes.length) {
      await this.showFinalResults();
      return;
    }
    await this.showQuiz(nextIdx);
  },

  async showFinalResults() {
    await this.roomRef.update({ status: 'finished' });

    const ranking = Object.entries(this.participants)
      .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, time: p.totalTimeMs || 0 }))
      .sort((a, b) => b.score - a.score || a.time - b.time);

    // 表彰台
    const podiumEl = document.getElementById('host-final-podium');
    const podiumData = [
      { idx: 1, cls: 'silver', label: '2nd' },
      { idx: 0, cls: 'gold', label: '1st' },
      { idx: 2, cls: 'bronze', label: '3rd' },
    ];
    podiumEl.innerHTML = podiumData.map(pd => {
      const p = ranking[pd.idx];
      if (!p) return `<div class="podium-item"><div class="podium-bar ${pd.cls}"><span>${pd.label}</span></div></div>`;
      return `
        <div class="podium-item">
          <div class="podium-name">${App.escapeHtml(p.name)}</div>
          <div class="podium-score">${p.score}pt / ${App.formatTime(p.time)}</div>
          <div class="podium-bar ${pd.cls}"><span>${pd.label}</span></div>
        </div>
      `;
    }).join('');

    // 全順位
    document.getElementById('host-final-ranking').innerHTML = ranking.map((p, i) => `
      <div class="rank-row">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${App.escapeHtml(p.name)}</span>
        <span class="rank-score">${p.score}pt</span>
        <span class="rank-time">${App.formatTime(p.time)}</span>
      </div>
    `).join('');

    App.goTo('host-final');
    this.cleanup();
  },

  cleanup() {
    clearInterval(this.timerInterval);
    if (this.unsubParticipants) this.unsubParticipants();
    if (this.unsubRoom) this.unsubRoom();
  }
};
