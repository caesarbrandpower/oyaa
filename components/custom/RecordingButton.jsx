// components/custom/RecordingButton.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mic, Monitor, Square, X } from 'lucide-react';
import { useAudioTranscription } from '@/lib/use-audio';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// state: idle | choosing | recording | stopping | client-selection | transcribing | done
export default function RecordingButton() {
  const router = useRouter();
  const [uiState, setUiState] = useState('idle');
  const [recordingMode, setRecordingMode] = useState(null); // 'mic' | 'screen'
  const [timer, setTimer] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const timerRef = useRef(null);
  const popupRef = useRef(null);
  const stopPopupRef = useRef(null);
  const clientSelectionRef = useRef(null);
  const transcribingRef = useRef(false);
  const pendingBlobRef = useRef(null); // { blob, mimeType, filename }
  const [clientPickerValue, setClientPickerValue] = useState('');
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientInput, setNewClientInput] = useState('');
  const [knownClients, setKnownClients] = useState([]);
  const [successThread, setSuccessThread] = useState(null); // { id, title }

  useEffect(() => {
    async function fetchClients() {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data } = await supabase.from('threads').select('client').not('client', 'is', null).order('client');
      if (data) setKnownClients([...new Set(data.map(r => r.client).filter(Boolean))]);
    }
    fetchClients();
  }, []);

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

  useEffect(() => {
    if (uiState !== 'client-selection') return;
    function handleClick(e) {
      if (clientSelectionRef.current && !clientSelectionRef.current.contains(e.target)) {
        // Niet afsluiten — gebruiker moet een keuze maken of overslaan
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

  async function uploadAndTranscribe(blob, mimeType, filename, client = null, project = null) {
    if (transcribingRef.current) return;
    transcribingRef.current = true;
    setUiState('transcribing');
    setStatusMsg('Transcript maken...');

    try {
      const audioFile = new File([blob], filename, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', audioFile);
      if (client) formData.append('client', client);
      if (project) formData.append('project', project);

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

      setSuccessThread({ id: data.threadId, title: data.title });
      setUiState('done');
      setStatusMsg('');
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
        pendingBlobRef.current = { blob, mimeType, filename: `opname.${ext}` };
        setClientPickerValue('');
        setShowNewClientInput(false);
        setNewClientInput('');
        setUiState('client-selection');
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
      pendingBlobRef.current = { blob, mimeType, filename: `videocall.${ext}` };
      setClientPickerValue('');
      setShowNewClientInput(false);
      setNewClientInput('');
      setUiState('client-selection');
    };

    // Stop als gebruiker tab-share beëindigt via browser UI
    tabAudioTracks[0].onended = () => {
      if (screenRecorderRef.current?.state === 'recording') {
        screenRecorderRef.current.stop();
        // onstop callback handelt de state-transitie af
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
    // Stopt de recorder — onstop callback handelt de state-transitie naar 'client-selection' af
    if (recordingMode === 'mic') stopMicRecording();
    else stopScreenRecording();
  }

  function handleClientConfirm(skip = false) {
    const { blob, mimeType, filename } = pendingBlobRef.current || {};
    if (!blob) return;
    const client = skip ? null : (showNewClientInput ? newClientInput.trim() || null : clientPickerValue || null);
    uploadAndTranscribe(blob, mimeType, filename, client, 'Audiobestanden');
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
        }}
        disabled={isTranscribing}
        className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isRecording
            ? 'bg-transparent border-2 border-orange text-white'
            : isTranscribing
            ? 'bg-white/[0.04] border border-white/[0.08] text-white/30'
            : 'bg-orange text-white hover:bg-[#e03d00]'
        }`}
        title={isRecording ? 'Opname bezig — klik voor opties' : 'Opname starten'}
      >
        {isTranscribing ? (
          <>
            <div className="w-3 h-3 border-2 border-white/30 border-t-white/60 rounded-full animate-spin" />
            <span className="text-[12px] font-medium">Verwerken...</span>
          </>
        ) : isRecording ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-[12px] font-medium">Opname loopt...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span className="text-[12px] font-medium">Opnemen</span>
          </>
        )}
      </button>

      {/* Aparte stop-knop tijdens opname */}
      {(uiState === 'recording' || uiState === 'stopping') && (
        <button
          onClick={() => {
            if (uiState === 'recording') setUiState('stopping');
            else setUiState('recording');
          }}
          className="ml-1.5 w-7 h-7 rounded-full border border-white/[0.15] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors shrink-0"
          title="Opname stoppen"
        >
          <Square className="w-3 h-3" strokeWidth={2} />
        </button>
      )}

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
          <p className="text-[11px] text-white/30 text-center mt-2 py-1">
            Opname loopt, stop wanneer je klaar bent.
          </p>
        </div>
      )}

      {/* Klantkeuze na stoppen opname */}
      {uiState === 'client-selection' && (
        <div
          ref={clientSelectionRef}
          className="absolute top-12 right-0 z-[200] w-72 bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl p-4 space-y-3"
        >
          <p className="text-[12px] font-semibold text-white/70">Voor welke klant is deze opname?</p>
          {knownClients.length > 0 && !showNewClientInput && (
            <select
              value={clientPickerValue}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewClientInput(true);
                  setClientPickerValue('');
                } else {
                  setClientPickerValue(e.target.value);
                }
              }}
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded-lg px-3 py-2 text-[12px] text-white outline-none"
            >
              <option value="">— Selecteer klant —</option>
              {knownClients.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Nieuwe klant invoeren</option>
            </select>
          )}
          {(showNewClientInput || knownClients.length === 0) && (
            <input
              autoFocus
              value={newClientInput}
              onChange={(e) => setNewClientInput(e.target.value)}
              placeholder="Klantnaam..."
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-white/[0.25]"
            />
          )}
          <input
            value={projectPickerValue}
            onChange={(e) => setProjectPickerValue(e.target.value)}
            placeholder="Project — optioneel"
            className="w-full bg-white/[0.05] border border-white/[0.10] rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-white/[0.25]"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleClientConfirm(false)}
              className="flex-1 h-9 rounded-xl bg-orange text-white text-[12px] font-semibold hover:bg-[#e03d00] transition-colors"
            >
              Verwerken
            </button>
            <button
              onClick={() => handleClientConfirm(true)}
              className="h-9 px-3 rounded-xl border border-white/[0.10] text-white/40 text-[12px] hover:text-white/70 hover:bg-white/[0.05] transition-colors"
            >
              Overslaan
            </button>
          </div>
        </div>
      )}

      {/* Bevestiging na transcriptie */}
      {uiState === 'done' && successThread && (
        <div className="absolute top-12 right-0 z-[200] w-72 bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-semibold text-white/80 mb-0.5">Transcript klaar</p>
              <Link
                href={'/app?thread=' + successThread.id}
                onClick={() => { setUiState('idle'); setSuccessThread(null); }}
                className="text-[12px] text-orange hover:text-orange/80 transition-colors underline underline-offset-2"
              >
                Bekijk in {successThread.title}
              </Link>
            </div>
            <button
              onClick={() => { setUiState('idle'); setSuccessThread(null); }}
              className="text-white/25 hover:text-white/60 transition-colors shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
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
