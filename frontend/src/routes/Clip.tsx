import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

type ClipMeta = { _id: string; title: string; uri: string; createdAt: string }

export default function Clip() {
  const { clipId } = useParams()
  const [clips, setClips] = useState<ClipMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState<string>('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<
    | null
    | {
        submissionId?: string
        score: number
        summary: string
        alignment: { idx: number; hyp: string | null; ref: string | null; op: 'ok'|'sub'|'ins'|'del'; msg?: string }[]
      }
  >(null)
  const [pendingMsg, setPendingMsg] = useState<string | null>(null)

  // Load clips
  useEffect(() => {
    let active = true
    setError(null)
    fetch('/api/clips')
      .then(r => { if (!r.ok) throw new Error('Failed to load clip'); return r.json() })
      .then(d => { if (active) setClips(d.clips as ClipMeta[]) })
      .catch(e => { if (active) setError(String(e.message || e)) })
    return () => { active = false }
  }, [])

  // Draft persistence per clip
  const draftKey = useMemo(() => `draft:${clipId}`, [clipId])
  useEffect(() => {
    if (!clipId) return
    const saved = localStorage.getItem(draftKey)
    if (saved != null) setText(saved)
  }, [draftKey, clipId])
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(draftKey, text)
    }, 250)
    return () => clearTimeout(id)
  }, [draftKey, text])

  const clip = useMemo(() => clips?.find(c => c._id === clipId) ?? null, [clips, clipId])

  const wordCount = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text])
  const charCount = text.length

  // Anonymous session id
  const sessionId = useMemo(() => {
    let id = localStorage.getItem('sessionId')
    if (!id) {
      id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
      localStorage.setItem('sessionId', id)
    }
    return id
  }, [])

  const submitTranscript = async () => {
    if (!clipId || !text.trim()) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    setPendingMsg(null)
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, transcript: text, sessionId })
      })
      // 202 means ASR in progress; show message and return
      if (res.status === 202) {
        const data = await res.json().catch(() => ({}))
        setPendingMsg('Transcribing audio… please retry Submit in ~1 minute (first run may take longer).')
        return
      }
      if (!res.ok) throw new Error('Failed to score submission')
      const data = await res.json()
      if (typeof data?.score !== 'number' || !isFinite(data.score)) {
        setError('Scoring response incomplete. Please try again shortly.')
        return
      }
      setResult({
        submissionId: data.submissionId,
        score: data.score,
        summary: String(data.summary || ''),
        alignment: Array.isArray(data.alignment) ? data.alignment : []
      })
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold">{clip ? clip.title : `Clip: ${clipId}`}</h2>
        {error && <p className="mt-2 text-red-300">{error}</p>}
        {!error && !clips && <p className="mt-2 text-slate-300">Loading…</p>}
        {clips && !clip && (
          <p className="mt-2 text-slate-300">Clip not found. Go back and choose another.</p>
        )}

        {clip && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-sm text-slate-400">Audio</p>
                <audio ref={audioRef} controls className="mt-2 w-full">
                  <source src={clip.uri} />
                </audio>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-300 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <span>Words: <span className="font-semibold text-slate-100">{wordCount}</span></span>
                <span>Chars: <span className="font-semibold text-slate-100">{charCount}</span></span>
              </div>
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="transcript" className="block text-sm text-slate-300 mb-2">Your transcription</label>
              <textarea
                id="transcript"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type what you hear…"
                className="min-h-[280px] w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4 outline-none focus:ring-2 focus:ring-brand/50"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="inline-flex items-center rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => audioRef.current?.play()}
                  className="inline-flex items-center rounded-lg bg-brand px-3 py-2 text-white hover:bg-brand-dark transition-colors"
                >
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => audioRef.current?.pause()}
                  className="inline-flex items-center rounded-lg bg-slate-800 px-3 py-2 text-white hover:bg-slate-700 transition-colors"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={submitTranscript}
                  disabled={submitting || !text.trim()}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Scoring…' : 'Submit for Scoring'}
                </button>
              </div>

              {/* Feedback */}
              {pendingMsg && (
                <div className="mt-6 text-slate-300">{pendingMsg}</div>
              )}

              {result && isFinite(result.score) && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-300">Score:</span>
                    <span className="text-lg font-semibold text-emerald-400">{String(Math.round(result.score))}</span>
                    <span className="text-sm text-slate-400">/ 100</span>
                  </div>
                  <p className="text-slate-300">{result.summary}</p>

                  {result.alignment?.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                        <p className="text-sm text-slate-400 mb-2">Reference (from audio)</p>
                        <div className="text-slate-200 leading-relaxed">
                          {result.alignment.map((a, i) => {
                            if (a.ref == null) return null // skip insertions when showing gold line
                            const isMistake = a.op === 'sub' || a.op === 'del'
                            return (
                              <span key={`ref-${i}`} className={isMistake ? 'text-rose-400' : ''}>
                                {a.ref}
                                {' '}
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                        <p className="text-sm text-slate-400 mb-2">Your transcription</p>
                        <div className="text-slate-200 leading-relaxed">
                          {result.alignment.map((a, i) => {
                            if (a.hyp == null) return null // skip deletions when showing hyp line
                            const isMistake = a.op === 'sub' || a.op === 'ins'
                            return (
                              <span key={`hyp-${i}`} className={isMistake ? 'text-rose-400' : ''}>
                                {a.hyp}
                                {' '}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  )
}
