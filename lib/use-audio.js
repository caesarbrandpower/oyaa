'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { decodeAndChunk, blobToWav } from './audio-chunker';
import { uploadChunk } from './storage-upload';

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.webm'];

export function isAudioFile(file) {
  const name = file.name?.toLowerCase() || '';
  const ext = name.slice(name.lastIndexOf('.'));
  return AUDIO_EXTENSIONS.includes(ext) || file.type?.startsWith('audio/');
}

export function supportsScreenAudio() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
}

// A5 — filename with date-time
function recordingFilename(ext) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `${date}_${time}_waybetter-opname.${ext}`;
}

// A3 — favicon dot overlay
let _originalFavicon = null;
function setFaviconDot(active) {
  if (typeof document === 'undefined') return;
  const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
  link.rel = 'icon';
  if (active) {
    if (!_originalFavicon) _originalFavicon = link.href;
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      ctx.beginPath();
      ctx.arc(26, 6, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      link.href = canvas.toDataURL();
      document.head.appendChild(link);
    };
    img.onerror = () => {};
    img.src = _originalFavicon || '/favicon.ico';
  } else {
    if (_originalFavicon) {
      link.href = _originalFavicon;
      document.head.appendChild(link);
    }
  }
}

// A2 — RMS volume check
async function checkAudioVolume(blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    ctx.close();
    let sumSq = 0;
    let count = 0;
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) { sumSq += data[i] * data[i]; count++; }
    }
    return count > 0 ? Math.sqrt(sumSq / count) : 0;
  } catch {
    return 1; // if we can't check, assume ok
  }
}

