# Audio Transcription Evaluator

Upload an audio clip, type what you hear, and instantly see your score with mistakes highlighted.

## Features
- Modern UI (React + Tailwind, Framer Motion)
- Upload audio files or link by URL
- Auto‑transcribe audio (ASR) to generate the reference (gold) transcript
- Submit typed transcription and get:
  - Score (0–100) based on WER
  - Summary and detailed alignment (ok / substitution / insertion / deletion)
  - Inline mistake highlights (red)
- Manage clips (list, delete) and view history endpoints (extensible)

## Tech Stack
- Frontend: Vite + React + React Router + TailwindCSS + Framer Motion
- Backend: Node.js (Express), MongoDB (native driver), Multer (uploads)
- Scoring/ASR: Python scripts spawned from Node
  - faster‑whisper (preferred) or openai‑whisper (fallback)
  - ffmpeg for audio processing

## Prerequisites
- Node.js 18+ and npm
- MongoDB running locally or Atlas URI
- Python 3.10+ on PATH
- ffmpeg on PATH (verify with `ffmpeg -version`)

Recommended (for better ASR accuracy/perf):
- pip install faster-whisper
- Alternatively: pip install -U openai-whisper

## Monorepo Layout
```
.
├─ backend/                 # Express API + uploads + Python scorer
│  ├─ src/
│  │  ├─ index.js          # App entry, CORS, static /uploads, routers
│  │  ├─ mongo.js          # Mongo client helpers
│  │  ├─ routes/
│  │  │  ├─ clips.js       # GET/POST/DELETE /api/clips
│  │  │  └─ submissions.js # POST /api/submissions (ASR + scoring)
│  │  └─ scorer/
│  │     ├─ score.py       # Levenshtein alignment, WER -> accuracy
│  │     └─ transcribe.py  # ASR via faster‑whisper/openai‑whisper
│  └─ package.json
└─ frontend/                # Vite + React app
   ├─ src/
   │  ├─ App.tsx
   │  ├─ main.tsx
   │  └─ routes/
   │     ├─ Home.tsx       # List/add/delete clips
   │     ├─ Clip.tsx       # Player, editor, submit & feedback
   │     ├─ Upload.tsx     # Upload file/URL + gold (optional)
   │     └─ Report.tsx     # Placeholder
   └─ package.json
```

## Environment Variables
Backend (PowerShell examples):
```
# Required
$env:MONGODB_URI="mongodb://127.0.0.1:27017/audio_eval"
$env:CORS_ORIGIN="http://localhost:5173"

# Python/ASR (set if needed)
$env:PYTHON_BIN="py"                  # or "python"
$env:WHISPER_MODEL="small"            # tiny/base/small/medium...
$env:WHISPER_LANG="en"                # ASR language bias
$env:ASR_INITIAL_PROMPT="My name is Shivraj."  # optional bias prompt
```

Frontend dev server proxies `/api` and `/uploads` to the backend by default.

## Setup & Run (Dev)
1) Install dependencies
```
cd backend
npm install

cd ../frontend
npm install
```

2) Start backend (in backend folder)
```
# Ensure MongoDB is running and ffmpeg is on PATH
npm run dev
```
Backend dev server: http://localhost:4000

3) Start frontend (in frontend folder)
```
npm run dev
```
Frontend dev server: http://localhost:5173

## Usage
- Upload
  - Use Upload page to select an audio file (or paste an audio URL) and optional gold transcript.
  - If you omit gold and upload a file, the server will auto‑transcribe on first scoring request.
- Transcribe
  - Open a clip from Home, play the audio, type your transcription, click "Submit for Scoring".
  - If ASR is still running, you’ll see a message; retry submit after ~1–2 minutes (first model download can take longer).
- Delete
  - On Home, click Delete to remove a clip, its local audio, and its submissions.

## API (Summary)
- GET `/api/health` → `{ ok, service, mongo }`
- GET `/api/clips` → `{ clips: [{ _id, title, uri, createdAt }] }`
- POST `/api/clips/admin` (multipart or JSON)
  - multipart fields: `title` (req), `audio` (file) or `uri` (string), `goldTranscript` (opt), `useAsr` (opt)
  - response: `{ _id, title, uri, createdAt }`
- DELETE `/api/clips/:id` → `{ ok: true }`
- POST `/api/submissions`
  - body: `{ clipId, transcript, sessionId }`
  - responses:
    - `202 { pending: 'asr_in_progress' }` when gold is being auto‑transcribed
    - `200 { submissionId, score, summary, alignment }` when scoring completes

## Troubleshooting
- Frontend shows proxy error `/api/*` → Start backend on port 4000.
- 404 for `/uploads/...` → Ensure backend serves static uploads and Vite proxy includes `/uploads`.
- 501 `asr_unavailable` → Check ffmpeg on PATH and Python ASR packages installed; set `$env:PYTHON_BIN` if needed.
- Score shows NaN → Wait for ASR to finish (202), then resubmit.
- Slow first run → Model download can take >1 min; timeout extended to accommodate.

## Production Notes
- Serve `backend/uploads` from persistent storage (e.g., S3) for scalability.
- Consider a background worker for ASR and a status endpoint (`/api/clips/:id`) for polling.
- Add auth/rate limiting for public deployments.

## License
MIT (add your preferred license)

## Acknowledgements
- OpenAI Whisper, faster‑whisper
- Vite, React, TailwindCSS, Framer Motion
