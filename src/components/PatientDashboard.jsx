import React, { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { ref as dbRef, onValue, update as dbUpdate, set as dbSet } from 'firebase/database';

function playAlarmSound(kind = 'beep') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = kind === 'chime' ? 'sine' : kind === 'bell' ? 'triangle' : 'square';
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(800, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.start(); o.stop(now + 0.62);
  } catch (e) { /* ignore */ }
}

async function createCalendarEventForPatient(clientId, summary, description, startISO, endISO) {
  if (!clientId) throw new Error('Calendar client ID missing');
  if (!window.gapi || !window.gapi.client) {
    if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.async = true;
      document.head.appendChild(s);
      await new Promise(res => { s.onload = res; s.onerror = res; });
    }
    await new Promise(res => window.gapi.load('client:auth2', res));
    await window.gapi.client.init({ clientId, scope: 'https://www.googleapis.com/auth/calendar.events' });
  }
  const authInstance = window.gapi.auth2.getAuthInstance();
  if (!authInstance.isSignedIn.get()) await authInstance.signIn();
  await window.gapi.client.load('calendar', 'v3');
  const event = { summary, description, start: { dateTime: startISO }, end: { dateTime: endISO } };
  const resp = await window.gapi.client.calendar.events.insert({ calendarId: 'primary', resource: event });
  return resp.result;
}

export default function PatientDashboard({ user, settings }) {
  const [profile, setProfile] = useState({});
  const [tasks, setTasks] = useState({});
  const [appointment, setAppointment] = useState(null);
  const alarmsRef = useRef({});

  useEffect(()=> {
    if (!user) return;
    const uref = dbRef(db, `users/${user.uid}`);
    const unsub = onValue(uref, snap => {
      const val = snap.val() || {};
      setProfile(val);
      setTasks(val.tasks || {});
      setAppointment(val.appointment || null);
    });
    return () => unsub();
  }, [user]);

  useEffect(()=> {
    Object.values(alarmsRef.current).forEach(tid => clearTimeout(tid));
    alarmsRef.current = {};
    Object.entries(tasks).forEach(([id, t]) => {
      const whenISO = t.reminderAt;
      if (!whenISO) return;
      const when = new Date(whenISO).getTime();
      const now = Date.now();
      if (when <= now) return;
      const delay = when - now;
      const tid = setTimeout(async ()=> {
        try {
          if (Notification && Notification.permission === 'granted') {
            new Notification('Health Portal Reminder', { body: t.text || 'Reminder' });
          } else if (Notification && Notification.permission !== 'denied') {
            await Notification.requestPermission();
            if (Notification.permission === 'granted') new Notification('Health Portal Reminder', { body: t.text || 'Reminder' });
          }
        } catch(e){}
        playAlarmSound(settings?.alarm || 'beep');
        try { await dbUpdate(dbRef(db, `users/${user.uid}/tasks/${id}`), { alarmFiredAt: Date.now() }); } catch(e) {}
      }, delay);
      alarmsRef.current[id] = tid;
    });
    return ()=> { Object.values(alarmsRef.current).forEach(tid => clearTimeout(tid)); alarmsRef.current = {}; };
  }, [tasks, settings?.alarm, user?.uid]);

  async function saveProfile() {
    if (!user) return;
    await dbUpdate(dbRef(db, `users/${user.uid}`), { name: profile.name || '', phone: profile.phone || '' });
    alert('Saved');
  }

  async function addTaskToCalendar(taskId, taskObj) {
    try {
      const clientId = settings?.calendarClientId;
      if (!clientId) return alert('Calendar Client ID not set in Settings.');
      if (!taskObj?.reminderAt) return alert('Task has no reminder time.');
      const startISO = new Date(taskObj.reminderAt).toISOString();
      const endISO = new Date(new Date(taskObj.reminderAt).getTime() + 30*60*1000).toISOString();
      await createCalendarEventForPatient(clientId, `Reminder: ${taskObj.text}`, 'From Health Portal', startISO, endISO);
      await dbUpdate(dbRef(db, `users/${user.uid}/tasks/${taskId}`), { calendarEventCreated: true });
      alert('Added to your Google Calendar.');
    } catch (e) { alert('Calendar add failed: ' + (e.message || e)); }
  }

  async function sendSOS() {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      await dbSet(dbRef(db, `sos_alerts/${user.uid}`), { lat, lng, timestamp: Date.now() });
      alert('SOS sent');
    }, err => alert('Location error: ' + (err.message || err.code)));
  }

  // Push subscription save (so server can push even if app closed)
  async function subscribePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return alert('Push not supported in this browser');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: '<YOUR_VAPID_PUBLIC_KEY_BASE64>' });
      await dbSet(dbRef(db, `users/${user.uid}/pushSubscriptions/${btoa(sub.endpoint)}`), sub.toJSON());
      alert('Push subscribed');
    } catch (e) { alert('Push subscribe failed: ' + (e.message || e)); }
  }

  return (
    <div className="container">
      <div style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:12}}>
        <div className="card">
          <h3 style={{marginTop:0}}>Welcome{profile.name ? `, ${profile.name}` : ''}</h3>
          <div className="small">Name</div>
          <input value={profile.name || ''} onChange={e=>setProfile(p=>({...p, name: e.target.value}))} />
          <div className="small">Phone</div>
          <input value={profile.phone || ''} onChange={e=>setProfile(p=>({...p, phone: e.target.value}))} />
          <div className="row" style={{marginTop:8}}>
            <button onClick={saveProfile}>Save</button>
            <button onClick={sendSOS} style={{marginLeft:'auto', background:'var(--danger)'}}>SOS</button>
          </div>

          <hr />
          <h4>Doctor's Plan</h4>
          <div>
            {Object.entries(tasks).length ? Object.entries(tasks).map(([id,t])=>(
              <div key={id} style={{display:'flex', flexDirection:'column', gap:8, marginTop:8, paddingBottom:8, borderBottom:'1px solid rgba(255,255,255,.06)'}}>
                <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
                  <div>{t.text}</div>
                  <input type="checkbox" checked={!!t.completed} onChange={e=>dbUpdate(dbRef(db, `users/${user.uid}/tasks/${id}`), { completed: e.target.checked })} />
                </div>
                {t.reminderAt && <div className="small">Reminder: {new Date(t.reminderAt).toLocaleString()}</div>}
                {t.reminderAt && t.calendarRequested && !t.calendarEventCreated && (
                  <div style={{display:'flex', gap:8}}>
                    <button onClick={()=>addTaskToCalendar(id, t)}>Add to my Google Calendar</button>
                    <div className="small" style={{alignSelf:'center'}}>We'll also alert you in-browser at that time.</div>
                  </div>
                )}
                {t.calendarEventCreated && <div className="small">Added to calendar.</div>}
              </div>
            )) : <div className="small">No tasks yet</div>}
          </div>

          <hr />
          <button className="ghost" onClick={subscribePush}>Enable Push Notifications</button>

          <hr />
          <div><strong>Next appointment:</strong> {appointment ? new Date(appointment).toLocaleString() : 'Not scheduled'}</div>
        </div>

        <div className="card">
          <h3 style={{marginTop:0}}>Map & Nearby Hospitals</h3>
          <div className="small">To enable Google Maps & Places, add your API key in Settings. Then use maps features (search, routing).</div>
          <div style={{marginTop:12}} className="map-placeholder">Map area — enter Maps API key in Settings to enable.</div>
        </div>
      </div>
    </div>
  );
}
