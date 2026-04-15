/* ===== Host: 主催者ロジック ===== */

const Host = {
  /* --- 状態 --- */
  stockQuizzes: [],        // Firestoreから読み込んだクイズ一覧
  checkedQuizIds: [],      // チェック済みクイズID（一括削除用）
  editingQuizId: null,     // 編集中のクイズID (null = 新規)
  selectedQuizIds: [],     // 部屋作成で選択されたクイズID
  selectedQuizzes: [],     // 部屋作成で選択されたクイズデータ
  activeTagFilter: null,   // タグフィルタ（クイズ管理用）
  stockTypeFilters: [],    // タイプフィルタ（クイズ管理用、複数選択）
  roomTagFilter: null,     // タグフィルタ（部屋作成用）
  roomTypeFilters: [],     // タイプフィルタ（部屋作成用、複数選択）
  quizOrderMode: 'manual', // 出題順モード: manual / random
  formSelectedTags: [],    // フォーム内で選択中のタグ

  quizzes: [],             // ゲーム用: 出題クイズ配列
  roomCode: null,
  roomRef: null,
  participants: {},
  participantsRef: null,
  currentQuizIndex: 0,
  timerInterval: null,
  timerRemaining: 0,
  unsubRoom: null,
  unsubParticipants: null,
  ROOM_EXPIRE_HOURS: 3,

  /* ========== クイズ管理 ========== */

  async initQuizManage() {
    this.editingQuizId = null;
    this.activeTagFilter = null;
    this.stockTypeFilters = [];
    this.checkedQuizIds = [];
    this.formSelectedTags = [];
    this.resetTypeChips('stock-type-chips');
    this.hideQuizForm();
    await this.loadStockQuizzes();
  },

  /* --- フォーム表示/非表示 --- */
  showQuizForm(editId) {
    this.clearForm();
    if (editId) {
      this.editStockQuiz(editId);
    }
    document.getElementById('quiz-form').style.display = 'block';
    document.getElementById('quiz-form').scrollIntoView({ behavior: 'smooth' });
  },

  hideQuizForm() {
    document.getElementById('quiz-form').style.display = 'none';
    this.clearForm();
  },

  async loadStockQuizzes() {
    if (!App.currentUser) return;
    try {
      const snap = await db.collection('quizzes')
        .where('ownerId', '==', App.currentUser.uid)
        .get();
      this.stockQuizzes = [];
      snap.forEach(doc => this.stockQuizzes.push({ id: doc.id, ...doc.data() }));
      this.stockQuizzes.sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
    } catch (e) {
      console.error(e);
      this.stockQuizzes = [];
    }
    this.renderStockTagList();
    this.renderStockQuizList();
  },

  /* --- タイプ切替 --- */
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
    document.getElementById('quiz-points').value = 1;
    document.getElementById('correct-answer').value = 0;
    document.getElementById('quiz-tags').value = '';
    document.getElementById('quiz-form-title').textContent = '新しい問題を追加';
    document.getElementById('btn-save-quiz').textContent = '保存する';
    this.editingQuizId = null;
    this.formSelectedTags = [];
    this.renderFormExistingTags();
    this.onTypeChange();
    this.updateOptionInputs();
  },

  /* --- 既存タグ選択UI --- */
  getAllTags() {
    const tags = new Set();
    this.stockQuizzes.forEach(q => (q.tags || []).forEach(t => tags.add(t)));
    return [...tags].sort();
  },

  renderFormExistingTags() {
    const allTags = this.getAllTags();
    const el = document.getElementById('quiz-existing-tags');
    if (allTags.length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = allTags.map(tag => {
      const active = this.formSelectedTags.includes(tag);
      return `<span class="tag-chip ${active ? 'active' : ''}" onclick="Host.toggleFormTag('${App.escapeHtml(tag)}')">${App.escapeHtml(tag)}</span>`;
    }).join('');
  },

  toggleFormTag(tag) {
    const idx = this.formSelectedTags.indexOf(tag);
    if (idx >= 0) {
      this.formSelectedTags.splice(idx, 1);
    } else {
      this.formSelectedTags.push(tag);
    }
    this.renderFormExistingTags();
  },

  /* --- クイズ保存 (新規 or 更新) --- */
  async saveQuiz() {
    const type = document.getElementById('quiz-type').value;
    const question = document.getElementById('quiz-question').value.trim();
    const timeLimit = parseInt(document.getElementById('quiz-time-limit').value) || 30;
    const points = parseInt(document.getElementById('quiz-points').value) || 1;
    const tagsRaw = document.getElementById('quiz-tags').value.trim();
    const newTags = tagsRaw ? tagsRaw.split(/[,、]/).map(t => t.trim()).filter(Boolean) : [];
    const tags = [...new Set([...this.formSelectedTags, ...newTags])];

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
        correctAnswer = [...options];
      }
    } else {
      correctAnswer = document.getElementById('text-correct-answer').value.trim();
      if (!correctAnswer) { App.toast('正解を入力してください'); return; }
    }

    const data = {
      ownerId: App.currentUser.uid,
      type, question, options, correctAnswer, timeLimit, points, tags,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    App.showLoading();
    try {
      if (this.editingQuizId) {
        await db.collection('quizzes').doc(this.editingQuizId).update(data);
        App.toast('問題を更新しました');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('quizzes').add(data);
        App.toast('問題を保存しました');
      }
      this.hideQuizForm();
      await this.loadStockQuizzes();
    } catch (e) {
      console.error(e);
      App.toast('保存に失敗しました');
    }
    App.hideLoading();
  },

  /* --- クイズ編集 --- */
  editStockQuiz(quizId) {
    const q = this.stockQuizzes.find(x => x.id === quizId);
    if (!q) return;
    this.editingQuizId = quizId;

    document.getElementById('quiz-type').value = q.type;
    document.getElementById('quiz-question').value = q.question;
    document.getElementById('quiz-time-limit').value = q.timeLimit;
    document.getElementById('quiz-points').value = q.points || 1;
    document.getElementById('quiz-tags').value = '';
    document.getElementById('quiz-form-title').textContent = '問題を編集';
    document.getElementById('btn-save-quiz').textContent = '更新する';

    // 既存タグを選択状態に復元
    this.formSelectedTags = [...(q.tags || [])];
    this.renderFormExistingTags();

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

    document.getElementById('quiz-form').style.display = 'block';
    document.getElementById('quiz-form').scrollIntoView({ behavior: 'smooth' });
  },

  /* --- クイズ削除 --- */
  async deleteStockQuiz(quizId) {
    if (!confirm('この問題を削除しますか？')) return;
    App.showLoading();
    try {
      await db.collection('quizzes').doc(quizId).delete();
      if (this.editingQuizId === quizId) this.hideQuizForm();
      await this.loadStockQuizzes();
      App.toast('問題を削除しました');
    } catch (e) {
      console.error(e);
      App.toast('削除に失敗しました');
    }
    App.hideLoading();
  },

  /* --- タグ一覧 (クイズ管理) --- */
  renderStockTagList() {
    const tagCounts = {};
    this.stockQuizzes.forEach(q => {
      (q.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    const el = document.getElementById('stock-tag-list');
    if (Object.keys(tagCounts).length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) =>
        `<span class="tag-chip ${this.activeTagFilter === tag ? 'active' : ''}" onclick="Host.toggleStockTag('${App.escapeHtml(tag)}')">${App.escapeHtml(tag)}<span class="tag-count">${count}</span></span>`
      ).join('');
  },

  toggleStockTag(tag) {
    this.activeTagFilter = this.activeTagFilter === tag ? null : tag;
    this.renderStockTagList();
    this.renderStockQuizList();
  },

  /* --- タイプチップ共通 --- */
  resetTypeChips(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.type-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === '');
    });
  },

  toggleStockType(chip, type) {
    this._toggleTypeChip('stock-type-chips', 'stockTypeFilters', chip, type);
    this.renderStockQuizList();
  },

  toggleRoomType(chip, type) {
    this._toggleTypeChip('room-type-chips', 'roomTypeFilters', chip, type);
    this.renderRoomQuizSelectList();
  },

  _toggleTypeChip(containerId, filterKey, chip, type) {
    const container = document.getElementById(containerId);
    if (!type) {
      // 「すべて」をクリック → フィルタクリア
      this[filterKey] = [];
      container.querySelectorAll('.type-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.type === '');
      });
      return;
    }

    // 「すべて」を外す
    container.querySelector('.type-chip[data-type=""]').classList.remove('active');

    const idx = this[filterKey].indexOf(type);
    if (idx >= 0) {
      this[filterKey].splice(idx, 1);
      chip.classList.remove('active');
    } else {
      this[filterKey].push(type);
      chip.classList.add('active');
    }

    // 何も選択されていなければ「すべて」をアクティブに
    if (this[filterKey].length === 0) {
      container.querySelector('.type-chip[data-type=""]').classList.add('active');
    }
  },

  /* --- ストック一覧表示 --- */
  filterStockList() {
    this.renderStockQuizList();
  },

  renderStockQuizList() {
    const search = (document.getElementById('stock-search')?.value || '').trim().toLowerCase();

    // 総数表示
    const totalEl = document.getElementById('stock-total-count');
    if (totalEl) totalEl.textContent = this.stockQuizzes.length;

    let filtered = this.stockQuizzes;
    if (this.stockTypeFilters.length > 0) filtered = filtered.filter(q => this.stockTypeFilters.includes(q.type));
    if (this.activeTagFilter) filtered = filtered.filter(q => (q.tags || []).includes(this.activeTagFilter));
    if (search) {
      filtered = filtered.filter(q =>
        q.question.toLowerCase().includes(search) ||
        (q.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }

    const list = document.getElementById('stock-quiz-list');
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-msg">該当する問題がありません</p>';
      return;
    }

    list.innerHTML = filtered.map(q => `
      <div class="quiz-list-item">
        <input type="checkbox" class="stock-checkbox" ${this.checkedQuizIds.includes(q.id) ? 'checked' : ''}
          onchange="Host.toggleCheckQuiz('${q.id}', this.checked)">
        <div class="quiz-info">
          <div class="quiz-text">${App.escapeHtml(q.question)}</div>
          <div class="quiz-meta">${App.quizTypeLabel(q.type)} / ${q.timeLimit}秒 / ${q.points || 1}pt</div>
          ${(q.tags || []).length ? `<div class="quiz-tags">${q.tags.map(t => `<span class="quiz-tag">${App.escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="quiz-list-actions">
          <button class="btn btn-ghost btn-sm" onclick="Host.showQuizForm('${q.id}')">編集</button>
        </div>
      </div>
    `).join('');

    this.updateBulkDeleteBtn();
  },

  toggleCheckQuiz(quizId, checked) {
    if (checked) {
      if (!this.checkedQuizIds.includes(quizId)) this.checkedQuizIds.push(quizId);
    } else {
      this.checkedQuizIds = this.checkedQuizIds.filter(id => id !== quizId);
    }
    this.updateBulkDeleteBtn();
  },

  updateBulkDeleteBtn() {
    const btn = document.getElementById('btn-bulk-delete');
    if (!btn) return;
    if (this.checkedQuizIds.length > 0) {
      btn.style.display = 'inline-flex';
      btn.textContent = `選択を削除 (${this.checkedQuizIds.length})`;
    } else {
      btn.style.display = 'none';
    }
  },

  async bulkDeleteQuizzes() {
    const count = this.checkedQuizIds.length;
    if (count === 0) return;
    if (!confirm(`${count}件の問題を削除しますか？`)) return;

    App.showLoading();
    try {
      const batch = db.batch();
      this.checkedQuizIds.forEach(id => {
        batch.delete(db.collection('quizzes').doc(id));
      });
      await batch.commit();
      if (this.checkedQuizIds.includes(this.editingQuizId)) this.hideQuizForm();
      this.checkedQuizIds = [];
      await this.loadStockQuizzes();
      App.toast(`${count}件の問題を削除しました`);
    } catch (e) {
      console.error(e);
      App.toast('削除に失敗しました');
    }
    App.hideLoading();
  },

  /* ========== 部屋作成モード ========== */

  async initRoomCreate() {
    this.selectedQuizIds = [];
    this.selectedQuizzes = [];
    this.roomTagFilter = null;
    this.roomTypeFilters = [];
    this.quizOrderMode = 'manual';
    const orderSel = document.getElementById('quiz-order-mode');
    if (orderSel) orderSel.value = 'manual';
    this.resetTypeChips('room-type-chips');
    await this.loadStockQuizzes();
    this.renderRoomTagFilterList();
    this.renderRoomQuizSelectList();
    this.renderSelectedQuizList();
  },

  /* --- タグ一覧 (部屋作成) --- */
  renderRoomTagFilterList() {
    const tagCounts = {};
    this.stockQuizzes.forEach(q => {
      (q.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    const el = document.getElementById('room-tag-filter-list');
    if (Object.keys(tagCounts).length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) =>
        `<span class="tag-chip ${this.roomTagFilter === tag ? 'active' : ''}" onclick="Host.toggleRoomTag('${App.escapeHtml(tag)}')">${App.escapeHtml(tag)}<span class="tag-count">${count}</span></span>`
      ).join('');
  },

  toggleRoomTag(tag) {
    this.roomTagFilter = this.roomTagFilter === tag ? null : tag;
    this.renderRoomTagFilterList();
    this.renderRoomQuizSelectList();
  },

  filterRoomQuizList() {
    this.renderRoomQuizSelectList();
  },

  /* --- 選択可能クイズ一覧 --- */
  renderRoomQuizSelectList() {
    let filtered = this.stockQuizzes;
    if (this.roomTypeFilters.length > 0) filtered = filtered.filter(q => this.roomTypeFilters.includes(q.type));
    if (this.roomTagFilter) filtered = filtered.filter(q => (q.tags || []).includes(this.roomTagFilter));

    const list = document.getElementById('room-quiz-select-list');
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-msg">該当するクイズがありません</p>';
      return;
    }

    list.innerHTML = filtered.map(q => {
      const selected = this.selectedQuizIds.includes(q.id);
      return `
        <div class="quiz-select-item ${selected ? 'selected' : ''}" onclick="Host.toggleQuizSelection('${q.id}')">
          <div class="quiz-check">${selected ? '&#10003;' : ''}</div>
          <div class="quiz-info">
            <div class="quiz-text">${App.escapeHtml(q.question)}</div>
            <div class="quiz-meta">${App.quizTypeLabel(q.type)} / ${q.timeLimit}秒 / ${q.points || 1}pt</div>
            ${(q.tags || []).length ? `<div class="quiz-tags">${q.tags.map(t => `<span class="quiz-tag">${App.escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  toggleQuizSelection(quizId) {
    const idx = this.selectedQuizIds.indexOf(quizId);
    if (idx >= 0) {
      this.selectedQuizIds.splice(idx, 1);
      this.selectedQuizzes = this.selectedQuizzes.filter(q => q.id !== quizId);
    } else {
      this.selectedQuizIds.push(quizId);
      const q = this.stockQuizzes.find(x => x.id === quizId);
      if (q) this.selectedQuizzes.push(q);
    }
    this.renderRoomQuizSelectList();
    this.renderSelectedQuizList();
  },

  renderSelectedQuizList() {
    const countEl = document.getElementById('selected-quiz-count');
    const list = document.getElementById('selected-quiz-list');
    const btn = document.getElementById('btn-create-room');
    const isManual = this.quizOrderMode === 'manual';

    countEl.textContent = this.selectedQuizzes.length;
    btn.disabled = this.selectedQuizzes.length === 0;

    if (this.selectedQuizzes.length === 0) {
      list.innerHTML = '<p class="empty-msg">クイズを選択してください</p>';
      return;
    }

    const label = isManual ? (i) => `Q${i + 1}` : () => '?';

    list.innerHTML = this.selectedQuizzes.map((q, i) => `
      <div class="selected-quiz-item">
        ${isManual ? `
        <div class="reorder-actions">
          <button onclick="Host.moveSelectedQuiz(${i}, -1)" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
          <button onclick="Host.moveSelectedQuiz(${i}, 1)" ${i === this.selectedQuizzes.length - 1 ? 'disabled' : ''}>&#9660;</button>
        </div>` : ''}
        <span class="quiz-num">${label(i)}</span>
        <div class="quiz-info">
          <div class="quiz-text">${App.escapeHtml(q.question)}</div>
          <div class="quiz-meta">${App.quizTypeLabel(q.type)} / ${q.timeLimit}秒 / ${q.points || 1}pt</div>
        </div>
        <div class="quiz-list-actions">
          <button class="btn btn-ghost btn-sm" onclick="Host.removeSelectedQuiz('${q.id}')">取消</button>
        </div>
      </div>
    `).join('');
  },

  removeSelectedQuiz(quizId) {
    this.toggleQuizSelection(quizId);
  },

  /* --- 一括選択・解除 --- */
  _getFilteredRoomQuizzes() {
    let filtered = this.stockQuizzes;
    if (this.roomTypeFilters.length > 0) filtered = filtered.filter(q => this.roomTypeFilters.includes(q.type));
    if (this.roomTagFilter) filtered = filtered.filter(q => (q.tags || []).includes(this.roomTagFilter));
    return filtered;
  },

  selectAllFiltered() {
    const filtered = this._getFilteredRoomQuizzes();
    filtered.forEach(q => {
      if (!this.selectedQuizIds.includes(q.id)) {
        this.selectedQuizIds.push(q.id);
        this.selectedQuizzes.push(q);
      }
    });
    this.renderRoomQuizSelectList();
    this.renderSelectedQuizList();
  },

  deselectAllFiltered() {
    const filtered = this._getFilteredRoomQuizzes();
    const idsToRemove = new Set(filtered.map(q => q.id));
    this.selectedQuizIds = this.selectedQuizIds.filter(id => !idsToRemove.has(id));
    this.selectedQuizzes = this.selectedQuizzes.filter(q => !idsToRemove.has(q.id));
    this.renderRoomQuizSelectList();
    this.renderSelectedQuizList();
  },

  /* --- 出題順 --- */
  onOrderModeChange() {
    this.quizOrderMode = document.getElementById('quiz-order-mode').value;
    this.renderSelectedQuizList();
  },

  moveSelectedQuiz(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.selectedQuizzes.length) return;
    [this.selectedQuizzes[idx], this.selectedQuizzes[newIdx]] = [this.selectedQuizzes[newIdx], this.selectedQuizzes[idx]];
    [this.selectedQuizIds[idx], this.selectedQuizIds[newIdx]] = [this.selectedQuizIds[newIdx], this.selectedQuizIds[idx]];
    this.renderSelectedQuizList();
  },

  /* ========== 部屋作成 ========== */

  async createRoom() {
    if (this.selectedQuizzes.length === 0) return;
    if (!App.currentUser) { App.toast('認証中です...しばらくお待ちください'); return; }

    // 選択されたクイズをゲーム用配列にセット（ランダムならシャッフル）
    let ordered = [...this.selectedQuizzes];
    if (this.quizOrderMode === 'random') {
      ordered = App.shuffleArray(ordered);
    }
    this.quizzes = ordered.map(q => ({
      type: q.type,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      timeLimit: q.timeLimit
    }));

    App.showLoading();
    try {
      // 期限切れ部屋のクリーンアップ + アクティブ部屋数チェック
      const activeRooms = await db.collection('rooms')
        .where('status', 'in', ['waiting', 'playing', 'tally', 'reveal'])
        .get();

      const expireMs = this.ROOM_EXPIRE_HOURS * 60 * 60 * 1000;
      const now = Date.now();
      let activeCount = 0;

      for (const roomDoc of activeRooms.docs) {
        const data = roomDoc.data();
        const createdAt = data.createdAt ? data.createdAt.toMillis() : 0;
        if (now - createdAt > expireMs) {
          await roomDoc.ref.update({ status: 'expired' });
        } else {
          activeCount++;
        }
      }

      if (activeCount >= App.MAX_ROOMS) {
        App.toast(`同時に存在できる部屋は${App.MAX_ROOMS}つまでです`);
        App.hideLoading();
        return;
      }

      let code = App.generateRoomCode();
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

    const answeredCount = Object.values(this.participants).filter(p => p.hasAnswered).length;
    const ansCountEl = document.getElementById('host-answer-count');
    if (ansCountEl) ansCountEl.textContent = `回答: ${answeredCount}/${count}`;
  },

  /* ========== ゲーム進行 ========== */

  async startGame() {
    this.currentQuizIndex = 0;
    await this.showQuiz(0);
    App.goTo('host-game');
  },

  async showQuiz(idx) {
    const quiz = this.quizzes[idx];
    this.currentQuizIndex = idx;

    const batch = db.batch();
    Object.keys(this.participants).forEach(pid => {
      batch.update(this.participantsRef.doc(pid), {
        hasAnswered: false,
        currentAnswer: null,
        currentAnswerTimeMs: 0
      });
    });
    await batch.commit();

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

    document.getElementById('host-state-question').style.display = 'block';
    document.getElementById('host-state-tally').style.display = 'none';
    document.getElementById('host-state-reveal').style.display = 'none';

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

      if (this.timerRemaining <= 0) {
        this.timeUp();
      }
    }, 1000);
  },

  async timeUp() {
    clearInterval(this.timerInterval);
    document.getElementById('host-timer').textContent = '0';
    await this.roomRef.update({ status: 'tally' });
    this.showTally();
  },

  async closeAnswering() {
    clearInterval(this.timerInterval);
    document.getElementById('host-timer').textContent = '締切';
    await this.roomRef.update({ status: 'tally' });
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

    const correctMap = {};
    const batch = db.batch();
    Object.entries(this.participants).forEach(([pid, p]) => {
      if (!p.hasAnswered) {
        correctMap[pid] = null;
        return;
      }
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

      correctMap[pid] = correct;
      const quizPoints = quiz.points || 1;
      const newScore = (p.score || 0) + (correct ? quizPoints : 0);
      const newTime = (p.totalTimeMs || 0) + (p.currentAnswerTimeMs || 0);

      batch.update(this.participantsRef.doc(pid), {
        score: newScore,
        totalTimeMs: newTime
      });
    });
    await batch.commit();

    await this.roomRef.update({
      status: 'reveal',
      currentAnswer: answerDisplay
    });

    document.getElementById('host-correct-answer').textContent = answerDisplay;

    const ranking = Object.entries(this.participants)
      .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, time: p.totalTimeMs || 0, isCorrect: correctMap[id] }))
      .sort((a, b) => b.score - a.score || a.time - b.time);

    document.getElementById('host-scoreboard').innerHTML = ranking.map((p, i) => `
      <div class="score-row">
        <span class="score-rank">${i + 1}</span>
        <span class="score-name">${App.escapeHtml(p.name)} ${p.isCorrect === null ? '➖' : p.isCorrect ? '⭕' : '❌'}</span>
        <span class="score-pts">${p.score}pt</span>
      </div>
    `).join('');

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

  async forceEndQuiz() {
    if (!this.roomRef) return;
    if (!confirm('クイズを終了して部屋を解放しますか？')) return;

    App.showLoading();
    try {
      clearInterval(this.timerInterval);
      await this.roomRef.update({ status: 'finished' });

      const pSnap = await this.participantsRef.get();
      const batch = db.batch();
      pSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await this.roomRef.delete();

      this.cleanup();
      App.toast('クイズを終了しました');
      App.goTo('host-menu');
    } catch (e) {
      console.error(e);
      App.toast('終了に失敗しました');
    }
    App.hideLoading();
  },

  async closeRoom() {
    if (!this.roomRef) return;
    if (!confirm('本当にこの部屋を閉じますか？')) return;

    App.showLoading();
    try {
      const pSnap = await this.participantsRef.get();
      const batch = db.batch();
      pSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await this.roomRef.delete();

      this.cleanup();
      App.toast('部屋を閉じました');
      App.goTo('host-menu');
    } catch (e) {
      console.error(e);
      App.toast('部屋の削除に失敗しました');
    }
    App.hideLoading();
  },

  cleanup() {
    clearInterval(this.timerInterval);
    if (this.unsubParticipants) this.unsubParticipants();
    if (this.unsubRoom) this.unsubRoom();
    this.roomRef = null;
    this.roomCode = null;
    this.participantsRef = null;
  }
};
