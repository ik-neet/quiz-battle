const https = require('https');
const http = require('http');

const API_KEY = 'AIzaSyDdXjHJ2k4Ji6E9rC7SqZ26RdCjGO_GPAQ';
const PROJECT_ID = 'quiz-battle-9a6fa';

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: opts.method || 'GET', headers: opts.headers || {} }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function main() {
  // 1. Anonymous sign-in
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  );
  const idToken = authRes.body.idToken;
  const uid = authRes.body.localId;
  console.log('Authenticated as:', uid);

  const quizzes = [
    // 選択問題 x3
    { type:'choice', question:'日本で一番高い山は？', options:['富士山','北岳','奥穂高岳','間ノ岳'], correctAnswer:0, timeLimit:30, points:1, tags:['サンプル'] },
    { type:'choice', question:'水の化学式は？', options:['CO2','H2O','NaCl','O2'], correctAnswer:1, timeLimit:20, points:1, tags:['サンプル'] },
    { type:'choice', question:'地球から最も近い恒星は？', options:['シリウス','プロキシマ・ケンタウリ','太陽','ベテルギウス'], correctAnswer:2, timeLimit:30, points:2, tags:['サンプル'] },
    // 並び替え x3
    { type:'sort', question:'次の惑星を太陽に近い順に並べてください', options:['火星','金星','地球','水星'], correctAnswer:['水星','金星','地球','火星'], timeLimit:45, points:2, tags:['サンプル'] },
    { type:'sort', question:'次の数字を小さい順に並べてください', options:['100','1','1000','10'], correctAnswer:['1','10','100','1000'], timeLimit:30, points:1, tags:['サンプル'] },
    { type:'sort', question:'日本の歴代元号を古い順に並べてください', options:['令和','平成','昭和','大正'], correctAnswer:['大正','昭和','平成','令和'], timeLimit:45, points:2, tags:['サンプル'] },
    // 記述 x3
    { type:'text', question:'1+1=？', correctAnswer:'2', timeLimit:15, points:1, tags:['サンプル'] },
    { type:'text', question:'日本の首都は？', correctAnswer:'東京', timeLimit:20, points:1, tags:['サンプル'] },
    { type:'text', question:'「吾輩は猫である」の著者は？', correctAnswer:'夏目漱石', timeLimit:30, points:3, tags:['サンプル'] },
  ];

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/quizzes`;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` };

  for (const q of quizzes) {
    const fields = {
      ownerId: { stringValue: uid },
      type: { stringValue: q.type },
      question: { stringValue: q.question },
      timeLimit: { integerValue: q.timeLimit },
      points: { integerValue: q.points },
      tags: { arrayValue: { values: q.tags.map(t => ({ stringValue: t })) } },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
    };

    if (q.type === 'choice') {
      fields.options = { arrayValue: { values: q.options.map(o => ({ stringValue: o })) } };
      fields.correctAnswer = { integerValue: q.correctAnswer };
    } else if (q.type === 'sort') {
      fields.options = { arrayValue: { values: q.options.map(o => ({ stringValue: o })) } };
      fields.correctAnswer = { arrayValue: { values: q.correctAnswer.map(o => ({ stringValue: o })) } };
    } else {
      fields.options = { arrayValue: { values: [] } };
      fields.correctAnswer = { stringValue: q.correctAnswer };
    }

    const res = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ fields }) });
    if (res.status === 200) {
      console.log('Created:', q.type, '-', q.question);
    } else {
      console.error('Error:', res.status, JSON.stringify(res.body));
    }
  }
  console.log('Done! 9 quizzes created.');
}

main().catch(console.error);
