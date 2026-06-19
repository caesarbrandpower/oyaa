// components/custom/TaskButtons.jsx
'use client';

import {
  FileText,
  ClipboardList,
  PenLine,
  BarChart2,
  MapPin,
  Building2,
} from 'lucide-react';

const ICON_MAP = {
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  'pen-line': PenLine,
  'bar-chart-2': BarChart2,
  'map-pin': MapPin,
  'building-2': Building2,
};

const ROW1_ORDER = ['meeting-summary', 'account-to-pm', 'field-briefing', 'account-to-creation'];
const ROW2_ITEMS = [
  { id: 'evaluation',   label: 'Evaluatie',    icon: 'bar-chart-2' },
  { id: 'locaties',     label: 'Locaties',     icon: 'map-pin' },
  { id: 'leveranciers', label: 'Leveranciers', icon: 'building-2' },
];

export default function TaskButtons({ outputTypes, onTaskClick }) {
  const byId = Object.fromEntries(outputTypes.map((t) => [t.id, t]));

  const row1 = ROW1_ORDER.map((id) => byId[id]).filter(Boolean);

  return (
    <div className="space-y-2 mb-4">
      <div className="flex gap-1.5">
        {row1.map((task) => {
          const Icon = ICON_MAP[task.icon] ?? FileText;
          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="flex items-center gap-1.5 h-8 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-white/70 hover:bg-white/[0.09] hover:text-white hover:border-white/[0.15] transition-colors whitespace-nowrap"
            >
              <Icon className="w-3 h-3 shrink-0 text-orange" strokeWidth={1.75} />
              {task.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {ROW2_ITEMS.map((task) => {
          const Icon = ICON_MAP[task.icon] ?? FileText;
          const active = !!byId[task.id];
          return active ? (
            <button
              key={task.id}
              onClick={() => onTaskClick(byId[task.id])}
              className="flex items-center gap-1.5 h-8 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-white/70 hover:bg-white/[0.09] hover:text-white hover:border-white/[0.15] transition-colors whitespace-nowrap"
            >
              <Icon className="w-3 h-3 shrink-0 text-orange" strokeWidth={1.75} />
              {task.label}
            </button>
          ) : (
            <button
              key={task.id}
              disabled
              className="flex items-center gap-1.5 h-8 px-4 bg-white/[0.02] border border-white/[0.05] rounded-lg text-[12px] text-white/25 cursor-not-allowed whitespace-nowrap"
            >
              <Icon className="w-3 h-3 shrink-0 text-white/20" strokeWidth={1.75} />
              {task.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
