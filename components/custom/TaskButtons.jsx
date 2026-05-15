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

export default function TaskButtons({ outputTypes, onTaskClick }) {
  const groups = outputTypes.reduce((acc, task) => {
    const group = task.group || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(task);
    return acc;
  }, {});

  const GROUP_LABELS = {
    documents: 'Documenten maken',
    search: 'Opzoeken',
    other: 'Overig',
  };

  const groupOrder = ['documents', 'search', 'other'];
  const orderedGroups = groupOrder.filter((g) => groups[g]);

  return (
    <div className="space-y-4 mb-4">
      {orderedGroups.map((groupKey) => (
        <div key={groupKey}>
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-white/30 mb-2">
            {GROUP_LABELS[groupKey]}
          </p>
          <div className="flex flex-wrap gap-2">
            {groups[groupKey].map((task) => {
              const Icon = ICON_MAP[task.icon] ?? FileText;
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="flex items-center gap-2 h-9 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[13px] text-white/70 hover:bg-white/[0.09] hover:text-white hover:border-white/[0.15] transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-orange" strokeWidth={1.75} />
                  {task.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
