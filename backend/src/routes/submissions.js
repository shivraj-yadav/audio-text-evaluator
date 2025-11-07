import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../mongo.js'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const scorerPath = path.resolve(__dirname, '../scorer/score.py')
const transcriberPath = path.resolve(__dirname, '../scorer/transcribe.py')

function runPythonScorer(ref, hyp) {
  return new Promise((resolve, reject) => {
    const py = spawn(process.env.PYTHON_BIN || 'python', [scorerPath], { stdio: ['pipe', 'pipe', 'pipe'] })

    const payload = JSON.stringify({ ref, hyp })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      try { py.kill('SIGKILL') } catch {}
    }, 30000)
    py.stdout.on('data', d => { out += d.toString() })
    py.stderr.on('data', d => { err += d.toString() })
    py.on('error', reject)
    py.on('close', code => {
      clearTimeout(timer)
      if (code !== 0) {
        return reject(new Error(err || `scorer exit code ${code}`))
      }
      try {
        const data = JSON.parse(out)
        resolve(data)
      } catch (e) {
        reject(new Error('Invalid scorer output'))
      }
    })
    py.stdin.write(payload)
    py.stdin.end()
  })
}

function runPythonTranscribe(absAudioPath) {
  return new Promise((resolve, reject) => {
    const py = spawn(process.env.PYTHON_BIN || 'python', [transcriberPath, absAudioPath], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    // Allow up to 240s to accommodate first-time model download
    const timer = setTimeout(() => { try { py.kill('SIGKILL') } catch {} }, 240000)
    py.stdout.on('data', d => { out += d.toString() })
    py.stderr.on('data', d => { err += d.toString() })
    py.on('error', reject)
    py.on('close', code => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(err || `transcriber exit code ${code}`))
      try {
        const data = JSON.parse(out)
        resolve(data)
      } catch (e) {
        reject(new Error('Invalid transcriber output'))
      }
    })
  })
}

// JS fallback scoring (tokenize, DP alignment, WER -> accuracy)
function jsTokenize(s = '') {
  return String(s).toLowerCase().replace(/[^a-z0-9\s']+/g, ' ').split(/\s+/).filter(Boolean)
}
function jsAlign(refT, hypT) {
  const n = refT.length, m = hypT.length
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = refT[i-1] === hypT[j-1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + cost
      )
    }
  }
  let i = n, j = m
  const alignment = []
  while (i > 0 || j > 0) {
    if (i>0 && j>0 && dp[i][j] === dp[i-1][j-1] + (refT[i-1] === hypT[j-1] ? 0 : 1)) {
      if (refT[i-1] === hypT[j-1]) alignment.push({ idx: j-1, hyp: hypT[j-1], ref: refT[i-1], op: 'ok' })
      else alignment.push({ idx: j-1, hyp: hypT[j-1], ref: refT[i-1], op: 'sub', msg: 'wrong word' })
      i--; j--
    } else if (j>0 && dp[i][j] === dp[i][j-1] + 1) {
      alignment.push({ idx: j-1, hyp: hypT[j-1], ref: null, op: 'ins', msg: 'extra word' })
      j--
    } else {
      alignment.push({ idx: j, hyp: null, ref: refT[i-1], op: 'del', msg: 'missing word' })
      i--
    }
  }
  alignment.reverse()
  const s = alignment.filter(a=>a.op==='sub').length
  const d = alignment.filter(a=>a.op==='del').length
  const ins = alignment.filter(a=>a.op==='ins').length
  const N = Math.max(1, refT.length)
  const wer = (s + d + ins) / N
  const accuracy = Math.max(0, 100 * (1 - wer))
  return { score: accuracy, summary: `Accuracy ${Math.round(accuracy)} based on WER ${wer.toFixed(2)}.`, alignment }
}

// POST /api/submissions
// { clipId, transcript, sessionId? }
router.post('/', async (req, res) => {
  try {
    const { clipId, transcript, sessionId } = req.body || {}
    if (!clipId || !transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'clipId and transcript are required' })
    }

    const db = await getDb()
    const clip = await db.collection('clips').findOne({ _id: new ObjectId(clipId) })
    if (!clip) return res.status(404).json({ error: 'clip not found' })

    // If goldTranscript missing, kick off background ASR and return 202 so UI can retry
    let gold = clip.goldTranscript || ''
    if (!gold) {
      // Resolve absolute path to uploaded file if local
      let absPath = null
      if (clip.uri && clip.uri.startsWith('/uploads/')) {
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        absPath = path.resolve(__dirname, '../../uploads', clip.uri.replace('/uploads/', ''))
      }
      if (!absPath) {
        return res.status(501).json({ error: 'asr_unavailable', detail: 'cannot_resolve_audio_path' })
      }
      // Run transcription in background, update DB when done
      runPythonTranscribe(absPath)
        .then(async (tx) => {
          if (tx && tx.text) {
            await (await getDb()).collection('clips').updateOne({ _id: clip._id }, { $set: { goldTranscript: tx.text } })
          }
        })
        .catch(() => {})
      return res.status(202).json({ pending: 'asr_in_progress' })
    }

    // Score via Python, fallback to JS if Python fails
    let scored
    try {
      scored = await runPythonScorer(gold, transcript)
    } catch (e) {
      // fallback
      const rt = jsTokenize(gold)
      const ht = jsTokenize(transcript)
      scored = jsAlign(rt, ht)
    }

    const doc = {
      clipId: clip._id,
      sessionId: sessionId || null,
      transcript,
      score: scored.score,
      summary: scored.summary,
      alignment: scored.alignment,
      createdAt: new Date()
    }
    const result = await db.collection('submissions').insertOne(doc)

    res.json({
      submissionId: result.insertedId,
      score: scored.score,
      summary: scored.summary,
      alignment: scored.alignment
    })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
