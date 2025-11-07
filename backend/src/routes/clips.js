import { Router } from 'express'
import { getDb } from '../mongo.js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ObjectId } from 'mongodb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Store uploads under backend/uploads
const uploadsDir = path.resolve(__dirname, '../../uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  }
})
const upload = multer({ storage })

const router = Router()

// GET /api/clips - list clips (id, title, uri, createdAt)
router.get('/', async (req, res) => {
  const db = await getDb()
  const raw = await db
    .collection('clips')
    .find({}, { projection: { goldTranscript: 0 } })
    .sort({ createdAt: -1 })
    .toArray()
  const clips = raw.map(d => ({
    _id: d._id.toString(),
    title: d.title,
    uri: d.uri,
    createdAt: d.createdAt
  }))
  res.json({ clips })
})

// POST /api/admin/clips - create a new clip
// body: { title: string, uri: string, goldTranscript: string }
router.post('/admin', upload.single('audio'), async (req, res) => {
  const { title, goldTranscript } = req.body || {}
  const file = req.file
  const fallbackUri = req.body?.uri
  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }
  const uri = file ? `/uploads/${file.filename}` : fallbackUri
  if (!uri) {
    return res.status(400).json({ error: 'audio file is required (or provide uri for compatibility)' })
  }
  const db = await getDb()
  const now = new Date()
  const doc = { title, uri, goldTranscript: goldTranscript || '', createdAt: now }
  const result = await db.collection('clips').insertOne(doc)
  const clip = { _id: result.insertedId.toString(), title, uri, createdAt: now }
  res.status(201).json(clip)
})

// DELETE /api/clips/:id - delete a clip, its submissions, and local file
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'missing id' })
    const db = await getDb()
    const clip = await db.collection('clips').findOne({ _id: new ObjectId(id) })
    if (!clip) return res.status(404).json({ error: 'not_found' })

    // delete file if stored locally
    try {
      if (clip.uri && typeof clip.uri === 'string' && clip.uri.startsWith('/uploads/')) {
        const filename = clip.uri.replace('/uploads/', '')
        const filePath = path.resolve(uploadsDir, filename)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    } catch {}

    await db.collection('submissions').deleteMany({ clipId: new ObjectId(id) })
    await db.collection('clips').deleteOne({ _id: new ObjectId(id) })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
