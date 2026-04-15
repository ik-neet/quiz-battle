/**
 * Firestoreクイズデータ挿入スクリプト
 *
 * 使い方:
 *   node scripts/seed-quizzes.js --owner <ownerId>
 *
 * ownerIdは主催者のFirebase Authユーザーのuid。
 * 省略した場合は OWNER_ID 定数を使用。
 *
 * 例:
 *   node scripts/seed-quizzes.js --owner tqrIgZPFCoP5j1qlO6xFU5sHW4Q2
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ===================== 設定 =====================
const PROJECT_ID = 'quiz-battle-9a6fa';

// デフォルトownerIdを変更するかコマンドライン引数で指定
const DEFAULT_OWNER_ID = 'tqrIgZPFCoP5j1qlO6xFU5sHW4Q2';

// ===================== クイズデータ =====================
// type: 'choice' | 'sort' | 'text'
// choice: options配列, correctAnswer=インデックス番号(0始まり)
// sort  : options配列(初期順), correctAnswer=正解順の配列
// text  : correctAnswer=文字列
const QUIZZES = [
  // ---- なんでもクイズ（選択問題）----
  {
    type: 'choice',
    question: '日本で最も長い川は？',
    options: ['利根川', '信濃川', '木曽川', '石狩川'],
    correctAnswer: 1,
    timeLimit: 30,
    points: 1,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '世界で最も高い山・エベレストの標高は？',
    options: ['8,611m', '8,848m', '8,091m', '8,516m'],
    correctAnswer: 1,
    timeLimit: 30,
    points: 2,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '人間の体で最も大きい臓器は？',
    options: ['肝臓', '脳', '肺', '皮膚'],
    correctAnswer: 3,
    timeLimit: 25,
    points: 2,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '「モナ・リザ」を描いた画家は？',
    options: ['ミケランジェロ', 'レンブラント', 'レオナルド・ダ・ヴィンチ', 'ラファエロ'],
    correctAnswer: 2,
    timeLimit: 25,
    points: 1,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '光の速さに最も近いのは？',
    options: ['約10万km/秒', '約20万km/秒', '約30万km/秒', '約40万km/秒'],
    correctAnswer: 2,
    timeLimit: 30,
    points: 2,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: 'サッカーワールドカップの開催間隔は？',
    options: ['2年ごと', '3年ごと', '4年ごと', '5年ごと'],
    correctAnswer: 2,
    timeLimit: 20,
    points: 1,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '日本の国鳥は？',
    options: ['タンチョウヅル', 'キジ', 'ウグイス', 'トキ'],
    correctAnswer: 1,
    timeLimit: 25,
    points: 1,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '元素記号「Au」は何の元素？',
    options: ['銀', '銅', '白金', '金'],
    correctAnswer: 3,
    timeLimit: 25,
    points: 2,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '「ハリー・ポッター」シリーズの著者は？',
    options: ['J.R.R.トールキン', 'J.K.ローリング', 'C.S.ルイス', 'ロアルド・ダール'],
    correctAnswer: 1,
    timeLimit: 20,
    points: 1,
    tags: ['なんでもクイズ'],
  },
  {
    type: 'choice',
    question: '地球の表面の約何%が海？',
    options: ['約51%', '約61%', '約71%', '約81%'],
    correctAnswer: 2,
    timeLimit: 25,
    points: 1,
    tags: ['なんでもクイズ'],
  },
];

// ===================== ユーティリティ =====================

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function getAdminToken() {
  const credPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.config', 'configstore', 'firebase-tools.json'
  );

  if (!fs.existsSync(credPath)) {
    throw new Error('firebase-tools の認証情報が見つかりません。`npx firebase login` を先に実行してください。');
  }

  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const refreshToken = creds?.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error('リフレッシュトークンが見つかりません。`npx firebase login` を実行してください。');
  }

  const postData = [
    'grant_type=refresh_token',
    'refresh_token=' + encodeURIComponent(refreshToken),
    'client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    'client_secret=j9iVZfS8kkCEFUPaAeJV0sAi',
  ].join('&');

  const res = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postData,
  });

  if (!res.body.access_token) {
    throw new Error('アクセストークン取得失敗: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string')  return { stringValue: value };
  if (typeof value === 'number')  return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  return { stringValue: String(value) };
}

function quizToFields(q, ownerId) {
  return {
    ownerId:       { stringValue: ownerId },
    type:          { stringValue: q.type },
    question:      { stringValue: q.question },
    options:       { arrayValue: { values: q.options.map(o => ({ stringValue: o })) } },
    correctAnswer: toFirestoreValue(q.correctAnswer),
    timeLimit:     { integerValue: q.timeLimit },
    points:        { integerValue: q.points },
    tags:          { arrayValue: { values: q.tags.map(t => ({ stringValue: t })) } },
    createdAt:     { timestampValue: new Date().toISOString() },
    updatedAt:     { timestampValue: new Date().toISOString() },
  };
}

// ===================== メイン =====================

async function main() {
  // コマンドライン引数からownerIdを取得
  const args = process.argv.slice(2);
  const ownerIdx = args.indexOf('--owner');
  const ownerId = ownerIdx !== -1 ? args[ownerIdx + 1] : DEFAULT_OWNER_ID;

  if (!ownerId) {
    console.error('ownerIdを指定してください: --owner <uid>');
    process.exit(1);
  }

  console.log(`\nFirestore クイズ挿入スクリプト`);
  console.log(`Project : ${PROJECT_ID}`);
  console.log(`OwnerId : ${ownerId}`);
  console.log(`件数    : ${QUIZZES.length}件\n`);

  const token = await getAdminToken();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/quizzes`;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  let ok = 0;
  let ng = 0;

  for (const q of QUIZZES) {
    const body = JSON.stringify({ fields: quizToFields(q, ownerId) });
    const res = await request(baseUrl, { method: 'POST', headers, body });

    if (res.status === 200) {
      console.log(`  ✅ [${q.type}] ${q.question}`);
      ok++;
    } else {
      console.error(`  ❌ [${q.type}] ${q.question}`);
      console.error(`     HTTP ${res.status}:`, JSON.stringify(res.body));
      ng++;
    }
  }

  console.log(`\n完了: 成功 ${ok}件 / 失敗 ${ng}件`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
