import React, { useState } from 'react';

export default function FloatingChat({ settings }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);

  async function callGeminiLocal(system, prompt) {
    const apiKey = settings?.geminiApiKey;
    if (!apiKey) throw new Error('Gemini API key not configured in Settings.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-mini:generateContent?key=${apiKey}`;
    const body = { prompt: { text: `${system}\n\nUser: ${prompt}` } };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini error: ' + (await res.text()));
    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return out || JSON.stringify(data).slice(0, 500);
  }

  async function send() {
    if (!text.trim()) return;
    setLog(l => [...l, { me: true, text }]);
    setBusy(true);
    try {
      const reply = await callGeminiLocal('You are a friendly and helpful AI health assistant.', text);
      setLog(l => [...l, { me: false, text: reply }]);
    } catch (e) {
      setLog(l => [...l, { me: false, text: 'Error: ' + e.message }]);
    } finally {
      setBusy(false);
      setText('');
    }
  }

  return (
    <>
      {open && (
        <div style={{position:'fixed', right:18, bottom:86, width:360, maxHeight:'60vh', display:'flex', flexDirection:'column', background:'var(--panel)', borderRadius:12, padding:8, boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
          <div style={{overflow:'auto', flex:1, padding:8}}>
            {log.map((m,i)=>(<div key={i} style={{marginBottom:8, textAlign: m.me ? 'right' : 'left'}}><div style={{display:'inline-block', padding:'8px 10px', borderRadius:10, background: m.me ? 'rgba(255,255,255,.06)' : 'rgba(30,144,255,.18)'}}>{m.text}</div></div>))}
          </div>
          <div style={{display:'flex', gap:8}}>
            <input value={text} onChange={e=>setText(e.target.value)} placeholder="Ask the assistant..." onKeyDown={e=>{ if(e.key==='Enter') send(); }} />
            <button onClick={send} disabled={busy}>{busy ? '...' : 'Send'}</button>
          </div>
        </div>
      )}
      <div className="fab" onClick={() => setOpen(o => !o)} aria-label="Open chat">💬</div>
    </>
  );
}
