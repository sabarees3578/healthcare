import React, { useState, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../utils/firebaseConfig';
import { ref as dbRef, set as dbSet, update as dbUpdate, get } from 'firebase/database';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const recaptchaRef = useRef(null);
  const confirmationRef = useRef(null);

  function ensureRecaptcha() {
    if (!window.__hp_recaptcha) {
      window.__hp_recaptcha = new RecaptchaVerifier(auth, recaptchaRef.current || 'recaptcha-container', {
        size: 'invisible'
      });
      try { window.__hp_recaptcha.render?.(); } catch (_) {}
    }
    return window.__hp_recaptcha;
  }

  async function emailLogin() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function googleLogin() {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const userRef = dbRef(db, `users/${result.user.uid}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists() || !snapshot.val().role) {
        await dbSet(userRef, {
          name: result.user.displayName,
          email: result.user.email,
          role: null
        });
        setMsg('Please choose your role to complete registration.');
        window.location.href = '/select-role'; // redirect to role page
      }
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function facebookLogin() {
    try { await signInWithPopup(auth, new FacebookAuthProvider()); }
    catch (e) { setMsg(e.message + ' (ensure Facebook setup in Firebase console)'); }
  }

  async function appleLogin() {
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email'); provider.addScope('name');
      await signInWithPopup(auth, provider);
    } catch (e) { setMsg('Apple sign-in error: ' + (e.message || e.code || e)); }
  }

  async function register() {
    try {
      if (!name || !email || !password || !role) return setMsg('Fill name/email/password/role');
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await dbSet(dbRef(db, `users/${cred.user.uid}`), { name, email, role, phone, createdAt: Date.now() });
      setMsg('Registered. If you provided phone, send OTP to verify.');
    } catch (e) { setMsg(e.message); }
  }

  async function forgotPassword() {
    try { await sendPasswordResetEmail(auth, email); setMsg('Password reset email sent.'); }
    catch (e) { setMsg(e.message); }
  }

  async function sendOtp() {
    try {
      if (!phone) return setMsg('Enter phone in E.164 format, e.g. +911234567890');
      const confirmation = await signInWithPhoneNumber(auth, phone, ensureRecaptcha());
      confirmationRef.current = confirmation;
      setMsg('OTP sent. Enter the code below.');
    } catch (e) {
      setMsg(e.message || String(e));
    }
  }

  async function verifyOtp(code) {
    try {
      if (!confirmationRef.current) return setMsg('OTP not sent yet.');
      if (!code) return setMsg('Enter the OTP code');
      const res = await confirmationRef.current.confirm(code);
      await dbUpdate(dbRef(db, `users/${res.user.uid}`), { phone: res.user.phoneNumber });
      setMsg('Phone number verified and saved.');
    } catch (e) {
      setMsg('OTP verification failed: ' + (e.message || e));
    }
  }

  return (
    <div className="card container" style={{maxWidth:1000, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <div>
        <h3 style={{marginTop:0}}>Login</h3>
        <label className="small">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label className="small">Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <div className="row" style={{marginTop:8}}>
          <button onClick={emailLogin}>Sign in</button>
          <button className="ghost" onClick={forgotPassword}>Forgot</button>
        </div>

        <div style={{marginTop:12}} className="row">
          <button onClick={googleLogin}>Google</button>
          <button onClick={facebookLogin}>Facebook</button>
          <button onClick={appleLogin}>Apple</button>
        </div>

        <div style={{marginTop:12}}>
          <div className="small">Phone OTP</div>
          <input placeholder="+911234567890" value={phone} onChange={e=>setPhone(e.target.value)} />
          <div className="row" style={{marginTop:8}}>
            <button onClick={sendOtp}>Send OTP</button>
            <input
              placeholder="Enter OTP"
              style={{width:120}}
              onBlur={e => verifyOtp(e.target.value)}
            />
          </div>
          <div id="recaptcha-container" ref={el=>recaptchaRef.current = el} />
        </div>
      </div>

      <div>
        <h3 style={{marginTop:0}}>Register</h3>
        <label className="small">Full name</label>
        <input value={name} onChange={e=>setName(e.target.value)} />
        <label className="small">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label className="small">Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <label className="small">Role</label>
        <select value={role} onChange={e=>setRole(e.target.value)}>
          <option value="">-- choose --</option>
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="caregiver">Caregiver</option>
        </select>
        <div style={{marginTop:12}} className="row">
          <button onClick={register}>Create account</button>
        </div>
        {msg && <div className="small" style={{marginTop:12}}>{msg}</div>}
      </div>
    </div>
  );
}
