import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

type Clip = { _id: string; title: string; uri: string; createdAt: string }

export default function Home() {
  const [clips, setClips] = useState<Clip[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadClips = () => {
    let active = true
    setError(null)
    fetch('/api/clips')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load clips')
        return r.json()
      })
      .then(d => {
        if (active) setClips(d.clips as Clip[])
      })
      .catch(e => {
        if (active) setError(String(e.message || e))
      })
    return () => {
      active = false
    }
  }

  useEffect(() => {
    const cleanup = loadClips()
    return cleanup
  }, [])

  const addDemoClip = async () => {
    try {
      setBusy(true)
      setError(null)
      const res = await fetch('/api/clips/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Demo — Short Sample',
          uri: 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
          goldTranscript: 'This is a short sample audio for testing.'
        })
      })
      if (!res.ok) throw new Error('Failed to add demo clip')
      // reload list
      loadClips()
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-10">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.5 }}
        className="rounded-2xl bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-cyan-500/10 p-8 border border-slate-800"
      >
        <h2 className="text-2xl font-semibold">Transcribe and get instant feedback</h2>
        <p className="mt-2 text-slate-300">Open access. Pick a clip, submit your transcription, and see your score with highlighted mistakes.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/upload" className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-dark transition-colors">Upload Clip</Link>
          <Link to="/report" className="inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800/60 transition-colors">View Reports</Link>
          <button
            onClick={addDemoClip}
            disabled={busy}
            className="inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800/60 transition-colors disabled:opacity-60"
          >
            {busy ? 'Adding…' : 'Add Demo Clip'}
          </button>
        </div>
      </motion.div>

      <div>
        <h3 className="text-lg font-medium mb-4">Available Clips</h3>
        {!clips && !error && (
          <div className="text-slate-300">Loading clips…</div>
        )}
        {error && (
          <div className="text-red-300">{error}</div>
        )}
        {clips && clips.length === 0 && (
          <div className="text-slate-400">No clips yet. Use Upload to add one.</div>
        )}
        {clips && clips.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map((c, i) => (
              <motion.div
                key={c._id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ duration: 0.4, delay: 0.08 * i }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{c.title}</h4>
                    <p className="text-sm text-slate-400">Added: {new Date(c.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="text-xs rounded bg-slate-800 px-2 py-1 text-slate-300">Open</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    to={`/clip/${c._id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-white hover:bg-brand-dark transition-colors"
                  >
                    Start
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Delete clip \"${c.title}\"? This will remove its audio and submissions.`)) return
                      try {
                        setDeletingId(c._id)
                        const res = await fetch(`/api/clips/${c._id}`, { method: 'DELETE' })
                        if (!res.ok) throw new Error('Failed to delete clip')
                        // refresh list
                        const cleanup = loadClips()
                        if (typeof cleanup === 'function') cleanup()
                      } catch (e: any) {
                        setError(e.message || String(e))
                      } finally {
                        setDeletingId(null)
                      }
                    }}
                    disabled={deletingId === c._id}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-700 px-3 py-2 text-rose-200 hover:bg-rose-900/40 transition-colors disabled:opacity-60"
                  >
                    {deletingId === c._id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
