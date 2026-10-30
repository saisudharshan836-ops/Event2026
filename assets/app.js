import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Firebase project configuration supplied for EventRegister.
const firebaseConfig = {
  apiKey: "AIzaSyBXS3fMRXm9GlpdT6zAlOe-Lvo_Y-HJfy8",
  authDomain: "eventorganiser-2b09b.firebaseapp.com",
  projectId: "eventorganiser-2b09b",
  storageBucket: "eventorganiser-2b09b.firebasestorage.app",
  messagingSenderId: "533033961289",
  appId: "1:533033961289:web:27a7f7b3728845b1f8fc98",
  measurementId: "G-RC72VK3MVK"
};
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
const authView=$('authView'), appView=$('appView');
let currentUser=null, profile=null, events=[], registrations=[], students=[], selectedCategory='All', selectedGame='Cricket';
// Prevent the auth-state listener from racing profile creation during sign-up.
let signupInProgress = false;
let eventModal, editorModal, toast;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : 'Date to be announced';
const timeText = t => { if(!t)return 'Time to be announced'; const [h,m]=t.split(':'); const x=new Date();x.setHours(+h,+m);return x.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); };
function notify(msg){$('toastMessage').textContent=msg;toast.show();}
function setAuthMode(mode){
 const login=mode==='login'; $('loginForm').classList.toggle('d-none',!login);$('signupForm').classList.toggle('d-none',login);
 $('showLogin').classList.toggle('active',login);$('showSignup').classList.toggle('active',!login);
 $('authTitle').textContent=login?'Sign in':'Create account';$('authSubtitle').textContent=login?'Pick up where the excitement begins.':'Your campus experience starts with one account.';
 $('loginError').textContent='';$('signupError').textContent='';
}
$('showLogin').onclick=()=>setAuthMode('login');$('showSignup').onclick=()=>setAuthMode('signup');
document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const i=$(b.dataset.toggle);i.type=i.type==='password'?'text':'password';b.innerHTML=`<i class="fa-regular ${i.type==='password'?'fa-eye':'fa-eye-slash'}"></i>`;});
function passwordChecks(p){return {length:p.length>=8,upper:/[A-Z]/.test(p),lower:/[a-z]/.test(p),number:/\d/.test(p),special:/[^A-Za-z0-9]/.test(p)}}
$('signupPassword').addEventListener('input',()=>{
 const p=$('signupPassword').value,c=passwordChecks(p),n=Object.values(c).filter(Boolean).length;
 ['length','upper','lower','number','special'].forEach(k=>{const el=$('rule'+k[0].toUpperCase()+k.slice(1));el.classList.toggle('valid',c[k]);el.querySelector('i').className=c[k]?'fa-solid fa-circle-check':'fa-regular fa-circle';});
 $('strengthBar').style.width=(n/5*100)+'%';$('strengthBar').style.background=n<=2?'#ff738d':n<=4?'#ffc46b':'#55dfae';
 $('strengthText').textContent=['Very weak','Weak','Fair','Good','Strong','Excellent'][n];$('strengthCount').textContent=n+'/5';
});
$('signupForm').addEventListener('submit',async e=>{
 e.preventDefault();const err=$('signupError');err.textContent='';
 const name=$('signupName').value.trim(),username=$('signupUsername').value.trim().toLowerCase(),email=$('signupEmail').value.trim().toLowerCase(),pass=$('signupPassword').value,confirm=$('confirmPassword').value;
 if(name.length<2){err.textContent='Please enter your full name.';return;}
 if(!/^[a-z0-9._]{3,20}$/.test(username)){err.textContent='Username must be 3–20 characters and use only letters, numbers, dots or underscores.';return;}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Enter a valid email address.';return;}
 const checks=passwordChecks(pass);if(!Object.values(checks).every(Boolean)){err.textContent='Password must contain 8+ characters, uppercase, lowercase, a number and a special character.';return;}
 if(pass!==confirm){err.textContent='Passwords do not match.';return;}
 const btn=e.submitter;btn.disabled=true;btn.innerHTML='<span>Creating account...</span><i class="fa-solid fa-spinner fa-spin"></i>';
 let credential=null; signupInProgress=true;
 try{
   const usernameRef=doc(db,'usernames',username);
   const existing=await getDoc(usernameRef);if(existing.exists()){err.textContent='Username already exists. Please choose another.';return;}
   credential=await createUserWithEmailAndPassword(auth,email,pass);
   await updateProfile(credential.user,{displayName:name});
   // Reserve username and create a student profile. Security rules prevent self-assigned admin roles.
   await runTransaction(db,async tx=>{
     const taken=await tx.get(usernameRef);if(taken.exists())throw new Error('USERNAME_TAKEN');
     tx.set(usernameRef,{uid:credential.user.uid,createdAt:serverTimestamp()});
     tx.set(doc(db,'users',credential.user.uid),{uid:credential.user.uid,name,username,email,role:'student',createdAt:serverTimestamp(),lastLoginAt:serverTimestamp()});
   });
   signupInProgress=false;
   // Process the signed-in user only after the Firestore profile exists.
   await handleAuthenticatedUser(credential.user);
   notify('Account created successfully. Welcome to EventRegister!');
 }catch(ex){
   signupInProgress=false;
   if(ex.message==='USERNAME_TAKEN')err.textContent='Username already exists. Please choose another.';
   else if(ex.code==='auth/email-already-in-use')err.textContent='Email already exists. Please sign in or use another email.';
   else if(ex.code==='auth/invalid-email')err.textContent='Please enter a valid email address.';
   else if(ex.code==='auth/unauthorized-domain')err.textContent='This website domain is not authorized in Firebase. Add localhost or your deployed domain in Authentication → Settings → Authorized domains.';
   else if(ex.code==='auth/network-request-failed')err.textContent='Network error. Check your internet connection and try again.';
   else if(ex.code==='permission-denied' || ex.code==='firestore/permission-denied')err.textContent='Firestore permission denied. Publish the provided firestore.rules in your Firebase project.';
   else if(ex.code==='unavailable')err.textContent='Firestore is temporarily unavailable. Check your connection and try again.';
   else if(ex.code==='failed-precondition')err.textContent='Firestore is not fully configured. Check that Cloud Firestore has been created.';
   else {console.error('EventRegister signup failure:',ex);err.textContent=`Account setup failed (${ex.code||'unknown'}). Open the browser console for details.`;}
   // If account creation succeeded but profile setup failed, remove the half-created auth user.
   if(credential){try{await credential.user.delete();}catch(_){}}
 }finally{btn.disabled=false;btn.innerHTML='<span>Create student account</span><i class="fa-solid fa-arrow-right"></i>';}
});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';const email=$('loginEmail').value.trim(),pass=$('loginPassword').value;if(!email||!pass){$('loginError').textContent='Enter your email and password.';return;}try{await signInWithEmailAndPassword(auth,email,pass);}catch(ex){$('loginError').textContent=ex.code==='auth/invalid-credential'?'Incorrect email or password.':ex.code==='auth/too-many-requests'?'Too many attempts. Please try again later.':'Unable to sign in. Check your details.';}});
$('forgotPassword').onclick=async()=>{const email=$('loginEmail').value.trim();if(!email){$('loginError').textContent='Enter your email address first.';return;}try{await sendPasswordResetEmail(auth,email);notify('Password reset email sent. Check your inbox.');}catch(e){$('loginError').textContent='Could not send reset email. Check the address.';}};

