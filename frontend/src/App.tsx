import { Link, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div className="header-gradient h-full w-full" />
        </div>
        <div className="container relative py-5">
          <div className="flex items-center justify-between">
            <h1 className="m-0 text-lg font-semibold tracking-tight">Audio Transcription Evaluator</h1>
            <nav className="space-x-4 text-sm">
              <Link className="text-slate-200 hover:text-white" to="/">Home</Link>
              <Link className="text-slate-200 hover:text-white" to="/upload">Upload</Link>
              <Link className="text-slate-200 hover:text-white" to="/report">Report</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  )
}
