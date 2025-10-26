import React, { useEffect, useRef, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { ref as dbRef, onValue, get as dbGet, set as dbSet, push as dbPush } from 'firebase/database';

export default function DoctorDashboard({ user, settings }) {
  const [patients, setPatients] = useState([]);
  const [addEmail, setAddEmail] = useState('');
  const [sos, setSos] = useState(null);
  const patientSetRef = useRef(new Set());
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [reminderAt, setReminderAt] = useState('');

  useEffect(()=>{
    if (!user) return;
    const pref = dbRef(db, `users/${user.uid}/patients`);
    const unsub = onValue(pref, async snap => {
      const val = snap.val() || {};
      const ids = Object.keys(val);
      patientSetRef.current = new Set(ids);
      const list = await Promise.all(ids.map(async id => {
        const s = await dbGet(dbRef(db, `users/${id}`));
        return { id, ...(s.val() || {}) };
      }));
      setPatients(list.filter(Boolean));
    });
    return () => unsub();
  }, [user]);

  useEffect(()=>{
    const sref = dbRef(db, 'sos_alerts');
    const unsub = onValue(sref, snap => {
      const all = snap.val() || {};
      for (const pid of Object.keys(all)) {
        if (patientSetRef.current.has(pid)) { setSos({ patientId: pid, ...all[pid] }); return; }
      }
      setSos(null);
    });
    return () => unsub();
  }, []);

  async function addPatient() {
    if (!addEmail) return alert('Enter email');
    const q = dbRef(db, 'users');
    const snap = await dbGet(q);
    const users = snap.val() || {};
    const pid = Object.keys(users).find(k => users[k].email === addEmail);
    if (!pid) return alert('Patient not found');
    await dbSet(dbRef(db, `users/${user.uid}/patients/${pid}`), true);
    await dbSet(dbRef(db, `users/${pid}/doctor`), user.uid);
    setAddEmail('');
    alert('Patient added');
  }

  async function ensureGapi(clientId) {
    if (!clientId) throw new Error('Calendar Client ID not set in Settings');
    if (window.gapi && window.gapi.client) return window.gapi;
    if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.async = true;
      document.head.appendChild(s);
      await new Promise(res => { s.onload = res; s.onerror = res; });
    }
    await new Promise(res => window.gapi.load('client:auth2', res));
    await window.gapi.client.init({ clientId, scope: 'https://www.googleapis.com/auth/calendar.events' });
    return window.gapi;
  }

  async function createCalendarEventWithGapi({ clientId, summary, description, startISO, endISO }) {
    const gapi = await ensureGapi(clientId);
    const authInstance = window.gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) await authInstance.signIn();
    await window.gapi.client.load('calendar', 'v3');
    const event = { summary, description, start: { dateTime: startISO }, end: { dateTime: endISO } };
    const resp = await window.gapi.client.calendar.events.insert({ calendarId: 'primary', resource: event });
    return resp.result;
  }

  async function assignTaskToPatient(pid) {
    if (!pid) return alert('Select a patient');
    if (!taskText) return alert('Enter task text');
    const task = { text: taskText, createdBy: user.uid, createdAt: Date.now(), completed: false };
    if (reminderAt) {
      const when = new Date(reminderAt);
      task.reminderAt = when.toISOString();
      task.calendarRequested = true;
    }
    const newRef = await dbPush(dbRef(db, `users/${pid}/tasks`), task);
    if (settings?.calendarClientId && reminderAt) {
      try {
        const startISO = new Date(reminderAt).toISOString();
        const endISO = new Date(new Date(reminderAt).getTime() + 30*60*1000).toISOString();
        await createCalendarEventWithGapi({ clientId: settings.calendarClientId, summary: `Task for patient ${pid}: ${taskText}`, description: 'Assigned via Health Portal', startISO, endISO });
        await dbSet(dbRef(db, `users/${pid}/tasks/${newRef.key}/calendarCreatedByDoctor`), true);
      } catch (e) {}
    }
    setTaskText(''); setReminderAt(''); alert('Task assigned to patient.');
  }

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>Doctor Dashboard</h3>
        <div className="row">
          <input placeholder="patient@example.com" value={addEmail} onChange={e=>setAddEmail(e.target.value)} />
          <button onClick={addPatient}>Add Patient</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:12, marginTop:12}}>
        <div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12}}>
            {patients.map(p => (
              <div key={p.id} className="card">
                <h4 style={{marginTop:0}}>{p.name || p.email || 'Unnamed'}</h4>
                <div className="small">{p.medicalCondition || 'No condition listed'}</div>
                <div style={{marginTop:8}}>
                  <button onClick={()=> setSelectedPatient(p)}>Manage</button>
                </div>
              </div>
            ))}
            {!patients.length && <div className="card">No patients yet</div>}
          </div>
        </div>

        <div className="card">
          <h4 style={{marginTop:0}}>Assign Task</h4>
          <label className="small">Select patient</label>
          <select value={selectedPatient?.id || ''} onChange={e => setSelectedPatient(patients.find(x => x.id === e.target.value) || null)}>
            <option value="">-- select --</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </select>

          <label className="small" style={{marginTop:8}}>Task</label>
          <input value={taskText} onChange={e=>setTaskText(e.target.value)} placeholder="Take medicine at 08:00" />

          <label className="small" style={{marginTop:8}}>Reminder (optional)</label>
          <input type="datetime-local" value={reminderAt} onChange={e=>setReminderAt(e.target.value)} />

          <div className="row" style={{marginTop:10}}>
            <button onClick={()=>assignTaskToPatient(selectedPatient?.id)}>Assign Task</button>
          </div>

          <div style={{marginTop:12}} className="small">
            If a reminder time is set, patient sees an alarm and can add it to their Google Calendar.
          </div>
        </div>
      </div>

      {sos && (
        <div className="modal">
          <div className="content card">
            <h2 style={{color:'var(--danger)', marginTop:0}}>SOS Alert</h2>
            <p>Patient ID: {sos.patientId}</p>
            <p>Location: {sos.lat}, {sos.lng}</p>
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${sos.lat},${sos.lng}`}>Open in Google Maps</a>
            <div style={{display:'flex', justifyContent:'flex-end', marginTop:12}}>
              <button className="ghost" onClick={()=>setSos(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
