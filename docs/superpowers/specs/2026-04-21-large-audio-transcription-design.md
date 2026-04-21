# Large Audio Transcription Design

**Goal:** Support audio files of any length (pilot requirement: 50-minute interviews) in the Waybetter webapp, bypassing Vercel's 4.5MB body limit and Whisper's 25MB per-call limit.

**Date:** 2026-04-21

---

## Problem Summary

| Issue | Current state | Impact |
|-------|--------------|--------|
| Vercel body limit | 4.5MB for serverless POST body | Files >4.5MB never reach the server |
| Whisper API limit | 25MB per call | Files >25MB rejected by OpenAI |
| No chunking | 1 file = 1 Whisper call | No workaround for large files |
| No `maxDuration` | Default Vercel timeout (10s Hobby) | Long transcriptions time out |
| Generic errors | Single catch-all 500 | User cannot understand what went wrong |

---

## Architecture

### Data Flow

```
User selects audio file
  ↓
lib/audio-chunker.js
  Decode audio with browser AudioContext (any format → PCM)
  Resample to 16kHz mono
  Split into 10-minute chunks (each ~18.4MB as WAV)
  ↓
Per chunk (sequential):
  lib/storage-upload.js
    Upload WAV chunk to Supabase Storage bucket "audio-temp"
    Path: audio-temp/{uuid}/{chunkIndex}.wav
    Returns: storage path
  ↓
  POST /api/transcribe  { storagePath, chunkIndex, totalChunks }
    Download chunk from Supabase Storage (service role key)
    Call OpenAI Whisper whisper-1
    Delete chunk from Storage
    Return { transcript }
  ↓
Frontend concatenates transcripts in order
Shows "Deel 2 van 5 verwerkt..." during processing
```

### Fast Path (unchanged)

Live browser recordings via MediaRecorder produce small WebM blobs (<4.5MB for typical <5 min recordings). These continue to use the existing direct POST to `/api/transcribe` with the file body — no chunking, no storage, no change.

---

## Components

### 1. Supabase Storage bucket: `audio-temp`

- Not public
- RLS policies:
  - INSERT: allow for `anon` role (browser uploads with anon key)
  - SELECT: deny for `anon` (server uses service_role key, bypasses RLS)
  - DELETE: deny for `anon`
- Files are temporary: deleted by server after each Whisper call
- Path format: `{uuid}/{chunkIndex}.wav` (UUID prevents path guessing)

### 2. `lib/audio-chunker.js` (new file)

Responsibilities:
- `decodeAndChunk(file)` — accepts a File/Blob of any audio format, returns an array of WAV Blobs
- Uses `AudioContext.decodeAudioData()` to decode (native browser API, no dependencies)
- Resamples to 16kHz mono OfflineAudioContext
- Splits into chunks of `CHUNK_DURATION_SECONDS = 600` (10 minutes)
- Encodes each chunk as WAV (PCM 16-bit, 16kHz, mono) with a hand-written 44-byte header
- Each output chunk: `600 * 16000 * 2 bytes = 18.75MB` — under Whisper's 25MB limit

WAV encoding is ~30 lines of vanilla JS using DataView/ArrayBuffer. No external library needed.

Error surface: throws if `AudioContext.decodeAudioData()` fails (unsupported format). Caller shows user-facing error.

### 3. `lib/storage-upload.js` (new file)

Responsibilities:
- `uploadChunk(wavBlob, sessionId, chunkIndex)` — uploads a WAV Blob to Supabase Storage
- Returns the storage path `{sessionId}/{chunkIndex}.wav`
- Uses `supabase.storage.from('audio-temp').upload()` with browser client (anon key)
- `sessionId` is a UUID generated once per file upload session

### 4. `lib/use-audio.js` (modified)

