// One small data API with two implementations:
//  - Firebase (Firestore + Auth) when js/config.js has a firebaseConfig: every phone shares one live campus.
//  - Local test mode otherwise: data lives in localStorage and syncs between tabs of this browser only.
//
// Data layout (Firestore paths; the local mode mirrors it):
//   app/current                              { sid, policy, settings }
//   sessions/{sid}/people/{uid}              { name, year, newcomer, at, clubs: [clubId] }
//   sessions/{sid}/plans/{planId}            { title, ..., host, going: [uid], max (0 = no limit), status, deadlineAt, startsAt, membersOnly, clubId, tags }
//   sessions/{sid}/plans/{planId}/messages/* { from, text, at }
//   sessions/{sid}/clubchats/{clubId}/messages/* { from, text, at }   members-only club channels
// Chat functions take `kind`: 'plans' (a plan's group chat, the default) or 'clubchats' (a club channel).
//   sessions/{sid}/log/*                     { kind, text, at }

import { firebaseConfig } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const newId = () => Math.random().toString(36).slice(2, 12);

// Add ?local=1 to any page URL to use local test mode even when Firebase is configured.
export async function connect({ local = new URLSearchParams(location.search).has('local') } = {}) {
  return firebaseConfig && !local ? firebaseBackend() : localBackend();
}

async function firebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  await new Promise((resolve, reject) => {
    const un = A.onAuthStateChanged(auth, u => {
      if (u) { un(); resolve(); } else A.signInAnonymously(auth).catch(reject);
    });
  });
  // Students are anonymous; the presenter signs in with email/password. The Firestore rules check the exact email,
  // so another email account would see the console but couldn't change anything.
  const isAdmin = () => !!auth.currentUser && !auth.currentUser.isAnonymous;
  const col = (sid, c) => F.collection(db, 'sessions', sid, c);
  const planRef = (sid, id) => F.doc(db, 'sessions', sid, 'plans', id);
  const msgCol = (sid, id, kind = 'plans') => F.collection(db, 'sessions', sid, kind, id, 'messages');
  const deleteAll = async q => { const snap = await F.getDocs(q); await Promise.all(snap.docs.map(d => F.deleteDoc(d.ref))); };
  const list = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const onErr = e => console.error('[tagalong]', e);
  // When a whole class taps Join on the same plan in the same second, transactions collide.
  // Retry those collisions after a short random pause so they spread out.
  const withRetry = async (fn, tries = 5) => {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (e) {
        if (i >= tries - 1 || !['failed-precondition', 'aborted', 'unavailable'].includes(e.code)) throw e;
        await new Promise(r => setTimeout(r, 150 + Math.random() * 600 * (i + 1)));
      }
    }
  };

  return {
    mode: 'firebase',
    get uid() { return auth.currentUser?.uid; },
    isAdmin,
    onAuth: cb => A.onAuthStateChanged(auth, () => cb({ uid: auth.currentUser?.uid, admin: isAdmin() })),
    signInAdmin: (email, pw) => A.signInWithEmailAndPassword(auth, email, pw),
    signOutAdmin: async () => { await A.signOut(auth); await A.signInAnonymously(auth); },

    watchApp: cb => F.onSnapshot(F.doc(db, 'app', 'current'), s => cb(s.exists() ? s.data() : null), onErr),
    setApp: patch => F.setDoc(F.doc(db, 'app', 'current'), patch, { merge: true }),
    watch: (sid, c, cb) => F.onSnapshot(col(sid, c), s => cb(list(s)), onErr),
    watchMessages: (sid, id, cb, kind) => F.onSnapshot(F.query(msgCol(sid, id, kind), F.orderBy('at')), s => cb(list(s)), onErr),

    setDoc: (sid, c, id, data) => F.setDoc(F.doc(db, 'sessions', sid, c, id), data),
    addPlan: async (sid, plan) => (await F.addDoc(col(sid, 'plans'), plan)).id,
    patchPlan: (sid, id, patch) => F.updateDoc(planRef(sid, id), patch),
    leavePlan: (sid, id, uid) => F.updateDoc(planRef(sid, id), { going: F.arrayRemove(uid) }),
    sendMessage: (sid, id, msg, kind) => F.addDoc(msgCol(sid, id, kind), { at: Date.now(), ...msg }),
    // Admin: deletes a chat's messages (used when an event is over).
    deleteMessages: (sid, id, kind) => deleteAll(msgCol(sid, id, kind)),
    addLog: (sid, entry) => F.addDoc(col(sid, 'log'), { ...entry, at: Date.now() }).catch(onErr),

    // Adds uid to the plan; flips it to "ahead" when the third person joins. Returns true if it went ahead.
    joinPlan: (sid, id, uid, aheadText) => withRetry(() => F.runTransaction(db, async tx => {
      const ref = planRef(sid, id);
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error('This plan no longer exists.');
      const p = s.data();
      if (p.going.includes(uid)) return false;
      if (!['open', 'ahead', 'official'].includes(p.status)) throw new Error('This plan isn\'t open any more.');
      if (p.max > 0 && p.going.length + (p.extra || 0) >= p.max) throw new Error('This plan is full.');
      const ahead = p.status === 'open' && p.going.length + 1 >= 3;
      // arrayUnion, not the whole list: if someone else joins at the same moment, this attempt is
      // rejected as a conflict and retried by the SDK, instead of failing the security rules.
      const going = F.arrayUnion(uid);
      tx.update(ref, ahead ? { going, status: 'ahead', aheadAt: Date.now() } : { going });
      if (ahead) tx.set(F.doc(msgCol(sid, id)), { from: 'sys', text: aheadText, at: Date.now() });
      return ahead;
    }, { maxAttempts: 10 })),

    // Admin: deletes every person, plan, chat and log entry in a session. Club channels have no parent
    // document to list, so the caller passes the club ids.
    wipeSession: async (sid, clubIds = []) => {
      const plans = await F.getDocs(col(sid, 'plans'));
      for (const p of plans.docs) await deleteAll(msgCol(sid, p.id));
      for (const c of clubIds) await deleteAll(msgCol(sid, c, 'clubchats'));
      for (const c of ['plans', 'people', 'log']) await deleteAll(col(sid, c));
    }
  };
}

