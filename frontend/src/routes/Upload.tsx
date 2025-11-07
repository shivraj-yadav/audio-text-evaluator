import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Upload() {
  const [title, setTitle] = useState('')
  const [uri, setUri] = useState('')
  const fileRef = useRef<HTMLInputElement|null>(null)
  const [gold, setGold] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const hasFile = !!(fileRef.current?.files && fileRef.current.files[0])
    const hasUrl = !!uri.trim()
    if (!title.trim()) {
      setError('Please provide Title')
      return
    }
    if (!hasFile && !hasUrl) {
      setError('Please attach an audio file or provide an audio URL')
      return
    }
    try {
      setBusy(true)
      const fd = new FormData()
      fd.append('title', title.trim())
      if (gold.trim()) {
        fd.append('goldTranscript', gold.trim())
      }
      // If no gold provided but file present, request ASR to create gold
      if (!gold.trim() && hasFile) {
        fd.append('useAsr', 'true')
      }
      if (fileRef.current?.files && fileRef.current.files[0]) {
        fd.append('audio', fileRef.current.files[0])
      } else if (uri.trim()) {
        fd.append('uri', uri.trim())
      }
      const res = await fetch('/api/clips/admin', { method: 'POST', body: fd })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Upload failed')
      }
      const clip = await res.json()
      navigate(`/clip/${clip._id}`)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Upload a new clip</h2>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="text-red-300">{error}</div>}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Daily News Segment"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Audio URL</label>
          <input
            value={uri}
            onChange={e => setUri(e.target.value)}
            placeholder="https://.../clip.mp3"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 outline-none focus:ring-2 focus:ring-brand/50"
          />
          <p className="mt-1 text-xs text-slate-400">Provide a direct URL to an MP3/OGG file accessible by the browser.</p>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Or Upload Audio File</label>
          <input ref={fileRef} type="file" accept="audio/*" className="w-full text-sm" />
          <p className="mt-1 text-xs text-slate-400">If provided, the file will be uploaded and served from this server.</p>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Gold Transcript (optional if uploading a file)</label>
          <textarea
            value={gold}
            onChange={e => setGold(e.target.value)}
            placeholder="Paste the gold (reference) transcript here"
            className="min-h-[160px] w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 outline-none focus:ring-2 focus:ring-brand/50"
          />
          <p className="mt-1 text-xs text-slate-400">Leave blank when uploading an audio file to auto-generate the gold transcript using ASR.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-dark transition-colors disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create Clip'}
          </button>
        </div>
      </form>
    </section>
  )
}
