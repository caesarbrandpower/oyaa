// components/custom/ChatInput.jsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Paperclip, ArrowUp, X, FileText, Image as ImageIcon, Mic, Square } from 'lucide-react';
import { useAudioTranscription, isAudioFile } from '@/lib/use-audio';

const TEXT_EXTS = ['.pdf', '.docx', '.txt', '.eml'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function isTextFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return TEXT_EXTS.includes(ext);
}

function isImageFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

export default function ChatInput({ onSend, disabled, prefill }) {
  const [value, setValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { transcribing, transcribeFile, recording, toggleRecording } = useAudioTranscription({
    onTranscript: (text) => setValue((prev) => (prev ? prev + ' ' + text : text)),
    onStatus: () => {},
    onError: (err) => console.error('[ChatInput audio error]', err),
  });

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

    let fullText = trimmed;
    for (const att of textAtts) {
      fullText += `\n\n[Bijlage: ${att.filename}]\n${att.content}`;
    }

    onSend(fullText || readyAttachments.map((a) => a.filename).join(', '), {
      imageAttachments: imageAtts.map((a) => ({
        filename: a.filename,
        mediaType: a.mediaType,
        data: a.content,
      })),
    });

    setValue('');
    setPendingAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    for (const file of files) {
      if (isAudioFile(file)) {
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

  function removeAttachment(id) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  const canSend =
    (value.trim().length > 0 || pendingAttachments.some((a) => a.status === 'ready')) &&
    !disabled &&
    !transcribing;

  return (
    <div className="relative">
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className={`flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                att.status === 'error'
                  ? 'bg-red-950/40 border-red-800/40 text-red-400'
                  : att.status === 'loading'
                  ? 'bg-white/[0.04] border-white/[0.08] text-white/35'
                  : 'bg-white/[0.06] border-white/[0.12] text-white/65'
              }`}
            >
              {att.type === 'image' ? (
                <ImageIcon className="w-3 h-3 shrink-0" strokeWidth={1.75} />
              ) : (
                <FileText className="w-3 h-3 shrink-0" strokeWidth={1.75} />
              )}
              <span className="max-w-[160px] truncate">
                {att.status === 'loading' ? 'Laden...' : att.status === 'error' ? 'Mislukt' : att.filename}
              </span>
              {att.status !== 'loading' && (
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-0.5 text-white/25 hover:text-white/60 transition-colors"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.10] rounded-2xl px-4 py-3 focus-within:border-white/[0.20] transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={transcribing ? 'Opname wordt verwerkt...' : recording ? 'Aan het dicteren...' : 'Schrijf hier of sleep een bestand hierin...'}
          disabled={disabled || transcribing}
          rows={1}
          className="flex-1 bg-transparent text-[14px] text-white placeholder-white/25 resize-none outline-none leading-relaxed min-h-[24px] max-h-[200px]"
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
            accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm,audio/*,.pdf,.docx,.txt,.eml,.jpg,.jpeg,.png,.webp"
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
        <p className="text-[11px] text-white/30 mt-1.5 ml-1">Opname wordt omgezet naar tekst...</p>
      )}
    </div>
  );
}