function localBackend() {
  const KEY = 'tagalong-local-v1';
  const empty = () => ({ app: null, s: {} });
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || empty(); } catch { return empty(); } };
  // Each tab is its own "student", so several tabs can play a class.
  // Test helpers (local mode only): ?as=alex pins the student identity, ?admin=1 skips the console sign-in.
  const params = new URLSearchParams(location.search);
  let uid = params.get('as') ? 'u-' + params.get('as') : null;
  if (!uid) { try { uid = sessionStorage.getItem('tl-uid'); } catch { } }
  if (!uid) { uid = 'u' + newId(); try { sessionStorage.setItem('tl-uid', uid); } catch { } }
  let admin = params.get('admin') === '1';
  const watchers = new Set(), authCbs = new Set();
  const notify = () => watchers.forEach(w => w());
  window.addEventListener('storage', e => { if (e.key === KEY) notify(); });
  const mutate = fn => {
    const st = load(); const r = fn(st);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { console.error(e); }
    setTimeout(notify, 0); return r;
  };
  const sess = (st, sid) => st.s[sid] || (st.s[sid] = { people: {}, plans: {}, log: {}, msgs: {} });
  const arr = o => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));
  const chatKey = (id, kind = 'plans') => kind === 'plans' ? id : kind + ':' + id;
  const watchWith = (get, cb) => {
    let last = '';
    const w = () => { const v = get(load()); const j = JSON.stringify(v); if (j !== last) { last = j; cb(v); } };
    watchers.add(w); setTimeout(w, 0);
    return () => watchers.delete(w);
  };
  const authed = () => authCbs.forEach(cb => cb({ uid, admin }));

  return {
    mode: 'local',
    get uid() { return uid; },
    isAdmin: () => admin,
    onAuth: cb => { authCbs.add(cb); setTimeout(() => cb({ uid, admin }), 0); return () => authCbs.delete(cb); },
    signInAdmin: async () => { admin = true; authed(); },
    signOutAdmin: async () => { admin = false; authed(); },

    watchApp: cb => watchWith(st => st.app, cb),
    setApp: async patch => mutate(st => { st.app = { ...(st.app || {}), ...patch }; }),
    watch: (sid, c, cb) => watchWith(st => arr(sess(st, sid)[c]), cb),
    watchMessages: (sid, id, cb, kind) => watchWith(st => arr(sess(st, sid).msgs[chatKey(id, kind)]).sort((a, b) => a.at - b.at), cb),

    setDoc: async (sid, c, id, data) => mutate(st => { sess(st, sid)[c][id] = data; }),
    addPlan: async (sid, plan) => mutate(st => { const id = newId(); sess(st, sid).plans[id] = plan; return id; }),
    patchPlan: async (sid, id, patch) => mutate(st => { const p = sess(st, sid).plans[id]; if (p) Object.assign(p, patch); }),
    leavePlan: async (sid, id, u) => mutate(st => { const p = sess(st, sid).plans[id]; if (p) p.going = p.going.filter(x => x !== u); }),
    sendMessage: async (sid, id, msg, kind) => mutate(st => { const m = sess(st, sid).msgs, k = chatKey(id, kind); (m[k] || (m[k] = {}))[newId()] = { at: Date.now(), ...msg }; }),
    deleteMessages: async (sid, id, kind) => mutate(st => { delete sess(st, sid).msgs[chatKey(id, kind)]; }),
    addLog: async (sid, entry) => mutate(st => { sess(st, sid).log[newId()] = { ...entry, at: Date.now() }; }),

    joinPlan: async (sid, id, u, aheadText) => mutate(st => {
      const S = sess(st, sid), p = S.plans[id];
      if (!p) throw new Error('This plan no longer exists.');
      if (p.going.includes(u)) return false;
      if (!['open', 'ahead', 'official'].includes(p.status)) throw new Error('This plan isn\'t open any more.');
      if (p.max > 0 && p.going.length + (p.extra || 0) >= p.max) throw new Error('This plan is full.');
      p.going.push(u);
      if (p.status === 'open' && p.going.length >= 3) {
        p.status = 'ahead'; p.aheadAt = Date.now();
        (S.msgs[id] || (S.msgs[id] = {}))[newId()] = { from: 'sys', text: aheadText, at: Date.now() };
        return true;
      }
      return false;
    }),
    wipeSession: async sid => mutate(st => { delete st.s[sid]; })
  };
}
