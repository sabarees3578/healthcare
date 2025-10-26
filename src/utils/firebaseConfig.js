// Firebase config + initialization (Modular v10)
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// IMPORTANT: keep configuration VALID (no trailing commas/typos)
const firebaseConfig = {
  apiKey: "AIzaSyBI4QHoftB1-9bEkHcxNYSsDeKLRk8t82U",
  authDomain: "healthcare-6fc8d.firebaseapp.com",
  databaseURL: "https://healthcare-6fc8d-default-rtdb.firebaseio.com",
  projectId: "healthcare-6fc8d",
  storageBucket: "healthcare-6fc8d.firebasestorage.app",
  messagingSenderId: "543056642487",
  appId: "1:543056642487:web:65a7b67a68dc9124202832",
  measurementId: "G-VGR14Y460Q"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)
export default app
