// app.js
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDocs, addDoc, getDoc, setDoc, query, where, orderBy, serverTimestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/* ---------- Helpers for DOM ---------- */
const $ = sel => document.querySelector(sel);
const createEl = (tag, cls='') => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

/* ---------- DOM elements ---------- */
const homeView = $('#home-view');
const authView = $('#auth-view');
const profileView = $('#profile-view');
const addTripView = $('#add-trip-view');

const navLogin = $('#nav-login');
const navLogout = $('#nav-logout');
const navProfile = $('#nav-profile');
const btnAddTrip = $('#btn-add-trip');
const tripsList = $('#trips-list');
const searchInput = $('#search');

const loginForm = $('#login-form');
const registerForm = $('#register-form');
const showRegister = $('#show-register');
const showLogin = $('#show-login');
const authTitle = $('#auth-title');
const authError = $('#auth-error');
const regError = $('#reg-error');

const profileForm = $('#profile-form');
const pfName = $('#pf-name');
const pfEmail = $('#pf-email');
const pfInterests = $('#pf-interests');
const pfPhoto = $('#pf-photo');
const saveProfileBtn = $('#save-profile');
const myFavorites = $('#my-favorites');
const profileMsg = $('#profile-msg');

const addTripForm = $('#add-trip-form');
const addTripMsg = $('#add-trip-msg');

/* ---------- UI helpers ---------- */
function show(view){
  // hide all views
  [homeView, authView, profileView, addTripView].forEach(v=>{
    v.classList.add('hidden');
    v.setAttribute('aria-hidden','true');
  });
  view.classList.remove('hidden');
  view.setAttribute('aria-hidden','false');
}
function showError(el, msg){
  el.textContent = msg;
  setTimeout(()=>{ el.textContent = ''; }, 5000);
}

/* ---------- Auth flow ---------- */

// show/hide register
showRegister.addEventListener('click', ()=> {
  registerForm.classList.remove('hidden'); registerForm.setAttribute('aria-hidden','false');
  loginForm.classList.add('hidden'); loginForm.setAttribute('aria-hidden','true');
  authTitle.textContent = 'Opprett konto';
});
showLogin.addEventListener('click', ()=> {
  registerForm.classList.add('hidden'); registerForm.setAttribute('aria-hidden','true');
  loginForm.classList.remove('hidden'); loginForm.setAttribute('aria-hidden','false');
  authTitle.textContent = 'Logg inn';
});

// register
registerForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const interests = $('#reg-interests').value.split(',').map(s=>s.trim()).filter(Boolean);
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // update profile displayName
    await updateProfile(cred.user, { displayName: name });
    // create user doc in Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName: name,
      email,
      interests,
      createdAt: serverTimestamp()
    });
    registerForm.reset();
    show(homeView);
  }catch(err){
    regError.textContent = err.message;
  }
});

// login
loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  try{
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
    show(homeView);
  }catch(err){
    authError.textContent = err.message;
  }
});

// logout
$('#nav-logout').addEventListener('click', async ()=> {
  await signOut(auth);
});

/* ---------- Navigation ---------- */
$('#nav-home').addEventListener('click', ()=> show(homeView));
navProfile.addEventListener('click', ()=> show(profileView));
btnAddTrip.addEventListener('click', ()=> show(addTripView));
$('#cancel-add').addEventListener('click', ()=> show(homeView));

