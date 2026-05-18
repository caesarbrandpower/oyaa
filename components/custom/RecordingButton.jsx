// components/custom/RecordingButton.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Monitor, Square, X } from 'lucide-react';
import { useAudioTranscription } from '@/lib/use-audio';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// state: idle | choosing | recording | stopping | transcribing
export default function RecordingButton() {
  const router = useRouter();
  const [uiState, setUiState] = useState('idle');
  const [recordingMode, setRecordingMode] = useState(null); // 'mic' | 'screen'
  const [timer, setTimer] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [blobRef] = useState({ current: null });
  const timerRef = useRef(null);
  const popupRef = useRef(null);
  const stopPopupRef = useRef(null);
  const transcribingRef = useRef(false);

  // Sluit popup bij klik buiten
  useEffect(() => {
    if (uiState !== 'choosing') return;
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setUiState('idle');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [uiState]);

  useEffect(() => {
    if (uiState !== 'stopping') return;
    function handleClick(e) {
      if (stopPopupRef.current && !stopPopupRef.current.contains(e.target)) {
        setUiState('recording');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [uiState]);

  // Timer tick
  useEffect(() => {
    if (uiState === 'recording') {
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [uiState]);

  async function uploadAndTranscribe(blob, mimeType, filename) {
    if (transcribingRef.current) return;
    transcribingRef.current = true;
    setUiState('transcribing');
    setStatusMsg('Transcript maken...');

    try {
      const audioFile = new File([blob], filename, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', audioFile);

      const res = await fetch('/api/create-recording-thread', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.error) {
        setStatusMsg('Fout: ' + data.error);
        setTimeout(() => { setUiState('idle'); setStatusMsg(''); }, 3000);
        return;
      }

      setUiState('idle');
      setStatusMsg('');
      // Open de nieuwe thread in de chat
      router.push('/app?thread=' + data.threadId);
    } catch {
      setStatusMsg('Netwerkfout bij transcriptie.');
      setTimeout(() => { setUiState('idle'); setStatusMsg(''); }, 3000);
    } finally {
      transcribingRef.current = false;
    }
  }

  // --- Microfoon opname ---
  const micRecorderRef = useRef(null);
  const micChunksRef = useRef([]);
  const micStreamRef = useRef(null);

  async function startMicRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      micChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) micChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(micChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        uploadAndTranscribe(blob, mimeType, `opname.${ext}`);
      };
      micRecorderRef.current = recorder;
      recorder.start();
      setRecordingMode('mic');
      setUiState('recording');
    } catch {
      setStatusMsg('Geen microfoon-toegang. Geef toestemming in je browser.');
      setTimeout(() => { setUiState('idle'); setStatusMsg(''); }, 3000);
    }
  }

  function stopMicRecording() {
    if (micRecorderRef.current?.state === 'recording') {
      micRecorderRef.current.stop();
    }
  }

  // --- Schermopname (tab + mic gemixed) ---
  const screenRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);

  async function startScreenRecording() {
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      // Gebruiker heeft geannuleerd
      setUiState('idle');
      return;
    }

    const tabAudioTracks = displayStream.getAudioTracks();
    displayStream.getVideoTracks().forEach((t) => t.stop());

    if (tabAudioTracks.length === 0) {
      setStatusMsg('Geen audio geselecteerd. Vink "Audio delen" aan bij het kiezen van het tabblad.');
      displayStream.getTracks().forEach((t) => t.stop());
      setTimeout(() => { setUiState('idle'); setStatusMsg(''); }, 4000);
      return;
    }

    // Microfoon erbij mixen
    let micStream = null;
    let micWarning = false;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Safari of geen microfoon — tab-audio only
      micWarning = true;
    }

    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();

    const tabSource = audioCtx.createMediaStreamSource(new MediaStream(tabAudioTracks));
    tabSource.connect(dest);

    if (micStream) {
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(dest);
    }

    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
      .find((t) => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
    const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';

    const recorder = new MediaRecorder(dest.stream, { mimeType });
    screenChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) screenChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      tabAudioTracks.forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      const blob = new Blob(screenChunksRef.current, { type: mimeType });
      uploadAndTranscribe(blob, mimeType, `videocall.${ext}`);
    };

    // Stop als gebruiker tab-share beëindigt via browser UI
    tabAudioTracks[0].onended = () => {
      if (screenRecorderRef.current?.state === 'recording') {
        screenRecorderRef.current.stop();
        setUiState('transcribing');
      }
    };

    screenRecorderRef.current = recorder;
    recorder.start();
    setRecordingMode('screen');
    setUiState('recording');

    if (micWarning) {
      setStatusMsg('Microfoon wordt niet gemixed in Safari — gebruik Chrome voor de beste kwaliteit.');
      setTimeout(() => setStatusMsg(''), 5000);
    }
  }

  function stopScreenRecording() {
    if (screenRecorderRef.current?.state === 'recording') {
      screenRecorderRef.current.stop();
    }
  }

  function handleStopConfirm() {
    if (recordingMode === 'mic') stopMicRecording();
    else stopScreenRecording();
    setUiState('transcribing');
  }

  const isRecording = uiState === 'recording';
  const isTranscribing = uiState === 'transcribing';

  return (
    <div className="relative flex items-center" style={{ zoom: `${1 / 1.1}` }}>
      {/* Hoofd opname-knop */}
      <button
        onClick={() => {
          if (uiState === 'idle') setUiState('choosing');
          else if (uiState === 'choosing') setUiState('idle');
          else if (uiState === 'recording') setUiState('stopping');
          else if (uiState === 'stopping') setUiState('recording');
        }}
        disabled={isTranscribing}
        className={`relative flex items-center justify-center rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isRecording
            ? 'w-10 h-10 bg-red-600 shadow-lg shadow-red-900/40 animate-pulse'
            : isTranscribing
            ? 'w-10 h-10 bg-orange/60'
            : 'w-9 h-9 bg-red-600 hover:bg-red-500 shadow-md shadow-red-900/30 hover:shadow-red-900/50'
        }`}
        title={isRecording ? 'Opname bezig — klik voor opties' : 'Opname starten'}
      >
        {isTranscribing ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : isRecording ? (
          <span className="text-[11px] font-bold text-white tabular-nums leading-none">
            {formatTime(timer)}
          </span>
        ) : (
          <span className="block w-3.5 h-3.5 rounded-full bg-white" />
        )}
      </button>

      {/* Keuze-popup: Gesprek / Videocall */}
      {uiState === 'choosing' && (
        <div
          ref={popupRef}
          className="absolute top-12 right-0 z-[200] w-64 bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl p-3 space-y-2"
        >
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 pb-1">
            Wat wil je opnemen?
          </p>
          <button
            onClick={() => { setUiState('idle'); startMicRecording(); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-600/30 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 text-red-400" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Gesprek opnemen</p>
              <p className="text-[11px] text-white/35 mt-0.5">Microfoon</p>
            </div>
          </button>
          <button
            onClick={() => { setUiState('idle'); startScreenRecording(); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4 text-blue-400" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Videocall opnemen</p>
              <p className="text-[11px] text-white/35 mt-0.5">Tabblad + microfoon</p>
            </div>
          </button>
        </div>
      )}

      {/* Stop-popup */}
      {uiState === 'stopping' && (
        <div
          ref={stopPopupRef}
          className="absolute top-12 right-0 z-[200] w-56 bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl p-4"
        >
          <p className="text-[12px] text-white/50 mb-3">
            {formatTime(timer)} opgenomen
          </p>
          <button
            onClick={handleStopConfirm}
            className="w-full h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Square className="w-3.5 h-3.5" strokeWidth={2} />
            Stop opname
          </button>
          <button
            onClick={() => setUiState('recording')}
            className="w-full mt-2 text-center text-[11px] text-white/30 hover:text-white/60 transition-colors py-1"
          >
            Doorgaan
          </button>
        </div>
      )}

      {/* Statusbericht (bijv. Safari-waarschuwing) */}
      {statusMsg && (
        <div className="absolute top-12 right-0 z-[200] w-72 bg-[#1a1a1a] border border-white/[0.10] rounded-xl shadow-xl px-4 py-3 text-[12px] text-white/60">
          {statusMsg}
        </div>
      )}
    </div>
  );
}
