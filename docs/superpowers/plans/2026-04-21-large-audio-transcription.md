# Large Audio Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support audio files of any length in the Waybetter webapp by routing uploads through Supabase Storage and chunking large files in the browser using AudioContext.

**Architecture:** The browser decodes any audio format to 16kHz mono PCM using `AudioContext`, splits into 10-minute WAV chunks, uploads each chunk to Supabase Storage `audio-temp` bucket, then calls `/api/transcribe` once per chunk with the storage path. The server downloads the chunk, sends it to Whisper, deletes it, and returns the transcript. Live microphone recordings bypass this flow and use the existing fast path.

**Tech Stack:** Next.js 15 App Router, Supabase Storage (`@supabase/supabase-js`), OpenAI Whisper API, Web Audio API (browser-native, no extra dependencies)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/supabase-server.js` | Modify | Add `createServiceClient()` export using service role key |
| `lib/audio-chunker.js` | Create | Decode any audio → 16kHz mono PCM → WAV chunks |
| `lib/storage-upload.js` | Create | Upload a WAV Blob to Supabase Storage, return path |
| `lib/use-audio.js` | Modify | Add chunking path to `transcribeFile`; fast path for live recordings |
| `app/api/transcribe/route.js` | Modify | Accept JSON `{storagePath}`, download from Storage, call Whisper, delete, return transcript. Add `maxDuration = 300` |

**Not changed:** `components/TranscriptForm.jsx`, `components/PublicTranscriptForm.jsx`, `app/api/chat/`, database schema, `next.config.mjs`, `vercel.json`.

---

## Task 1: Add Supabase service-role client

**Files:**
- Modify: `lib/supabase-server.js`

The existing `createClient()` in this file uses the anon key and needs cookie support for auth. The new `createServiceClient()` uses the service role key (bypasses RLS) and needs no cookies. It uses `@supabase/supabase-js` directly, which is already in `package.json`.

- [ ] **Step 1: Read the current file**

```bash
cat lib/supabase-server.js
```

- [ ] **Step 2: Add the service client export**

Append at the bottom of `lib/supabase-server.js` (after the existing `createClient` function):

```javascript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
```

Note: the `import { createClient as createSupabaseClient }` line must be added at the top of the file with the other imports, not at the bottom. Move it to the top.

The full updated `lib/supabase-server.js`:

```javascript
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 3: Verify no build errors**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully` or similar. No TypeScript/import errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add lib/supabase-server.js
git commit -m "feat: add createServiceClient for server-side Supabase Storage access"
```

---

## Task 2: Create audio-chunker.js

**Files:**
- Create: `lib/audio-chunker.js`

