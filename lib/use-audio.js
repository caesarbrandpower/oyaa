'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

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

  const transcribeFile = useCallback(async (file) => {
    setTranscribing(true);
    onStatus?.('Je opname wordt verwerkt...');

    try {
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
        onStatus?.(`"${file.name}" getranscribeerd.`);
      }
    } catch {
      onError?.('Fout bij het transcriberen van het audiobestand.');
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

        // Create download URL
        const url = URL.createObjectURL(blob);
        setLastRecordingUrl(url);

        await transcribeFile(file);
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
