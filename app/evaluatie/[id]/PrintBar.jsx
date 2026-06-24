'use client';

export default function PrintBar() {
  return (
    <div className="eval-print-bar">
      <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 600, color: '#0F1052' }}>Chase Evaluatie</span>
      <button
        onClick={() => window.print()}
        style={{ background: '#0F1052', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Download als PDF
      </button>
    </div>
  );
}
