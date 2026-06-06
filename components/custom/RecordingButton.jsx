// components/custom/RecordingButton.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Square, X } from 'lucide-react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// state: idle | recording | client-selection | done
export default function RecordingButton({ onRecordingStart, onRecordingComplete }) {
  const [uiState, setUiState] = useState('idle');
  const [timer, setTimer] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const timerRef = useRef(null);
  const popupRef = useRef(null);
  const transcribingRef = useRef(false);
  const pendingBlobRef = useRef(null); // { blob, mimeType, filename }
  const [clientPickerValue, setClientPickerValue] = useState('');
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientInput, setNewClientInput] = useState('');
  const [knownClients, setKnownClients] = useState([]);

  useEffect(() => {
    async function fetchClients() {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data } = await supabase.from('threads').select('client').not('client', 'is', null).order('client');
      if (data) setKnownClients([...new Set(data.map(r => r.client).filter(Boolean))]);
    }
    fetchClients();
  }, []);

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

  async function uploadAndTranscribe(blob, mimeType, filename, client = null) {
    if (transcribingRef.current) return;
    transcribingRef.current = true;

    try {
      const audioFile = new File([blob], filename, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', audioFile);
      if (client) formData.append('client', client);
      formData.append('project', 'Audiobestanden');

      const res = await fetch('/api/create-recording-thread', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.error) {
        setStatusMsg('Fout: ' + data.error);
        setTimeout(() => setStatusMsg(''), 4000);
        return;
      }

      onRecordingComplete?.({ threadId: data.threadId, title: data.title, transcript: data.transcript, audioUrl: data.audioUrl ?? null });
    } catch {
      setStatusMsg('Netwerkfout bij transcriptie.');
      setTimeout(() => setStatusMsg(''), 4000);
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

  function handleClientConfirm(skip = false) {
    const { blob, mimeType, filename } = pendingBlobRef.current || {};
    if (!blob) return;
    const useTextInput = showNewClientInput || knownClients.length === 0;
  const client = skip ? null : (useTextInput ? newClientInput.trim() || null : clientPickerValue || null);
    setUiState('idle');
    onRecordingStart?.();
    uploadAndTranscribe(blob, mimeType, filename, client);
  }

  const isRecording = uiState === 'recording';

  return (
    <div className="relative flex items-center">
      {/* Hoofd opname-knop */}
      <button
        onClick={() => { if (uiState === 'idle') startMicRecording(); }}
        className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
          isRecording
            ? 'bg-transparent border-2 border-orange text-white cursor-default'
            : 'bg-orange text-white hover:bg-[#e03d00]'
        }`}
        title={isRecording ? 'Opname bezig' : 'Opname starten'}
      >
        {isRecording ? (
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

      {/* Recording popup: timer + stop */}
      {uiState === 'recording' && (
        <div
          ref={popupRef}
          className="absolute top-12 right-0 z-[200] w-56 bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl p-4"
        >
          <p className="text-[12px] text-white/50 mb-3">
            {formatTime(timer)} opgenomen
          </p>
          <button
            onClick={stopMicRecording}
            className="w-full h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Square className="w-3.5 h-3.5" strokeWidth={2} />
            Stop opname
          </button>
          <p className="text-[11px] text-white/30 text-center mt-2">
            Opname loopt, stop wanneer je klaar bent.
          </p>
        </div>
      )}

      {/* Klantkeuze na stoppen opname */}
      {uiState === 'client-selection' && (
        <div
          ref={popupRef}
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

      {/* Foutmelding */}
      {statusMsg && (
        <div className="absolute top-12 right-0 z-[200] w-72 bg-[#1a1a1a] border border-white/[0.10] rounded-xl shadow-xl px-4 py-3 text-[12px] text-white/60">
          {statusMsg}
          <button onClick={() => setStatusMsg('')} className="absolute top-2 right-2 text-white/25 hover:text-white/60">
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