export function useAudioTranscription({ onTranscript, onStatus, onError }) {
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastRecordingUrl, setLastRecordingUrl] = useState(null);
  const [lastRecordingFilename, setLastRecordingFilename] = useState(null);
  const [lastRecordingDuration, setLastRecordingDuration] = useState(0);
  const [screenRecording, setScreenRecording] = useState(false);
  const [screenElapsed, setScreenElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);
  const screenTimerRef = useRef(null);
  const recordingDurationRef = useRef(0);
  const screenDurationRef = useRef(0);

  // Mic recording timer
  useEffect(() => {
    if (recording && !paused) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          recordingDurationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording, paused]);

  // Screen recording timer
  useEffect(() => {
    if (screenRecording) {
      screenTimerRef.current = setInterval(() => {
        setScreenElapsed((prev) => {
          screenDurationRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(screenTimerRef.current);
    }
    return () => clearInterval(screenTimerRef.current);
  }, [screenRecording]);

  // A3 — tab title indicator
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (recording || screenRecording) {
      document.title = '\u23FA Opname bezig\u2026 \u2014 Waybetter';
    } else {
      document.title = 'Waybetter';
    }
  }, [recording, screenRecording]);

  // A4 — warn before unload during recording
  useEffect(() => {
    if (!recording && !screenRecording) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [recording, screenRecording]);

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

      console.log('[transcribeFile] decoded chunks:', chunks.length, 'file size:', file.size, 'bytes');
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
        } catch {
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

        console.log(`[transcribeFile] chunk ${i + 1}/${totalChunks} transcript length:`, data.transcript?.length ?? 'null', '| preview:', data.transcript?.slice(0, 80));
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
        mimeType: MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setFaviconDot(false);

        const mimeType = mediaRecorder.mimeType;
        const isWebM = mimeType.includes('webm');
        const ext = isWebM ? 'webm' : 'm4a';
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // A2 — volume check
        const rms = await checkAudioVolume(blob);
        if (rms < 0.01) {
          onError?.('De opname bevat geen hoorbaar geluid. Controleer of je microfoon correct is aangesloten.');
          setLastRecordingUrl(null);
          return;
        }

        // A5 — date-time filename
        const filename = recordingFilename(ext);
        const file = new File([blob], filename, { type: mimeType });

        // Set download URL immediately with original blob
        const initialUrl = URL.createObjectURL(blob);
        setLastRecordingUrl(initialUrl);
        setLastRecordingFilename(filename);
        setLastRecordingDuration(recordingDurationRef.current); // A6

        // Convert WebM to WAV in background for Mac compatibility
        if (isWebM) {
          blobToWav(blob).then((wavBlob) => {
            setLastRecordingUrl(URL.createObjectURL(wavBlob));
            setLastRecordingFilename(filename.replace('.webm', '.wav'));
          }).catch(() => {});
        }

        // Live recordings use fast path (isLiveRecording = true)
        await transcribeFile(file, true);
      };

      mediaRecorderRef.current = mediaRecorder;
      recordingDurationRef.current = 0;
      mediaRecorder.start();
      setFaviconDot(true);
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
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setPaused(false);
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      // Remove the onstop handler so it doesn't transcribe
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setFaviconDot(false);
      };
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.stop();
      } else {
        setFaviconDot(false);
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

  const startScreenRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onError?.('Je browser ondersteunt geen tab-opname. Gebruik Chrome of Edge.');
      return;
    }

    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      // User cancelled or permission denied — no error needed
      return;
    }

    const tabAudioTracks = displayStream.getAudioTracks();

    // Stop video tracks immediately — we only need audio
    displayStream.getVideoTracks().forEach((t) => t.stop());

    if (tabAudioTracks.length === 0) {
      onError?.('Geen audio geselecteerd. Vink "Audio delen" aan bij het kiezen van het tabblad.');
      return;
    }

    // Request microphone to capture the user's own voice.
    // Tab audio only contains what other participants play back — not the user's mic.
    let micStream = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Mic permission denied or unavailable — record tab-only (other participants)
    }

    setLastRecordingUrl(null);
    setLastRecordingFilename(null);

    // Mix tab audio + microphone into a single stream via Web Audio API
    const audioCtx = new AudioContext();
    const mixDestination = audioCtx.createMediaStreamDestination();

    const tabSource = audioCtx.createMediaStreamSource(new MediaStream(tabAudioTracks));
    tabSource.connect(mixDestination);

    if (micStream) {
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(mixDestination);
    }

    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
      .find((t) => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
    const isWebM = mimeType.includes('webm');
    const ext = isWebM ? 'webm' : 'm4a';

    const recorder = new MediaRecorder(mixDestination.stream, { mimeType });
    screenChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) screenChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      tabAudioTracks.forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      setFaviconDot(false);
      const blob = new Blob(screenChunksRef.current, { type: mimeType });
      console.log('[screen-recording] blob size:', blob.size, 'bytes, type:', blob.type, 'chunks:', screenChunksRef.current.length);
      const filename = recordingFilename(ext); // A5
      const file = new File([blob], filename, { type: mimeType });

      // Set download URL immediately so user can always access the recording
      setLastRecordingUrl(URL.createObjectURL(blob));
      setLastRecordingFilename(filename);
      setLastRecordingDuration(screenDurationRef.current); // A6

      // Convert WebM to WAV in background for Mac compatibility (Safari uses mp4 natively)
      if (isWebM) {
        blobToWav(blob).then((wavBlob) => {
          setLastRecordingUrl(URL.createObjectURL(wavBlob));
          setLastRecordingFilename(filename.replace('.webm', '.wav'));
        }).catch(() => {});
      }

      // Meeting recordings can be long — always use chunking path
      await transcribeFile(file, false);
    };

    // Stop recording if user ends the tab share via browser UI
    tabAudioTracks[0].onended = () => {
      if (screenRecorderRef.current?.state === 'recording') {
        screenRecorderRef.current.stop();
        setScreenRecording(false);
        setScreenElapsed(0);
      }
    };

    screenRecorderRef.current = recorder;
    screenDurationRef.current = 0;
    recorder.start();
    setFaviconDot(true);
    setScreenRecording(true);
    setScreenElapsed(0);
    onStatus?.(micStream ? 'Video-call opname gestart (tab + microfoon)...' : 'Video-call opname gestart (alleen tabblad-audio)...');
  }, [transcribeFile, onError, onStatus]);

  const stopScreenRecording = useCallback(() => {
    if (screenRecorderRef.current?.state === 'recording') {
      screenRecorderRef.current.stop();
    }
    setScreenRecording(false);
    setScreenElapsed(0);
  }, []);

  return {
    transcribing,
    recording,
    paused,
    elapsed,
    lastRecordingUrl,
    lastRecordingFilename,
    lastRecordingDuration,
    screenRecording,
    screenElapsed,
    transcribeFile,
    toggleRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    startScreenRecording,
    stopScreenRecording,
    isProcessing: transcribing || false,
  };
}
