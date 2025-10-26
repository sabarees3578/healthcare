import React, { useEffect, useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { ref as dbRef, onValue } from 'firebase/database';

export default function CaregiverDashboard({ user }){
  const [patientId, setPatientId] = useState(null);
  const [patient, setPatient] = useState(null);
  const [sos, setSos] = useState(null);

  useEffect(()=>{
    if (!user) return;
    const ref = dbRef(db, `users`);
    const unsub = onValue(ref, snap => {
      const data = snap.val() || {};
      const pid = Object.keys(data).find(k => data[k].caregiver === user.uid);
      setPatientId(pid || null);
      setPatient(pid ? data[pid] : null);
    });
    return () => unsub();
  }, [user]);

  useEffect(()=>{
    const sref = dbRef(db, 'sos_alerts');
    const unsub = onValue(sref, snap => {
      const all = snap.val() || {};
      if (patientId && all[patientId]) setSos({ patientId, ...all[patientId] });
      else setSos(null);
    });
    return () => unsub();
  }, [patientId]);

  return (
    <div className="container">
      <div className="card">
        <h3 style={{marginTop:0}}>Caregiver Dashboard</h3>
        {!patient ? <div className="small">No assigned patient yet.</div> : (
          <div>
            <div><strong>Patient:</strong> {patient.name || patient.email}</div>
            <div style={{marginTop:8}}>
              <strong>Tasks</strong>
              <ul>
                {patient.tasks ? Object.values(patient.tasks).map((t,i)=> <li key={i}>{t.text} {t.completed ? '✅' : ''}</li>) : <li>None</li>}
              </ul>
            </div>
          </div>
        )}
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
  )
}
