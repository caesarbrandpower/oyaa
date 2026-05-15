// components/custom/ChatInput.jsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Paperclip, ArrowUp, Square } from 'lucide-react';
import { useAudioTranscription, isAudioFile } from '@/lib/use-audio';

export default function ChatInput({ onSend, disabled, prefill }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { transcribing, recording, toggleRecording, transcribeFile } = useAudioTranscription({
    onTranscript: (text) => {
      setValue((prev) => (prev ? prev + ' ' + text : text));
    },
    onStatus: () => {},
    onError: (err) => console.error('[ChatInput audio error]', err),
  });

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  // Pre-fill vanuit buiten (bijv. na sluiten DocumentView)
  useEffect(() => {
    if (prefill) {
      setValue(prefill);
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
    if (!trimmed || disabled || transcribing) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (isAudioFile(file)) {
      transcribeFile(file, false);
    }
  }

  const canSend = value.trim().length > 0 && !disabled && !transcribing;

  return (
    <div className="relative">
      <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.10] rounded-2xl px-4 py-3 focus-within:border-white/[0.20] transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            transcribing
              ? 'Opname wordt verwerkt...'
              : recording
              ? 'Opname bezig...'
              : 'Schrijf of spreek je input...'
          }
          disabled={disabled || transcribing}
          rows={1}
          className="flex-1 bg-transparent text-[14px] text-white placeholder-white/25 resize-none outline-none leading-relaxed min-h-[24px] max-h-[200px]"
        />

        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          {/* Paperclip */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || transcribing || recording}
            title="Voeg audiobestand toe"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Paperclip className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm,audio/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Microfoon */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled || transcribing}
            title={recording ? 'Stop opname' : 'Start opname'}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              recording
                ? 'text-white bg-orange/80 hover:bg-orange'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'
            }`}
          >
            {recording ? (
              <Square className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <Mic className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>

          {/* Verzenden */}
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

      {(transcribing || recording) && (
        <p className="text-[11px] text-white/30 mt-1.5 ml-1">
          {transcribing ? 'Opname wordt omgezet naar tekst...' : 'Opname bezig. Klik stop als je klaar bent.'}
        </p>
      )}
    </div>
  );
}
