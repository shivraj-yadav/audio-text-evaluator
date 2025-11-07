# Audio Transcription Quality Evaluator (Simple Version)

## Project Features
- **User-friendly transcription UI**
  - Play/pause audio clips.
  - Input box to type what was heard.
  - Submit, edit, and resubmit until finalized.

- **Gold transcript comparison**
  - Backend sends user transcript to a Python scorer.
  - Compares against a stored gold transcript for the clip.

- **Accuracy scoring and feedback**
  - Returns a numeric score (e.g., 0–100) and brief feedback.
  - Immediate on-screen feedback to help users improve.

- **Mistake highlighting and explanation**
  - Word-level diff between user transcript and gold transcript.
  - Highlights insertions, deletions, substitutions with colors.
  - Short explanation per error (e.g., missing word, wrong word, extra word).

- **Task assignment and tracking**
  - List of available audio clips.
  - Tracks submissions (open access; optional anonymous session IDs).

- **Data storage**
  - Audio clip metadata (id, title, URI, gold transcript reference).
  - User submissions and computed scores.

- **Admin utilities (basic)**
  - Upload new audio clips and gold transcripts.
  - View leaderboard or average scores by clip.

## Tech Stack (Simplified)
- **Frontend:** React.js
- **Backend API:** Node.js + Express
- **Database:** MongoDB
- **Scoring Service:** Python module (invoked from Node)

## Project Flow
- **[1] Admin setup**
  - Admin uploads audio file + gold transcript.
  - Metadata saved in MongoDB; audio stored at a URL (cloud/local).

- **[2] Open access session**
  - User opens the app and sees the task list.
  - Selects an audio clip and opens the transcription page.

- **[3] Transcription UI**
  - User plays the audio and types what they hear.
  - User submits transcription to the backend.

- **[4] Scoring pipeline**
  - Node receives the submission and fetches the gold transcript.
  - Node calls the Python scoring module (e.g., via child process or HTTP microservice) with both texts.
  - Python computes accuracy (e.g., word-level WER inverse or similarity score) and returns:
    - Score (0–100)
    - Summary feedback
    - Word-level alignment with error tags (ins/del/sub) for highlighting.

- **[5] Persist and respond**
  - Node saves the submission and score in MongoDB (with clipId, timestamp, optional anonymous sessionId).
  - Node returns score + feedback to the frontend.

- **[6] Feedback to user**
  - React UI displays the score and brief guidance.
  - Shows inline highlights for mistakes (insertions/deletions/substitutions) and brief explanations.
  - User may edit and resubmit (versioned submissions) or mark as final.

- **[7] Review & reporting**
  - Admin views per-clip stats, user performance, and export summaries.

## Notes on Scoring (Simple Baseline)
- Tokenize to words, lowercase, strip punctuation.
- Compute edit distance (Levenshtein) → Word Error Rate (WER).
- Convert to accuracy: `accuracy = max(0, 100 * (1 - WER))`.
- Feedback payload includes alignment for UI highlighting, e.g.:
  - `[{ idx: 0, hyp: "hello", ref: "hello", op: "ok" }, { idx: 1, hyp: "wrld", ref: "world", op: "sub" }, { idx: 2, hyp: "the", ref: null, op: "ins" }, { idx: 3, hyp: null, ref: "today", op: "del" }]`.
  - UI maps `op` to colors and tooltips: `sub` → "wrong word", `ins` → "extra word", `del` → "missing word".

## Extra Feature Idea
- Personalized feedback history per user: show trends over time and targeted tips (e.g., numbers, names, homophones).
