import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './utils/firebaseConfig';
import { ref as dbRef, get as dbGet } from 'firebase/database';

import Header from './components/Header';
import LoginView from './components/LoginView';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import CaregiverDashboard from './components/CaregiverDashboard';
import FloatingChat from './components/FloatingChat';
import SettingsModal from './components/SettingsModal';

import { loadSettings, saveSettings } from './utils/settings';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [settings, setSettings] = useState(loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        try {
          const snap = await dbGet(dbRef(db, `users/${u.uid}/role`));
          setRole(snap.exists() ? snap.val() : null);
        } catch (e) {
          console.warn('Failed to read role', e);
          setRole(null);
        }
      } else setRole(null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : '');
  }, [settings.theme]);

  async function handleLogout() {
    try { await signOut(auth); } catch (e) { console.error('Sign out', e); }
  }

  function handleSaveSettings(s) {
    setSettings(s);
    saveSettings(s);
  }

  return (
    <div>
      <Header user={user} onOpenSettings={() => setSettingsOpen(true)} onLogout={handleLogout} />

      {!user ? (
        <LoginView />
      ) : role === 'patient' ? (
        <PatientDashboard user={user} settings={settings} />
      ) : role === 'doctor' ? (
        <DoctorDashboard user={user} settings={settings} />
      ) : role === 'caregiver' ? (
        <CaregiverDashboard user={user} settings={settings} />
      ) : (
        <div className="container">
          <div className="card">
            <h3 style={{marginTop:0}}>No role set</h3>
            <p className="small">Complete your profile in Firebase or re-register.</p>
          </div>
        </div>
      )}

      <FloatingChat settings={settings} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={handleSaveSettings} />
    </div>
  );
}
