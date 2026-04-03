const firebaseConfig = {
  apiKey: "AIzaSyDdXjHJ2k4Ji6E9rC7SqZ26RdCjGO_GPAQ",
  authDomain: "quiz-battle-9a6fa.firebaseapp.com",
  projectId: "quiz-battle-9a6fa",
  storageBucket: "quiz-battle-9a6fa.firebasestorage.app",
  messagingSenderId: "914380722071",
  appId: "1:914380722071:web:081ea174e9a3cdaab3fed2"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
