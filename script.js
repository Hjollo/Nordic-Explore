// Firebase-konfigurasjon (erstatt med din egen)
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCu2LKq2WQbzhCtQIMHPqC8GMogKNkT3Zk",
  authDomain: "chat-room-67e5f.firebaseapp.com",
  projectId: "chat-room-67e5f",
  storageBucket: "chat-room-67e5f.firebasestorage.app",
  messagingSenderId: "160429949171",
  appId: "1:160429949171:web:8a0240dd888f4a48d43786"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// HTML-elementer
const messagesDiv = document.getElementById('messages');
const usernameInput = document.getElementById('username');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Send melding
sendBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim() || "Anon";
    const message = messageInput.value.trim();

    if (message) {
        db.collection('messages').add({
            sender: username,
            text: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = '';
    }
});

// Hent meldinger live
db.collection('messages').orderBy('timestamp')
.onSnapshot(snapshot => {
    messagesDiv.innerHTML = '';
    snapshot.forEach(doc => {
        const data = doc.data();
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        msgDiv.textContent = `${data.sender}: ${data.text}`;
        messagesDiv.appendChild(msgDiv);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});
