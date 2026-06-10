'use client';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

export default function ActivityChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: '#1c1c1c',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: 'white',
            fontSize: 12,
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
        />
        <Line
          type="monotone"
          dataKey="threads"
          name="Threads"
          stroke="#f97316"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#f97316' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
