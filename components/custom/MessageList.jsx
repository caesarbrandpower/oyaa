// components/custom/MessageList.jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Image as ImageIcon, FileText, Mic2, X, Copy, Check } from 'lucide-react';
import DocumentCard from './DocumentCard';

function TranscriptModal({ filename, content, onClose }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-xl bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-white/40" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-white/80 truncate">{filename}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              {copied ? <><Check className="w-3 h-3" strokeWidth={2} /> Gekopieerd</> : <><Copy className="w-3 h-3" strokeWidth={1.75} /> Kopieer</>}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-[13px] text-white/60 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

marked.setOptions({ breaks: true });

export default function MessageList({ messages, sending, onOpenDocument, outputTypes = [], onTranscriptAction }) {
  const bottomRef = useRef(null);
  const [openTranscript, setOpenTranscript] = useState(null); // { filename, content }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Is het laatste bericht een actief streaming-bericht?
  const lastMsg = messages[messages.length - 1];
  const isStreaming = lastMsg?.streaming === true;

  return (
    <>
    {openTranscript && (
      <TranscriptModal
        filename={openTranscript.filename}
        content={openTranscript.content}
        onClose={() => setOpenTranscript(null)}
      />
    )}
    <div className="flex flex-col gap-6 py-8 px-4 md:px-8 max-w-3xl mx-auto w-full">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start gap-3'}`}
        >
          {msg.role === 'assistant' && (
            <img
              src="/icons/waybetter-icon.svg"
              alt=""
              aria-hidden="true"
              className="w-6 h-6 rounded-md shrink-0 mt-1 opacity-70"
            />
          )}

          <div
            className={
              msg.role === 'user'
                ? 'max-w-[75%] bg-white/[0.07] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white/90 leading-relaxed'
                : 'flex-1'
            }
          >
            {msg.type === 'transcript-prompt' ? (
              <div className="flex-1">
                <p className="text-[13px] text-white/60 mb-3">Transcript klaar — wat wil je hiermee maken?</p>
                {outputTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {outputTypes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onTranscriptAction?.(t, msg.transcriptContent)}
                        className="h-7 px-3 rounded-lg text-[11px] bg-white/[0.06] border border-white/[0.10] text-white/55 hover:text-white hover:bg-white/[0.10] transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : msg.role === 'user' ? (
              <>
                <span className="whitespace-pre-wrap">{msg.content}</span>
                {msg.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.attachments.map((att, i) =>
                      att.type === 'transcript' ? (
                        <button
                          key={i}
                          onClick={() => setOpenTranscript({ filename: att.filename, content: att.content })}
                          className="inline-flex items-center gap-1.5 text-[11px] text-white/55 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:text-white/80 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          <Mic2 className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                          Transcript — {att.filename}
                        </button>
                      ) : (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] text-white/40 border border-white/[0.08] rounded-md px-1.5 py-0.5"
                        >
                          {att.type === 'image'
                            ? <ImageIcon className="w-2.5 h-2.5" strokeWidth={1.75} />
                            : <FileText className="w-2.5 h-2.5" strokeWidth={1.75} />
                          }
                          {att.filename}
                        </span>
                      )
                    )}
                  </div>
                )}
              </>
            ) : msg.streaming ? (
              msg.isDocument ? (
                /* Document in opbouw — geen streaming tekst tonen */
                <p className="text-[13px] text-white/35 leading-relaxed animate-pulse">
                  Waybetter is aan het werk...
                </p>
              ) : (
                /* Gewone chat — live streaming tekst */
                <p className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">
                  {msg.streamContent}
                  <span className="inline-block w-0.5 h-4 bg-white/40 ml-0.5 animate-pulse" />
                </p>
              )
            ) : msg.isDocument ? (
              /* Document-kaart */
              <DocumentCard
                content={msg.content}
                onOpen={() => onOpenDocument?.(msg)}
              />
            ) : (
              /* Gewone markdown */
              <div
                className="custom-prose text-[14px]"
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
              />
            )}
          </div>
        </div>
      ))}

      {/* Loading dots: toon alleen als sending EN geen actief streaming-bericht */}
      {sending && !isStreaming && (
        <div className="flex justify-start items-start gap-3">
          <img
            src="/icons/waybetter-icon.svg"
            alt=""
            aria-hidden="true"
            className="w-6 h-6 rounded-md shrink-0 mt-1 opacity-40"
          />
          <div className="flex items-center gap-1.5 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
    </>
  );
}