/* ---------- Load trips from Firestore ---------- */
async function loadTrips(filter='') {
  tripsList.innerHTML = '';
  const q = query(collection(db, 'trips'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  const trips = [];
  snap.forEach(d => trips.push({ id: d.id, ...d.data() }));
  const filtered = trips.filter(t => {
    const term = filter.toLowerCase();
    if (!term) return true;
    return (t.title||'').toLowerCase().includes(term) || (t.tags||[]).join(',').toLowerCase().includes(term);
  });
  if (filtered.length === 0) {
    tripsList.textContent = 'Ingen reiser funnet.';
    return;
  }
  filtered.forEach(renderTripCard);
}

function renderTripCard(trip) {
  const card = createEl('article','trip-card');
  const img = createEl('img');
  img.alt = trip.title || 'Reisebilde';
  img.src = trip.imagePath || 'https://via.placeholder.com/400x200?text=No+image';
  card.appendChild(img);
  const body = createEl('div','trip-body');
  body.innerHTML = `<h3>${trip.title}</h3><p class="muted">${trip.description ? trip.description.substring(0,120) : ''}</p><p><strong>Pris:</strong> ${trip.price} NOK</p>`;
  const actions = createEl('div','trip-actions');
  const favBtn = createEl('button','btn');
  favBtn.textContent = 'Lagre';
  favBtn.addEventListener('click', ()=> toggleFavorite(trip));
  // disable if not authenticated
  if (!auth.currentUser) favBtn.disabled = true;
  actions.appendChild(favBtn);

  body.appendChild(actions);
  card.appendChild(body);
  tripsList.appendChild(card);
}

/* ---------- Favorites (CRUD) ---------- */
async function toggleFavorite(trip){
  if (!auth.currentUser) { alert('Du må være logget inn for å lagre favoritter'); return; }
  const favRef = doc(db, 'users', auth.currentUser.uid, 'favorites', trip.id);
  const existing = await getDoc(favRef);
  if (existing.exists()){
    // delete -> REMOVE favorite
    await deleteDoc(favRef);
    alert('Fjernet fra favoritter');
  } else {
    // add
    await setDoc(favRef, {
      tripId: trip.id,
      title: trip.title,
      addedAt: serverTimestamp()
    });
    alert('Lagt til i favoritter');
  }
  // refresh profile favorites if open
  if (!profileView.classList.contains('hidden')) loadUserFavorites();
}

/* ---------- Profile: load & save ---------- */
onAuthStateChanged(auth, async (user)=>{
  if (user){
    // UI adjustments
    navLogin.classList.add('hidden');
    navLogout.classList.remove('hidden');
    navProfile.classList.remove('hidden');
    btnAddTrip.classList.remove('hidden');
    // fill profile inputs
    pfEmail.value = user.email || '';
    const udoc = await getDoc(doc(db, 'users', user.uid));
    if (udoc.exists()){
      const data = udoc.data();
      pfName.value = data.displayName || user.displayName || '';
      pfInterests.value = (data.interests || []).join(', ');
    } else {
      // create doc if missing
      await setDoc(doc(db,'users',user.uid), {
        displayName: user.displayName || '',
        email: user.email || '',
        interests: [],
        createdAt: serverTimestamp()
      });
      pfName.value = user.displayName || '';
    }
    show(homeView);
    loadTrips();
    loadUserFavorites();
  } else {
    // signed out
    navLogin.classList.remove('hidden');
    navLogout.classList.add('hidden');
    navProfile.classList.add('hidden');
    btnAddTrip.classList.add('hidden');
    show(homeView);
    loadTrips();
    // disable favorite buttons
    setTimeout(()=> {
      document.querySelectorAll('.trip-card button').forEach(b => b.disabled = true);
    }, 200);
  }
});

/* Save profile */
saveProfileBtn.addEventListener('click', async ()=>{
  if (!auth.currentUser) { profileMsg.textContent = 'Du må være logget inn'; return; }
  const name = pfName.value.trim();
  const interests = pfInterests.value.split(',').map(s=>s.trim()).filter(Boolean);
  // handle photo upload if present
  const file = pfPhoto.files[0];
  let photoURL = null;
  if (file){
    const path = `profiles/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
    const r = sRef(storage, path);
    await uploadBytes(r, file);
    photoURL = await getDownloadURL(r);
  }
  // update firebase auth profile (displayName + photo)
  try {
    const updates = {};
    if (name) updates.displayName = name;
    if (photoURL) updates.photoURL = photoURL;
    if (Object.keys(updates).length) await updateProfile(auth.currentUser, updates);
    // update firestore user doc
    await setDoc(doc(db,'users',auth.currentUser.uid), {
      displayName: name,
      interests,
      photoURL: photoURL || null,
      email: auth.currentUser.email
    }, { merge: true });
    profileMsg.textContent = 'Profil oppdatert';
    setTimeout(()=> profileMsg.textContent = '', 4000);
    loadUserFavorites();
  } catch(err){
    profileMsg.textContent = 'Feil ved oppdatering: ' + err.message;
  }
});

/* Load user favorites */
async function loadUserFavorites(){
  myFavorites.innerHTML = '';
  if (!auth.currentUser) { myFavorites.textContent = 'Logg inn for å se favoritter.'; return; }
  const favsSnap = await getDocs(collection(db, 'users', auth.currentUser.uid, 'favorites'));
  if (favsSnap.empty) {
    myFavorites.textContent = 'Ingen favoritter enda.';
    return;
  }
  favsSnap.forEach(docSnap=>{
    const d = docSnap.data();
    const card = createEl('div','trip-card');
    card.innerHTML = `<div style="padding:.5rem"><h4>${d.title}</h4><div class="trip-actions"><button class="btn remove">Fjern</button></div></div>`;
    card.querySelector('.remove').addEventListener('click', async ()=>{
      await deleteDoc(doc(db,'users',auth.currentUser.uid,'favorites', docSnap.id));
      loadUserFavorites();
    });
    myFavorites.appendChild(card);
  });
}

/* ---------- Add trip (create) ---------- */
addTripForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  // For simplicity: any authenticated user may add in this demo.
  if (!auth.currentUser) { addTripMsg.textContent = 'Du må være logget inn for å legge til reise.'; return; }
  const title = $('#trip-title').value.trim();
  const price = Number($('#trip-price').value);
  const tags = $('#trip-tags').value.split(',').map(s=>s.trim()).filter(Boolean);
  const desc = $('#trip-desc').value.trim();
  const file = $('#trip-image').files[0];

  let imagePath = null;
  if (file){
    const path = `trips/${Date.now()}_${file.name}`;
    const r = sRef(storage, path);
    await uploadBytes(r, file);
    imagePath = await getDownloadURL(r);
  }

  const docRef = await addDoc(collection(db, 'trips'), {
    title,
    price,
    tags,
    description: desc,
    imagePath,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid
  });

  addTripMsg.textContent = 'Reise lagt til';
  addTripForm.reset();
  loadTrips();
  setTimeout(()=> { addTripMsg.textContent = ''; show(homeView); }, 1000);
});

/* ---------- Search ---------- */
searchInput.addEventListener('input', (e)=> loadTrips(e.target.value));

/* ---------- Initial load ---------- */
loadTrips();
