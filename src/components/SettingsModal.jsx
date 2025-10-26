import React, { useState, useEffect } from 'react';
import { saveSettings as persistSettings } from '../utils/settings';

export default function SettingsModal({ open, onClose, settings = {}, setSettings }) {
  const [local, setLocal] = useState({ ...settings });

  useEffect(() => setLocal({ ...settings }), [settings]);

  function save() {
    setSettings(local);
    persistSettings(local);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="modal">
      <div className="content card">
        <h3 style={{marginTop:0}}>Settings</h3>
        <div style={{display:'grid', gap:10}}>
          <div>
            <label className="small">Theme</label>
            <select value={local.theme || 'dark'} onChange={e => setLocal({...local, theme: e.target.value})}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div>
            <label className="small">Google Maps API Key</label>
            <input value={local.mapsApiKey || ''} onChange={e => setLocal({...local, mapsApiKey: e.target.value})} placeholder="AIza..." />
            <div className="small" style={{marginTop:6}}>Enable Maps/Places/Directions features.</div>
          </div>

          <div>
            <label className="small">Google Calendar OAuth Client ID</label>
            <input value={local.calendarClientId || ''} onChange={e => setLocal({...local, calendarClientId: e.target.value})} placeholder="xxx.apps.googleusercontent.com" />
            <div className="small" style={{marginTop:6}}>Used for calendar events (doctor & patient).</div>
          </div>

          <div>
            <label className="small">Gemini / Generative API Key</label>
            <input value={local.geminiApiKey || ''} onChange={e => setLocal({...local, geminiApiKey: e.target.value})} placeholder="Generative API key" />
            <div className="small" style={{marginTop:6}}>Used by the AI assistant (chat & summaries).</div>
          </div>

          <div>
            <label className="small">Alarm Sound</label>
            <select value={local.alarm || 'beep'} onChange={e => setLocal({...local, alarm: e.target.value})}>
              <option value="beep">Beep</option>
              <option value="chime">Chime</option>
              <option value="bell">Bell</option>
            </select>
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
            <button className="ghost" onClick={onClose}>Close</button>
            <button onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