This file runs in the browser only (`'use client'` is not needed here because it's a pure utility, but callers that use it must be client components). It uses the Web Audio API which is browser-native — no npm packages needed.

Logic:
1. Read file as ArrayBuffer
2. Decode with `AudioContext.decodeAudioData()` (supports MP3, M4A, WAV, WebM, Ogg)
3. Resample to 16kHz mono using `OfflineAudioContext`
4. Split the mono PCM Float32Array into 10-minute chunks (600 * 16000 = 9,600,000 samples per chunk)
5. Encode each chunk as a WAV Blob with a 44-byte header
6. Each output WAV: max 9,600,000 * 2 bytes = 18.75MB — under Whisper's 25MB limit

- [ ] **Step 1: Create `lib/audio-chunker.js`**

```javascript
const CHUNK_DURATION_SECONDS = 600; // 10 minutes per chunk
const TARGET_SAMPLE_RATE = 16000;   // Whisper prefers 16kHz

/**
 * Decodes any audio file and splits it into WAV Blobs of up to 10 minutes each.
 * Uses browser's AudioContext — must be called from a user gesture or async context.
 *
 * @param {File|Blob} file - Any audio file (MP3, M4A, WAV, WebM, Ogg, etc.)
 * @returns {Promise<Blob[]>} Array of WAV Blobs, each under 25MB
 * @throws {Error} If the format cannot be decoded
 */
export async function decodeAndChunk(file) {
  const arrayBuffer = await file.arrayBuffer();

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    audioContext.close();
  }

  // Resample to 16kHz mono
  const totalOutputSamples = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(
    1,                    // mono
    totalOutputSamples,
    TARGET_SAMPLE_RATE
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampled = await offlineCtx.startRendering();
  const pcmData = resampled.getChannelData(0); // Float32Array

  // Split into chunks
  const samplesPerChunk = CHUNK_DURATION_SECONDS * TARGET_SAMPLE_RATE;
  const numChunks = Math.ceil(pcmData.length / samplesPerChunk);
  const chunks = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, pcmData.length);
    const chunkSamples = pcmData.slice(start, end);
    chunks.push(encodeWav(chunkSamples, TARGET_SAMPLE_RATE));
  }

  return chunks;
}

/**
 * Encodes a Float32Array of mono PCM samples as a WAV Blob.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {Blob}
 */
function encodeWav(samples, sampleRate) {
  const numSamples = samples.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);           // chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples: float32 [-1, 1] → int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la /Users/caesardriessen/Desktop/Github/oyaa/lib/audio-chunker.js
```

Expected: file exists, size > 1KB.

- [ ] **Step 3: Verify build still passes**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | tail -5
```

Expected: no errors (this file is not imported yet, so it won't affect the build).

- [ ] **Step 4: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add lib/audio-chunker.js
git commit -m "feat: add audio-chunker — browser-side AudioContext decode + WAV chunking"
```

---

## Task 3: Create storage-upload.js

**Files:**
- Create: `lib/storage-upload.js`

Uploads a WAV Blob to Supabase Storage `audio-temp` bucket using the browser anon key. Returns the storage path. The anon key has INSERT-only access (set up in Supabase dashboard).

- [ ] **Step 1: Create `lib/storage-upload.js`**

```javascript
import { createClient } from './supabase-browser';

const BUCKET = 'audio-temp';

/**
 * Uploads a WAV Blob to Supabase Storage audio-temp bucket.
 *
 * @param {Blob} wavBlob
 * @param {string} sessionId - UUID for this upload session (groups chunks together)
 * @param {number} chunkIndex - Zero-based chunk index
 * @returns {Promise<string>} Storage path, e.g. "abc123/0.wav"
 * @throws {Error} If upload fails
 */
export async function uploadChunk(wavBlob, sessionId, chunkIndex) {
  const supabase = createClient();
  const path = `${sessionId}/${chunkIndex}.wav`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, wavBlob, {
      contentType: 'audio/wav',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload mislukt (deel ${chunkIndex + 1}): ${error.message}`);
  }

  return path;
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la /Users/caesardriessen/Desktop/Github/oyaa/lib/storage-upload.js
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add lib/storage-upload.js
git commit -m "feat: add storage-upload — chunk upload to Supabase Storage audio-temp"
```

---

## Task 4: Update /api/transcribe route

**Files:**
- Modify: `app/api/transcribe/route.js`

Add:
- `export const maxDuration = 300` — required for Vercel Pro, allows 5-minute serverless execution
- A JSON path: accepts `{ storagePath }`, downloads from Supabase Storage using service role key, sends to Whisper, deletes the chunk, returns `{ transcript }`
- Specific error messages for each failure mode
- The existing multipart path (fast path for live recordings) stays intact

- [ ] **Step 1: Read the current file**

```bash
cat /Users/caesardriessen/Desktop/Github/oyaa/app/api/transcribe/route.js
```

- [ ] **Step 2: Replace the file with the updated version**

Full content of `app/api/transcribe/route.js`:

```javascript
import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase-server';

export const maxDuration = 300;

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/wav', 'audio/wave', 'audio/ogg',
  'audio/webm', 'video/mp4', 'video/webm',
];
const ALLOWED_EXTS = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.webm'];
const MAX_DIRECT_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return handleStoragePath(request);
  }
  return handleDirectUpload(request);
}

