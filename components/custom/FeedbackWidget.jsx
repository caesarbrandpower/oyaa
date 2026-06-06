'use client';

import { useState, useRef, useEffect } from 'react';
import { Flag, X, Send } from 'lucide-react';

export default function FeedbackWidget({ userEmail }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const panelRef = useRef(null);
  const textareaRef = useRef(null);

  // Sluit paneel bij klik buiten
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus textarea bij openen
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Automatisch sluiten na bevestiging
  useEffect(() => {
    if (status !== 'done') return;
    const t = setTimeout(() => {
      setOpen(false);
      setStatus('idle');
      setMessage('');
    }, 2000);
    return () => clearTimeout(t);
  }, [status]);

  async function handleSend() {
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          currentUrl: window.location.href,
        }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50">
      {/* Paneel — opent links-boven van de knop */}
      {open && (
        <div className="absolute bottom-24 right-0 w-72 rounded-2xl border border-white/[0.10] bg-[#1a1a1a] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <span className="text-[13px] font-medium text-white/80">Feedback melden</span>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {status === 'done' ? (
              <p className="text-[13px] text-white/60 text-center py-2">
                Bedankt, we kijken ernaar!
              </p>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Wat wil je melden?"
                  rows={4}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white/80 placeholder-white/25 resize-none outline-none focus:border-white/[0.18] transition-colors"
                />
                {status === 'error' && (
                  <p className="text-[11px] text-red-400/80 mt-1.5">Verzenden mislukt. Probeer opnieuw.</p>
                )}
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || status === 'sending'}
                  className="mt-3 w-full flex items-center justify-center gap-2 h-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.13] text-[13px] text-white/70 hover:text-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {status === 'sending' ? 'Bezig...' : 'Versturen'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Trigger-knop */}
      <button
        onClick={() => { setOpen(v => !v); if (status === 'error') setStatus('idle'); }}
        title="Feedback geven"
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.07] border border-white/[0.10] text-white/40 hover:text-white/70 hover:bg-white/[0.12] hover:border-white/[0.18] transition-colors shadow-lg"
      >
        <Flag className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
