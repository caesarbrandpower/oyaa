'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#f97316', '#60a5fa', '#a78bfa', '#34d399'];

function formatModelName(model) {
  const idx = model.indexOf('-');
  return idx !== -1 ? model.slice(idx + 1) : model;
}

export default function ModelDistChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-white/30 text-sm">Geen data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="tokens"
          nameKey="model"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#1c1c1c',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: 'white',
            fontSize: 12,
          }}
          formatter={(value, name) => [value.toLocaleString('nl'), formatModelName(name)]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
          formatter={(value) => formatModelName(value)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