async function handleAuthenticatedUser(user){
 if(!user){currentUser=null;profile=null;appView.classList.add('d-none');authView.classList.remove('d-none');return;}
 try{
   const snap=await getDoc(doc(db,'users',user.uid));
   if(!snap.exists()){await signOut(auth);$('loginError').textContent='Your account profile is missing. Contact the administrator.';return;}
   currentUser=user;profile=snap.data();
   await updateDoc(doc(db,'users',user.uid),{lastLoginAt:serverTimestamp()});
   authView.classList.add('d-none');appView.classList.remove('d-none');
   $('navUserName').textContent=profile.name||user.email;$('navRole').textContent=(profile.role||'student').toUpperCase();
   const isAdmin=profile.role==='admin';
   document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('d-none',!isAdmin));
   document.querySelectorAll('.student-only').forEach(x=>x.classList.toggle('d-none',isAdmin));
   $('todayDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
   showPage('eventsPage');await loadEvents();
 }catch(e){console.error('Profile load failure:',e);notify(`Could not load your profile (${e.code||'unknown'}). Check Firestore rules.`);}
}
onAuthStateChanged(auth,user=>{
 // createUserWithEmailAndPassword signs in immediately; wait until signup writes its profile.
 if(signupInProgress)return;
 handleAuthenticatedUser(user);
});
$('logoutBtn').onclick=()=>signOut(auth);
function showPage(id){
 document.querySelectorAll('.page-section').forEach(p=>p.classList.add('d-none'));$(id).classList.remove('d-none');
 document.querySelectorAll('.side-link').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
 if(id==='myEventsPage')loadMyRegistrations();if(id==='adminPage')loadAdmin();if(id==='manageEventsPage')renderAdminEvents();if(id==='studentsPage')loadStudents();
}
document.querySelectorAll('.side-link').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
eventModal=new bootstrap.Modal($('eventModal'));editorModal=new bootstrap.Modal($('eventEditorModal'));toast=new bootstrap.Toast($('appToast'),{delay:3200});
async function loadEvents(){
 try{const s=await getDocs(query(collection(db,'events'),orderBy('date','asc')));events=s.docs.map(d=>({id:d.id,...d.data()}));renderEvents();}
 catch(e){console.error(e);$('eventList').innerHTML='';$('eventCount').textContent='';$('emptyEvents').classList.remove('d-none');notify('Unable to load events. Verify Firestore is enabled and rules are published.');}
}
function eventCard(ev,admin=false){
 const category=esc(ev.category||'Event'),title=esc(ev.title||'Untitled event');
 return `<article class="event-card"><div class="event-top"><span class="event-tag">${category}${ev.game?' · '+esc(ev.game):''}</span><i class="fa-regular fa-bookmark" style="color:#8290ae"></i></div><h4>${title}</h4><p class="event-desc">${esc(ev.description||'Be part of this campus experience.')}</p><div class="event-meta"><span><i class="fa-regular fa-calendar"></i>${dateText(ev.date)}</span><span><i class="fa-regular fa-clock"></i>${timeText(ev.time)}</span><span><i class="fa-solid fa-location-dot"></i>${esc(ev.venue||'Venue to be announced')}</span></div><div class="event-actions">${admin?`<button class="btn-outline-custom" data-edit="${ev.id}">Edit</button><button class="btn-small" data-delete="${ev.id}">Delete</button>`:`<button class="btn-outline-custom" data-details="${ev.id}">Details</button><button class="btn-small" data-register="${ev.id}">I'm interested</button>`}</div></article>`;
}
function renderEvents(){
 const q=$('eventSearch').value.trim().toLowerCase();
 let list=events.filter(e=>(selectedCategory==='All'||e.category===selectedCategory)&&(`${e.title} ${e.description} ${e.game||''}`).toLowerCase().includes(q));
 $('eventList').innerHTML=list.filter(e=>!(e.category==='Sports'&&e.game)).map(e=>eventCard(e)).join('');
 $('eventCount').textContent=`${list.length} event${list.length===1?'':'s'}`;
 $('emptyEvents').classList.toggle('d-none',list.length>0);
 renderSports();
}
function renderSports(){
 const q=$('eventSearch').value.trim().toLowerCase();
 const list=events.filter(e=>e.category==='Sports'&&e.game===selectedGame&&(`${e.title} ${e.description}`).toLowerCase().includes(q));
 $('sportsEvents').innerHTML=list.length?list.map(e=>eventCard(e)).join(''):'<div class="empty-state" style="grid-column:1/-1;padding:25px"><p>No '+esc(selectedGame)+' events yet.</p></div>';
}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{
 selectedCategory=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('selected',x===b));
 if(selectedCategory==='Sports'){$('sportsPanel').classList.remove('d-none');$('listingTitle').textContent='Other sports & campus events';}
 else{$('sportsPanel').classList.add('d-none');$('listingTitle').textContent=selectedCategory+' events';}
 renderEvents();$('eventList').scrollIntoView({behavior:'smooth',block:'nearest'});
});
document.querySelectorAll('.game-tab').forEach(b=>b.onclick=()=>{selectedGame=b.dataset.game;document.querySelectorAll('.game-tab').forEach(x=>x.classList.toggle('active',x===b));renderSports();});
$('closeSports').onclick=()=>$('sportsPanel').classList.add('d-none');
$('eventSearch').oninput=renderEvents;
document.addEventListener('click',async e=>{
 const details=e.target.closest('[data-details]'),reg=e.target.closest('[data-register]'),edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');
 if(details)openEvent(details.dataset.details);
 if(reg)confirmRegistration(reg.dataset.register);
 if(edit)openEditor(edit.dataset.edit);
 if(del)deleteEvent(del.dataset.delete);
});
function openEvent(id){
 const ev=events.find(x=>x.id===id);if(!ev)return;
 $('eventModalTitle').textContent=ev.title;
 $('eventModalBody').innerHTML=`<span class="event-tag">${esc(ev.category)}${ev.game?' · '+esc(ev.game):''}</span><p class="detail-description mt-3">${esc(ev.description||'No description provided.')}</p><div class="confirm-box"><p><i class="fa-regular fa-calendar me-2"></i>${dateText(ev.date)} at ${timeText(ev.time)}</p><p><i class="fa-solid fa-location-dot me-2"></i>${esc(ev.venue)}${ev.address?' — '+esc(ev.address):''}</p><p class="mb-0"><i class="fa-solid fa-chair me-2"></i>${Number(ev.seats||0)} seats available</p></div><button class="btn-primary-custom w-100" id="modalRegister">I'm interested <i class="fa-solid fa-arrow-right"></i></button>`;
 $('modalRegister').onclick=()=>{eventModal.hide();confirmRegistration(id);};eventModal.show();
}
async function confirmRegistration(id){
 const ev=events.find(x=>x.id===id);if(!ev)return;
 let already=registrations.some(r=>r.eventId===id);
 if(!already){
   try {
     const prior=await getDocs(query(collection(db,'registrations'),where('studentId','==',currentUser.uid),where('eventId','==',id),limit(1)));
     already=!prior.empty;
   } catch(checkError) { console.error(checkError); notify('Could not verify your existing registrations. Please try again.'); return; }
 }
 if(already){notify('You have already registered for this event.');return;}
 if(!confirm(`Confirm your interest in "${ev.title}"?\n\n${dateText(ev.date)} · ${timeText(ev.time)}\n${ev.venue||'Venue to be announced'}`))return;
 try{await addDoc(collection(db,'registrations'),{eventId:id,eventTitle:ev.title,studentId:currentUser.uid,studentName:profile.name,email:profile.email,status:'confirmed',createdAt:serverTimestamp()});registrations.push({eventId:id,eventTitle:ev.title,studentId:currentUser.uid,status:'confirmed'});notify('Registration confirmed! Event details are in My registrations.');}
 catch(e){console.error(e);notify('Registration failed. Please try again.');}
}
async function loadMyRegistrations(){
 try{const s=await getDocs(query(collection(db,'registrations'),where('studentId','==',currentUser.uid)));registrations=s.docs.map(d=>({id:d.id,...d.data()}));const cards=registrations.map(r=>{const ev=events.find(e=>e.id===r.eventId)||r;return eventCard({...ev,title:r.eventTitle||ev.title});});$('myRegistrations').innerHTML=cards.join('')||'<div class="empty-state" style="grid-column:1/-1"><i class="fa-regular fa-calendar"></i><h4>No registrations yet</h4><p>Explore events and confirm your interest.</p></div>';}
 catch(e){console.error(e);notify('Could not load your registrations.');}
}
function renderAdminEvents(){$('adminEventList').innerHTML=events.map(e=>eventCard(e,true)).join('')||'<div class="empty-state" style="grid-column:1/-1">No events created yet. Add your first event.</div>';}
$('newEventBtn').onclick=()=>openEditor();
function openEditor(id){
 $('eventEditorForm').reset();$('editEventId').value='';$('editorError').textContent='';$('editorTitle').textContent=id?'Edit event':'Create an event';$('evSeats').value=100;
 if(id){const e=events.find(x=>x.id===id);if(!e)return;$('editEventId').value=id;$('evTitle').value=e.title||'';$('evCategory').value=e.category||'Sports';$('evGame').value=e.game||'';$('evSeats').value=e.seats||100;$('evDate').value=e.date||'';$('evTime').value=e.time||'';$('evVenue').value=e.venue||'';$('evAddress').value=e.address||'';$('evDescription').value=e.description||'';}
 editorModal.show();
}
$('eventEditorForm').onsubmit=async e=>{
 e.preventDefault();$('editorError').textContent='';
 const data={title:$('evTitle').value.trim(),category:$('evCategory').value,game:$('evCategory').value==='Sports'?$('evGame').value:'',seats:Number($('evSeats').value),date:$('evDate').value,time:$('evTime').value,venue:$('evVenue').value.trim(),address:$('evAddress').value.trim(),description:$('evDescription').value.trim(),updatedAt:serverTimestamp(),createdBy:currentUser.uid};
 if(!data.title||!data.date||!data.time||!data.venue||data.seats<1){$('editorError').textContent='Please complete all required fields with valid values.';return;}
 try{const id=$('editEventId').value;if(id)await updateDoc(doc(db,'events',id),data);else{data.createdAt=serverTimestamp();await addDoc(collection(db,'events'),data);}editorModal.hide();await loadEvents();renderAdminEvents();notify(id?'Event updated.':'Event created successfully.');}
 catch(ex){console.error(ex);$('editorError').textContent='Could not save event. Make sure your account has admin permissions.';}
};
async function deleteEvent(id){const ev=events.find(x=>x.id===id);if(!ev||!confirm(`Delete "${ev.title}"? Existing registration records will remain for audit purposes.`))return;try{await deleteDoc(doc(db,'events',id));await loadEvents();renderAdminEvents();notify('Event deleted.');}catch(e){notify('Could not delete event. Check admin permissions.');}}
async function loadAdmin(){
 try{const [us,rs]=await Promise.all([getDocs(query(collection(db,'users'),where('role','==','student'))),getDocs(collection(db,'registrations'))]);students=us.docs.map(d=>d.data());$('statStudents').textContent=students.length;$('statEvents').textContent=events.length;$('statRegs').textContent=rs.size;$('statLogins').textContent=students.filter(s=>s.lastLoginAt).length;
 const recent=[...students].sort((a,b)=>(b.lastLoginAt?.seconds||0)-(a.lastLoginAt?.seconds||0)).slice(0,8);$('recentStudents').innerHTML=recent.map(s=>`<tr><td class="student-cell">${esc(s.name)}<small>${esc(s.uid||'')}</small></td><td>${esc(s.email)}</td><td>@${esc(s.username)}</td><td>${s.lastLoginAt?new Date(s.lastLoginAt.seconds*1000).toLocaleString():'Never'}</td></tr>`).join('')||'<tr><td colspan="4">No student accounts yet.</td></tr>';
 }catch(e){console.error(e);notify('Admin overview could not load. Check Firestore rules and indexes.');}
}
$('refreshAdmin').onclick=loadAdmin;
async function loadStudents(){
 try{const s=await getDocs(query(collection(db,'users'),where('role','==','student')));students=s.docs.map(d=>d.data());renderStudents();}
 catch(e){console.error(e);notify('Could not load students. Check admin permissions.');}
}
function renderStudents(){const q=($('studentSearch').value||'').toLowerCase();$('allStudents').innerHTML=students.filter(s=>`${s.name} ${s.email} ${s.username}`.toLowerCase().includes(q)).map(s=>`<tr><td class="student-cell">${esc(s.name)}</td><td>${esc(s.email)}</td><td>@${esc(s.username)}</td><td>${s.lastLoginAt?new Date(s.lastLoginAt.seconds*1000).toLocaleString():'Never'}</td><td><span class="badge-online">STUDENT</span></td></tr>`).join('')||'<tr><td colspan="5">No matching students.</td></tr>';}
$('studentSearch').oninput=renderStudents;

// Keep the currently selected sports tab populated after event updates.
