import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import webpush from 'web-push'
import admin from 'firebase-admin'

// ===== Configure these for production =====
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const CONTACT = 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) { webpush.setVapidDetails(CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); } else { console.warn('Web Push disabled: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars'); }

// Firebase Admin: set GOOGLE_APPLICATION_CREDENTIALS env to your service account JSON path
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://healthcare-6fc8d-default-rtdb.firebaseio.com'
  })
}
const db = admin.database()

const app = express()
app.use(cors())
app.use(bodyParser.json())

// Simple send endpoint for testing
app.post('/send', async (req, res) => {
  const { endpoint, keys, title, body } = req.body
  try {
    await webpush.sendNotification({ endpoint, keys }, JSON.stringify({ title, body }))
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log('Push server running on ' + PORT))

// ===== Scheduler: poll tasks with reminderAt due in the next minute and send push =====
const sentKey = (uid, taskId) => `sent_${uid}_${taskId}`
const sentCache = new Set()

async function scanAndNotify(){
  try {
    const usersSnap = await db.ref('users').once('value')
    const users = usersSnap.val() || {}
    const now = Date.now()
    const windowMs = 60 * 1000
    for (const uid of Object.keys(users)) {
      const tasks = (users[uid].tasks) || {}
      const subs = (users[uid].pushSubscriptions) || {}
      for (const [taskId, t] of Object.entries(tasks)) {
        if (!t.reminderAt) continue
        const when = new Date(t.reminderAt).getTime()
        if (when <= now && when > (now - windowMs)) {
          const marker = sentKey(uid, taskId)
          if (sentCache.has(marker)) continue
          // fanout to all subscriptions
          const payload = JSON.stringify({ title: 'Health Portal Reminder', body: t.text || 'Reminder' })
          await Promise.all(Object.values(subs).map(sub => webpush.sendNotification(sub, payload).catch(()=>{})))
          sentCache.add(marker)
          await db.ref(`users/${uid}/tasks/${taskId}/pushedAt`).set(admin.database.ServerValue.TIMESTAMP)
        }
      }
    }
  } catch (e) {
    console.error('scan error', e)
  }
}

// run every 20s
setInterval(scanAndNotify, 20000)