Changes to `transcribeFile(file)`:
- Check if file is from MediaRecorder (live recording) → use existing fast path
- Otherwise, use chunking path:
  1. Call `decodeAndChunk(file)` — decode + split
  2. Generate `sessionId = crypto.randomUUID()`
  3. For each chunk (sequentially):
     - `uploadChunk(wavBlob, sessionId, index)`
     - POST `/api/transcribe` with `{ storagePath, chunkIndex, totalChunks }`
     - Call `onStatus?.(`Deel ${index + 1} van ${totalChunks} verwerkt...`)`
  4. Concatenate all transcripts with a space
  5. Call `onTranscript(combined)`

Error handling:
- If any chunk fails: stop processing, call `onError()` with specific message, attempt to clean up remaining storage files
- Distinguishing live recording vs file upload: MediaRecorder blobs have `file.name` of `opname.webm` or `opname.m4a` — add a boolean parameter `isLiveRecording` instead of name-sniffing

### 5. `app/api/transcribe/route.js` (modified)

New behavior:
- Accepts two request shapes:
  - **Shape A (existing, fast path):** `multipart/form-data` with `file` field — used by live recordings
  - **Shape B (new, chunking path):** `application/json` with `{ storagePath }` — used by file uploads
- Detects shape by `Content-Type` header
- `export const maxDuration = 300` (Vercel Pro limit)
- Shape B flow:
  1. Parse `{ storagePath }` from JSON body
  2. Download file from Supabase Storage using service role client
  3. Convert downloaded ArrayBuffer to File object (named `chunk.wav`)
  4. Call Whisper `whisper-1` with `language: 'nl'`
  5. Delete file from Supabase Storage
  6. Return `{ transcript }`
- Specific error messages:
  - Storage download fails: `'Kon het audiobestand niet ophalen. Probeer opnieuw.'`
  - Whisper rejects file: `'Bestandsformaat wordt niet herkend door de transcriptiedienst.'`
  - Whisper API error: `'Er is een fout bij OpenAI. Probeer het opnieuw.'`
  - Timeout: caught by Vercel (returns 504), not caught here

### 6. Environment variables

Existing (already present):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

New (needs to be added to Vercel + `.env.local`):
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used to download/delete from Storage

---

## Supabase Setup (one-time manual steps)

These cannot be automated from code and must be done manually in the Supabase dashboard:

1. Go to Storage → Create bucket → Name: `audio-temp` → Not public
2. Go to Storage → Policies → `audio-temp`:
   - Add policy: INSERT for `anon` role, no conditions (allows browser upload)
   - No SELECT/DELETE policy for anon (service role bypasses RLS)
3. Go to Project Settings → API → copy `service_role` key
4. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables + `.env.local`

---

## What Changes vs Current Code

| File | Status | What changes |
|------|--------|-------------|
| `app/api/transcribe/route.js` | Modify | Add JSON shape, storage download, `maxDuration`, specific errors |
| `lib/use-audio.js` | Modify | Replace `transcribeFile()` with chunking-aware version |
| `lib/audio-chunker.js` | New | AudioContext decode + WAV encode + chunk split |
| `lib/storage-upload.js` | New | Supabase Storage upload helper |
| `lib/supabase-server.js` | Modify | Add service-role client export |

**Not changed:** `components/`, `app/` pages, chat API route, database schema.

---

## What Is Out of Scope (V1)

- Live recording chunking (live recordings are short by nature, fast path unchanged)
- Progress percentage bar (chunk count shown, not byte progress)
- Retry logic per chunk (fail fast, user reruns)
- Speaker diarization
- Timestamp output from Whisper

---

## Success Criteria

| Scenario | Expected outcome |
|----------|-----------------|
| 1MB file upload | Transcribes in <30s, no chunking |
| 15MB file upload (~15 min) | Transcribes in <60s, single chunk |
| 60MB file upload (~50 min) | Transcribes in 3-5 min, 4 chunks, "Deel X van 4 verwerkt..." visible |
| Live 2-min recording | Fast path, unchanged behavior |
| Unsupported format | Clear error: bestandstype not supported |
| Network error mid-chunk | Clear error, processing stops, partial transcript not shown |
