# Audio Transcription Evaluator — Parallel Module Development Plan

## Overview
- **Goal:** Build an open-access transcription quality evaluator with immediate scoring and mistake highlighting.
- **Parallel Tracks:** Frontend (React), Backend API (Node/Express + MongoDB), Scoring Service (Python).
- **Open Access:** No login/signup. Submissions tracked with `sessionId` (anonymous) + `clipId` + `timestamp`.

## Milestones
- **M1 — Foundations (Day 1-2)**
  - FE: App shell, routing, base UI scaffolding.
  - BE: Project skeleton, Mongo connection, health check.
  - PY: Scorer baseline with WER + alignment output.
- **M2 — Core Transcription Loop (Day 3-5)**
  - FE: Task list + player/editor + submit.
  - BE: Clips + submissions APIs; integrate scorer.
  - PY: Robust tokenization, alignment ops (ok/ins/del/sub).
- **M3 — Feedback UX (Day 6-7)**
  - FE: Inline highlights + tooltips + resubmit flow.
  - BE: Persist alignment payload; list submissions per clip.
  - PY: Error explanations (per op) + summary feedback.
- **M4 — Admin/Uploader + Reporting (Day 8-9)**
  - FE: Simple uploader page; basic reporting view.
  - BE: Upload endpoints; aggregates (avg score per clip).
- **M5 — Polish & Testing (Day 10)**
  - E2E tests, seed data, perf/stability checks.

## Frontend Modules (React)
- **FE-1: App Shell & Routing**
  - Routes: `/`, `/clip/:clipId`, `/upload`, `/report`.
  - Layout, header, shallow navigation.
- **FE-2: Task List**
  - Fetch `/api/clips` and display list with duration/titles.
  - Open-access: show “Start” without auth.
- **FE-3: Player + Editor**
  - Audio player (play/pause/seek).
  - Textarea for transcript; character/word count.
- **FE-4: Submit + Feedback**
  - POST to `/api/submissions` with `{ clipId, transcript, sessionId }`.
  - Render returned `score`, `summary`, `alignment`.
- **FE-5: Mistake Highlighting**
  - Render tokens with color by `op`:
    - `ok` default; `sub` wrong; `ins` extra; `del` missing.
  - Tooltip shows explanation from backend.
- **FE-6: Resubmit & History**
  - “Improve & Resubmit” keeps text; shows new result.
  - Optional history drawer from `/api/submissions?clipId`.
- **FE-7: Admin/Uploader (Open)**
  - Upload audio + gold transcript text.
  - Calls `/api/admin/clips`.
- **FE-8: Reporting (Basic)**
  - Clip averages, recent submissions, top error types.

## Backend Modules (Node/Express + MongoDB)
- **BE-1: Core Setup**
  - Express app, config, Mongo client, health route `/api/health`.
- **BE-2: Models (Mongoose or native driver)**
  - `Clip`: `{ _id, title, uri, goldTranscript, createdAt }`.
  - `Submission`: `{ _id, clipId, sessionId?, transcript, score, summary, alignment, createdAt }`.
- **BE-3: Clips API**
  - GET `/api/clips` → list clips metadata.
  - POST `/api/admin/clips` → create clip with upload references.
- **BE-4: Submissions API**
  - POST `/api/submissions` → score and persist.
  - GET `/api/submissions` (filter by `clipId`) → recent submissions.
- **BE-5: Scoring Integration**
  - Invoke Python scorer (child process or HTTP microservice).
  - Contract: send `{ ref, hyp }` → receive `{ score, summary, alignment[] }`.
- **BE-6: Reporting**
  - GET `/api/reports/clip-averages` → `{ clipId, avgScore, count }[]`.

## Python Scoring Service Modules
- **PY-1: Tokenization**
  - Lowercase, strip punctuation, split on whitespace.
- **PY-2: Alignment**
  - Levenshtein alignment at word level.
  - Output ops: `ok`, `sub`, `ins`, `del` with indices and tokens.
- **PY-3: Scoring**
  - WER → accuracy: `max(0, 100 * (1 - WER))`.
- **PY-4: Explanations**
  - Map ops to messages: `sub` wrong word, `ins` extra, `del` missing.
- **PY-5: Interface**
  - CLI or HTTP service.
  - Input: JSON `{ ref: string, hyp: string }`.
  - Output: JSON `{ score: number, summary: string, alignment: Alignment[] }`.

## API Contracts (FE ⇄ BE)
- **GET /api/clips** → `200: { clips: Clip[] }`
- **POST /api/admin/clips** → `201: Clip`
- **POST /api/submissions**
```json
{
  "clipId": "string",
  "transcript": "string",
  "sessionId": "string?"
}
```
- Response `200`:
```json
{
  "submissionId": "string",
  "score": 0,
  "summary": "string",
  "alignment": [
    { "idx": 0, "hyp": "hello", "ref": "hello", "op": "ok" },
    { "idx": 1, "hyp": "wrld", "ref": "world", "op": "sub", "msg": "wrong word" },
    { "idx": 2, "hyp": "the", "ref": null, "op": "ins", "msg": "extra word" },
    { "idx": 3, "hyp": null, "ref": "today", "op": "del", "msg": "missing word" }
  ]
}
```

## Data Models
- **Clip**
```json
{
  "_id": "ObjectId",
  "title": "string",
  "uri": "string",
  "goldTranscript": "string",
  "createdAt": "ISODate"
}
```
- **Submission**
```json
{
  "_id": "ObjectId",
  "clipId": "ObjectId",
  "sessionId": "string?",
  "transcript": "string",
  "score": "number",
  "summary": "string",
  "alignment": "Alignment[]",
  "createdAt": "ISODate"
}
```
- **Alignment**
```json
{ "idx": "number", "hyp": "string|null", "ref": "string|null", "op": "ok|sub|ins|del", "msg": "string?" }
```

## Testing Plan
- **Unit**: Tokenization, alignment ops, WER, API handlers.
- **Integration**: BE⇄PY contract, FE submit→feedback loop.
- **E2E**: Core flows (open access), resubmission, reporting.

## Acceptance Criteria
- Submit returns score + alignment within < 2s for 30s clip.
- Highlights render correctly for all ops with tooltips.
- Resubmission updates score and history persists.
- Admin can upload a new clip and see it in list.
- Reports show average score per clip.
