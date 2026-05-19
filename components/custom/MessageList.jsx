// components/custom/MessageList.jsx
'use client';

import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Image as ImageIcon, FileText } from 'lucide-react';
import DocumentCard from './DocumentCard';

marked.setOptions({ breaks: true });

export default function MessageList({ messages, sending, onOpenDocument }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Is het laatste bericht een actief streaming-bericht?
  const lastMsg = messages[messages.length - 1];
  const isStreaming = lastMsg?.streaming === true;

  return (
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
            {msg.role === 'user' ? (
              <>
                <span className="whitespace-pre-wrap">{msg.content}</span>
                {msg.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.attachments.map((att, i) => (
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
                    ))}
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
  );
}
