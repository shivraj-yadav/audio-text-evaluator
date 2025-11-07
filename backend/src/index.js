import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { getDbClient } from './mongo.js'
import clipsRouter from './routes/clips.js'
import submissionsRouter from './routes/submissions.js'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const PORT = process.env.PORT || 4000
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: ORIGIN }))
app.use(express.json())
app.use(morgan('dev'))

// static uploads (match backend/uploads location)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

app.get('/api/health', async (req, res) => {
  try {
    const client = await getDbClient()
    const ok = client.topology?.isConnected() ?? true
    res.json({ ok, service: 'backend', mongo: ok })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

app.use('/api/clips', clipsRouter)
app.use('/api/submissions', submissionsRouter)

app.listen(PORT, async () => {
  try {
    await getDbClient()
    console.log(`[backend] listening on http://localhost:${PORT}`)
  } catch (e) {
    console.error('[backend] failed to connect to MongoDB:', e)
    process.exit(1)
  }
})
