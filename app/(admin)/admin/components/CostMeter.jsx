'use client';

export default function CostMeter({ used, total, label, formatValue }) {
  if (!total || total <= 0) return null;

  const pct = Math.min((used / total) * 100, 100);

  let barColor = '#22c55e';
  if (pct >= 80) {
    barColor = '#ef4444';
  } else if (pct >= 60) {
    barColor = '#f97316';
  }

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/70">{label}</span>
        <span className="text-sm font-mono text-white/80">
          {formatValue(used)} / {formatValue(total)}
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-xs text-white/40 mt-1">{pct.toFixed(1)}%</p>
    </div>
  );
}
