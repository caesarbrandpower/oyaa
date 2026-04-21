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
  const [lastRecordingFilename, setLastRecordingFilename] = useState(null);
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

        const ext = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const file = new File([blob], `opname.${ext}`, { type: mediaRecorder.mimeType });

        const url = URL.createObjectURL(blob);
        setLastRecordingUrl(url);
        setLastRecordingFilename(`opname.${ext}`);

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
      };
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
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
    lastRecordingFilename,
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
