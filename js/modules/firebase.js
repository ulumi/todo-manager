// ════════════════════════════════════════════════════════
//  FIREBASE — init app, auth, firestore
// ════════════════════════════════════════════════════════

import { initializeApp }                             from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth }                                   from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, setLogLevel } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyCp3bbr6hMjP7oo7bfUmRNfIA4O6IKbtkQ',
  authDomain:        'huge-todo.firebaseapp.com',
  projectId:         'huge-todo',
  storageBucket:     'huge-todo.firebasestorage.app',
  messagingSenderId: '708112988153',
  appId:             '1:708112988153:web:af75de9f76959816dc2f28',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Offline persistence via IndexedDB — writes queue automatically when offline
// and flush when the connection is restored.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

// Silence Firestore SDK noise (WebChannel transport errors, reconnection logs)
setLogLevel('error');