// ── Storage path (chunked file uploads) ────────────────────────────────────

async function handleStoragePath(request) {
  let storagePath;
  try {
    const body = await request.json();
    storagePath = body.storagePath;
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!storagePath || typeof storagePath !== 'string') {
    return Response.json({ error: 'Geen storagePath ontvangen.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Download chunk from Supabase Storage
  let fileBlob;
  try {
    const { data, error } = await supabase.storage
      .from('audio-temp')
      .download(storagePath);
    if (error) throw error;
    fileBlob = data;
  } catch (err) {
    console.error('Storage download error:', err);
    return Response.json(
      { error: 'Kon het audiobestand niet ophalen. Probeer opnieuw.' },
      { status: 502 }
    );
  }

  // Send to Whisper
  let transcript;
  try {
    const file = new File([fileBlob], 'chunk.wav', { type: 'audio/wav' });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'nl',
    });
    transcript = result.text;
  } catch (err) {
    console.error('Whisper error:', err);
    // Best-effort cleanup before returning error
    await supabase.storage.from('audio-temp').remove([storagePath]).catch(() => {});
    return Response.json(
      { error: 'Er is een fout bij OpenAI. Probeer het opnieuw.' },
      { status: 502 }
    );
  }

  // Clean up temp file
  await supabase.storage.from('audio-temp').remove([storagePath]).catch((err) => {
    console.error('Storage cleanup error (non-fatal):', err);
  });

  return Response.json({ transcript });
}

// ── Direct upload (fast path for live recordings) ──────────────────────────

async function handleDirectUpload(request) {
  let file;
  try {
    const formData = await request.formData();
    file = formData.get('file');
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: 'Geen audiobestand ontvangen.' }, { status: 400 });
  }

  if (file.size > MAX_DIRECT_SIZE) {
    return Response.json(
      { error: 'Bestand is te groot. Maximum is 25MB voor directe upload.' },
      { status: 400 }
    );
  }

  const name = file.name?.toLowerCase() || '';
  const ext = name.slice(name.lastIndexOf('.'));
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) {
    return Response.json(
      { error: `Bestandstype "${ext || file.type}" wordt niet ondersteund.` },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'nl',
    });
    return Response.json({ transcript: result.text });
  } catch (err) {
    console.error('Whisper error (direct upload):', err);
    return Response.json(
      { error: 'Er is een fout bij OpenAI. Probeer het opnieuw.' },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`. If there's an import error for `@/lib/supabase-server`, check that Task 1 was completed.

- [ ] **Step 4: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add app/api/transcribe/route.js
git commit -m "feat: transcribe route — storage path support, maxDuration 300, specific errors"
```

---

## Task 5: Update use-audio.js with chunking path

**Files:**
- Modify: `lib/use-audio.js`

Changes:
- `transcribeFile(file, isLiveRecording = false)` — add optional second parameter
- If `isLiveRecording === true`: use existing fast path (direct POST with FormData)
- If `isLiveRecording === false` (file upload): use chunking path
- Update the MediaRecorder `onstop` handler to pass `true` as second argument
- Add progress callbacks via `onStatus`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/caesardriessen/Desktop/Github/oyaa/lib/use-audio.js
```

- [ ] **Step 2: Write the updated file**

Full content of `lib/use-audio.js`:

```javascript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { decodeAndChunk } from './audio-chunker';
import { uploadChunk } from './storage-upload';

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.webm'];

export function isAudioFile(file) {
  const name = file.name?.toLowerCase() || '';
  const ext = name.slice(name.lastIndexOf('.'));
  return AUDIO_EXTENSIONS.includes(ext) || file.type?.startsWith('audio/');
}

export function useAudioTranscription({ onTranscript, onStatus, onError }) {
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastRecordingUrl, setLastRecordingUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Timer logic
  useEffect(() => {
    if (recording && !paused) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording, paused]);

  /**
   * Transcribes an audio file.
   *
   * @param {File} file
   * @param {boolean} isLiveRecording - true for MediaRecorder blobs (fast path),
   *                                    false for file uploads (chunking path)
   */
  const transcribeFile = useCallback(async (file, isLiveRecording = false) => {
    setTranscribing(true);

    try {
      if (isLiveRecording) {
        // Fast path: small live recording, direct POST
        onStatus?.('Je opname wordt verwerkt...');
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.error) {
          onError?.(data.error);
        } else {
          onTranscript?.(data.transcript);
          onStatus?.('Opname getranscribeerd.');
        }
        return;
      }

      // Chunking path: file upload of any size
      onStatus?.('Bestand voorbereiden...');

      let chunks;
      try {
        chunks = await decodeAndChunk(file);
      } catch {
        onError?.('Bestandsformaat wordt niet ondersteund. Gebruik MP3, M4A, WAV, WebM of Ogg.');
        return;
      }

      const totalChunks = chunks.length;
      const sessionId = crypto.randomUUID();
      const transcripts = [];

      if (totalChunks > 1) {
        onStatus?.(`Bestand opgesplitst in ${totalChunks} delen. Start verwerking...`);
      }

      for (let i = 0; i < totalChunks; i++) {
        onStatus?.(
          totalChunks === 1
            ? 'Bestand wordt verwerkt...'
            : `Deel ${i + 1} van ${totalChunks} verwerkt...`
        );

        // Upload chunk to Supabase Storage
        let storagePath;
        try {
          storagePath = await uploadChunk(chunks[i], sessionId, i);
        } catch (err) {
          onError?.(`Upload mislukt bij deel ${i + 1}. Controleer je verbinding.`);
          return;
        }

        // Transcribe chunk via API
        let data;
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storagePath }),
          });
          data = await res.json();
        } catch {
          onError?.('Netwerkfout bij transcriptie. Controleer je verbinding.');
          return;
        }

        if (data.error) {
          onError?.(data.error);
          return;
        }

        transcripts.push(data.transcript);
      }

      const combined = transcripts.join(' ');
      onTranscript?.(combined);
      onStatus?.(
        totalChunks === 1
          ? `"${file.name}" getranscribeerd.`
          : `"${file.name}" getranscribeerd in ${totalChunks} delen.`
      );
    } finally {
      setTranscribing(false);
    }
  }, [onTranscript, onStatus, onError]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const ext = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const file = new File([blob], `opname.${ext}`, { type: mediaRecorder.mimeType });

        const url = URL.createObjectURL(blob);
        setLastRecordingUrl(url);

        // Live recordings use fast path (isLiveRecording = true)
        await transcribeFile(file, true);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
      setPaused(false);
      setElapsed(0);
      setLastRecordingUrl(null);
    } catch {
      onError?.('Geen toegang tot de microfoon. Geef toestemming in je browser.');
    }
  }, [transcribeFile, onError]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setPaused(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' ||
        mediaRecorderRef.current.state === 'paused')
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setPaused(false);
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };
      if (
        mediaRecorderRef.current.state === 'recording' ||
        mediaRecorderRef.current.state === 'paused'
      ) {
        mediaRecorderRef.current.stop();
      }
    }
    chunksRef.current = [];
    setRecording(false);
    setPaused(false);
    setElapsed(0);
    onStatus?.(null);
  }, [onStatus]);

  const toggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  return {
    transcribing,
    recording,
    paused,
    elapsed,
    lastRecordingUrl,
    transcribeFile,
    toggleRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    isProcessing: transcribing || false,
  };
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`. If there are import errors, check that `lib/audio-chunker.js` and `lib/storage-upload.js` from Tasks 2 and 3 exist.

- [ ] **Step 4: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add lib/use-audio.js
git commit -m "feat: use-audio — chunking path for file uploads, fast path for live recordings"
```

