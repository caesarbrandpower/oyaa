// components/custom/ChatInput.jsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Paperclip, ArrowUp, X, FileText, Image as ImageIcon, Mic, Square, Mic2 } from 'lucide-react';
import { useAudioTranscription, isAudioFile } from '@/lib/use-audio';

const TEXT_EXTS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.eml'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function isTextFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return TEXT_EXTS.includes(ext);
}

function isImageFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

export default function ChatInput({ onSend, disabled, prefill, onTranscriptReady }) {
  const [value, setValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const pendingAudioIdRef = useRef(null);
  const pendingAudioFilenameRef = useRef(null);
  const [transcriptBarProgress, setTranscriptBarProgress] = useState(-1); // -1 = verborgen, 0-100 = actief
  const barIntervalRef = useRef(null);

  const { transcribing, transcribeFile, recording, toggleRecording, cancelTranscription } = useAudioTranscription({
    onTranscript: (text) => {
      const id = pendingAudioIdRef.current;
      if (id) {
        // Audio via paperclip → sla op als transcript-attachment
        clearInterval(barIntervalRef.current);
        setTranscriptBarProgress(100);
        setTimeout(() => setTranscriptBarProgress(-1), 500);
        const filename = pendingAudioFilenameRef.current;
        setPendingAttachments((prev) =>
          prev.map((a) => a.id === id ? { ...a, content: text, status: 'ready' } : a)
        );
        pendingAudioIdRef.current = null;
        pendingAudioFilenameRef.current = null;
        onTranscriptReady?.(text, filename);
      } else {
        // Inline mic-dictatie → gewoon in textarea
        setValue((prev) => (prev ? prev + ' ' + text : text));
      }
    },
    onStatus: () => {},
    onError: (err) => {
      const id = pendingAudioIdRef.current;
      if (id) {
        clearInterval(barIntervalRef.current);
        setTranscriptBarProgress(-1);
        setPendingAttachments((prev) =>
          prev.map((a) => a.id === id ? { ...a, status: 'error' } : a)
        );
        pendingAudioIdRef.current = null;
      }
      console.error('[ChatInput audio error]', err);
    },
  });

  // Simuleer voortgangsbalk tijdens transcriberen
  useEffect(() => {
    if (transcribing && pendingAudioIdRef.current) {
      setTranscriptBarProgress(0);
      barIntervalRef.current = setInterval(() => {
        setTranscriptBarProgress((prev) => {
          if (prev < 0) return 0;
          const remaining = 85 - prev;
          return prev + Math.max(0.15, remaining * 0.012);
        });
      }, 500);
    } else {
      clearInterval(barIntervalRef.current);
    }
    return () => clearInterval(barIntervalRef.current);
  }, [transcribing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  useEffect(() => {
    if (prefill?.text) {
      setValue(prefill.text);
      textareaRef.current?.focus();
    }
  }, [prefill]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = value.trim();
    const readyAttachments = pendingAttachments.filter((a) => a.status === 'ready');
    if ((!trimmed && readyAttachments.length === 0) || disabled || transcribing) return;

    const textAtts = readyAttachments.filter((a) => a.type === 'text');
    const imageAtts = readyAttachments.filter((a) => a.type === 'image');
    const transcriptAtts = readyAttachments.filter((a) => a.type === 'transcript');

    let fullText = trimmed;
    for (const att of textAtts) {
      fullText += `\n\n[Bijlage: ${att.filename}]\n${att.content}`;
    }
    for (const att of transcriptAtts) {
      fullText += `\n\n[Transcript: ${att.filename}]\n${att.content}`;
    }

    onSend(fullText || readyAttachments.map((a) => a.filename).join(', '), {
      imageAttachments: imageAtts.map((a) => ({
        filename: a.filename,
        mediaType: a.mediaType,
        data: a.content,
      })),
      transcriptAttachments: transcriptAtts.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    setValue('');
    setPendingAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  async function processFiles(files) {

    for (const file of files) {
      if (isAudioFile(file)) {
        const id = Math.random().toString(36).slice(2);
        pendingAudioIdRef.current = id;
        pendingAudioFilenameRef.current = file.name;
        setPendingAttachments((prev) => [
          ...prev,
          { id, filename: file.name, type: 'transcript', content: '', status: 'loading' },
        ]);
        transcribeFile(file, false);
        continue;
      }

      const id = Math.random().toString(36).slice(2);

      if (isImageFile(file)) {
        setPendingAttachments((prev) => [
          ...prev,
          { id, filename: file.name, type: 'image', content: '', mediaType: file.type || 'image/jpeg', status: 'loading' },
        ]);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target.result.split(',')[1];
          setPendingAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, content: base64, status: 'ready' } : a))
          );
        };
        reader.onerror = () =>
          setPendingAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: 'error' } : a))
          );
        reader.readAsDataURL(file);
        continue;
      }

      if (isTextFile(file)) {
        setPendingAttachments((prev) => [
          ...prev,
          { id, filename: file.name, type: 'text', content: '', status: 'loading' },
        ]);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/extract-text', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setPendingAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, content: data.text, status: 'ready' } : a))
          );
        } catch {
          setPendingAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: 'error' } : a))
          );
        }
        continue;
      }
    }
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) processFiles(files);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) processFiles(files);
  }

  function removeAttachment(id) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function cancelTranscriptUpload(id) {
    cancelTranscription();
    clearInterval(barIntervalRef.current);
    setTranscriptBarProgress(-1);
    pendingAudioIdRef.current = null;
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  const canSend =
    (value.trim().length > 0 || pendingAttachments.some((a) => a.status === 'ready')) &&
    !disabled &&
    !transcribing;

  return (
    <div
      className="relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
      onDrop={handleDrop}
    >
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingAttachments.map((att) => (
            <div key={att.id} className="flex flex-col gap-0.5">
              <div
                className={`flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  att.status === 'error'
                    ? 'bg-red-950/40 border-red-800/40 text-red-400'
                    : att.status === 'loading'
                    ? 'bg-orange/[0.08] border-orange/[0.35] text-orange/80 animate-pulse'
                    : 'bg-white/[0.06] border-white/[0.12] text-white/65'
                }`}
              >
                {att.type === 'image' ? (
                  <ImageIcon className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                ) : att.type === 'transcript' ? (
                  <Mic2 className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                ) : (
                  <FileText className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                )}
                <span className="max-w-[160px] truncate">
                  {att.status === 'loading'
                    ? (att.type === 'transcript' ? 'Transcriberen...' : 'Uitlezen...')
                    : att.status === 'error' ? 'Mislukt'
                    : att.filename}
                </span>
                {att.type === 'transcript' && att.status === 'loading' ? (
                  <button
                    onClick={() => cancelTranscriptUpload(att.id)}
                    className="ml-0.5 text-white/25 hover:text-white/60 transition-colors"
                    title="Annuleren"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                ) : att.status !== 'loading' ? (
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="ml-0.5 text-white/25 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              {/* Progress bar onder transcript-pill tijdens laden */}
              {att.type === 'transcript' && att.status === 'loading' && transcriptBarProgress >= 0 && (
                <div className="h-0.5 bg-white/[0.08] rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-orange/60 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, transcriptBarProgress)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={`flex items-end gap-2 rounded-2xl px-4 py-3 transition-colors ${
        isDragOver
          ? 'bg-orange/[0.06] border border-orange/40'
          : 'bg-white/[0.04] border border-white/[0.10] focus-within:border-white/[0.20]'
      }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={transcribing ? 'Opname wordt verwerkt...' : recording ? 'Aan het dicteren...' : 'Stel een vraag, geef een opdracht of sleep een bestand hierin...'}
          disabled={disabled || transcribing}
          rows={1}
          className="flex-1 bg-transparent text-[14px] text-white placeholder-white/25 resize-none outline-none leading-relaxed max-h-[200px] py-1"
        />

        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled || transcribing}
            title={recording ? 'Stop dicteren' : 'Dicteren'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              recording
                ? 'text-red-400 bg-red-950/30 hover:bg-red-950/50'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'
            }`}
          >
            {recording
              ? <Square className="w-3.5 h-3.5" strokeWidth={2} />
              : <Mic className="w-4 h-4" strokeWidth={1.75} />
            }
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || transcribing}
            title="Bestand toevoegen (audio, PDF, DOCX, TXT, EML, afbeelding)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Paperclip className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.eml,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange text-white hover:bg-[#e03d00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {transcribing && (
        <p className="text-[11px] text-white/30 mt-1.5 ml-1">Wordt getranscribeerd — dit kan even duren...</p>
      )}
    </div>
  );
}