---

## Task 6: Smoke test all three file sizes

No automated test framework is set up. Run manual tests with `npm run dev` and the browser.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run dev
```

Open `http://localhost:3000` in Chrome (AudioContext has best support there).

- [ ] **Step 2: Test small file (1MB, <1 min)**

Upload any small MP3 or M4A (voice note, <1 minute).

Expected:
- Status shows "Bestand wordt verwerkt..."
- Transcript appears within 15 seconds
- No chunk progress shown (1 chunk, 1 call)
- Console (Network tab): 1 POST to `/api/transcribe` with JSON body

- [ ] **Step 3: Test medium file (~15MB, ~15 min)**

Upload a 15-minute MP3 or M4A recording.

Expected:
- Status shows "Bestand wordt verwerkt..." (single chunk, under 18.75MB)
- Transcript appears within 60 seconds
- Console: 1 POST to `/api/transcribe` with JSON body
- Supabase Storage `audio-temp` bucket: file appears briefly then disappears

- [ ] **Step 4: Test large file (~50MB, ~50 min)**

Upload a 50-minute recording. Use any format (MP3, M4A, WAV, WebM).

Expected:
- Status shows "Bestand opgesplitst in X delen. Start verwerking..."
- Status updates: "Deel 1 van X verwerkt...", "Deel 2 van X verwerkt...", etc.
- Full transcript appears after 3-5 minutes
- Console: X POST requests to `/api/transcribe` (one per chunk)
- No 413 or 500 errors

- [ ] **Step 5: Test live recording (fast path unchanged)**

Use the microphone recording feature (click the mic button). Record ~30 seconds.

Expected:
- Status shows "Je opname wordt verwerkt..."
- Transcript appears within 15 seconds
- Console: 1 POST to `/api/transcribe` with `multipart/form-data` (old format)
- No chunking or Supabase Storage involved

- [ ] **Step 6: Verify error messages**

Try uploading a `.txt` file.

Expected: error message "Bestandstype ... wordt niet ondersteund." (not a generic 500).

---

## Task 7: Deploy

- [ ] **Step 1: Verify SUPABASE_SERVICE_ROLE_KEY is in Vercel**

Go to Vercel dashboard → Project → Settings → Environment Variables. Confirm `SUPABASE_SERVICE_ROLE_KEY` is present. (This was done before the implementation started, but double-check.)

- [ ] **Step 2: Push to GitHub**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git log --oneline -5
git push origin main
```

Expected: Vercel automatically starts a deployment.

- [ ] **Step 3: Monitor Vercel build**

Check Vercel dashboard for the new deployment. Wait for "Ready" status.

- [ ] **Step 4: Smoke test on production URL**

Test on `allday.waybetter.nl` (or the relevant tenant URL):
- Upload a small file: transcript within 15s
- Upload a 50-min file: transcript within 5 min with progress messages

- [ ] **Step 5: Done**

All three scenarios from the spec success criteria should now pass:
- 1MB file: <30s, single chunk
- 15MB file (~15 min): <60s, single chunk
- 60MB file (~50 min): 3-5 min, multiple chunks, progress visible

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Vercel body limit bypass via Supabase Storage | Tasks 3, 4, 5 |
| Chunking: browser AudioContext decode | Task 2 |
| 10-min WAV chunks at 16kHz mono (~18.75MB each) | Task 2 |
| Upload chunks to audio-temp bucket | Task 3 |
| Server downloads using service role key | Tasks 1, 4 |
| Server deletes temp files after transcription | Task 4 |
| maxDuration = 300 on transcribe route | Task 4 |
| Fast path for live recordings unchanged | Task 5 |
| Specific error messages (not generic 500) | Tasks 4, 5 |
| Progress indicator per chunk | Task 5 |
| `SUPABASE_SERVICE_ROLE_KEY` new env var | Pre-condition (done) |
| Supabase bucket + RLS policy | Pre-condition (done) |
| Smoke test 1MB, 15MB, 50min | Task 6 |
| Deploy to production | Task 7 |
