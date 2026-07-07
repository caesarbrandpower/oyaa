// components/custom/TaskButtons.jsx
'use client';

import Link from 'next/link';
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

const ACTIVE_CLS = 'flex items-center gap-1.5 h-8 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-white/70 hover:bg-white/[0.09] hover:text-white hover:border-white/[0.15] transition-colors whitespace-nowrap';

const ROW1_ORDER = ['meeting-summary', 'account-to-pm', 'field-briefing', 'account-to-creation', 'allday-gespreksverslag', 'allday-debrief'];
const ROW2_ITEMS = [
  { id: 'evaluation',   label: 'Evaluatie',    icon: 'bar-chart-2' },
  { id: 'locaties',     label: 'Locaties',     icon: 'map-pin' },
  { id: 'leveranciers', label: 'Leveranciers', icon: 'building-2' },
];

export default function TaskButtons({ outputTypes, onTaskClick, locationsEnabled, suppliersEnabled }) {
  const byId = Object.fromEntries(outputTypes.map((t) => [t.id, t]));
  const row1 = ROW1_ORDER.map((id) => byId[id]).filter(Boolean);

  const row2 = [];
  for (const task of ROW2_ITEMS) {
    const Icon = ICON_MAP[task.icon] ?? FileText;
    if (task.id === 'locaties') {
      if (locationsEnabled) row2.push(
        <Link key={task.id} href="/app/locaties" className={ACTIVE_CLS}>
          <Icon className="w-3 h-3 shrink-0 text-orange" strokeWidth={1.75} />
          {task.label}
        </Link>
      );
    } else if (task.id === 'leveranciers') {
      if (suppliersEnabled) row2.push(
        <Link key={task.id} href="/app/leveranciers" className={ACTIVE_CLS}>
          <Icon className="w-3 h-3 shrink-0 text-orange" strokeWidth={1.75} />
          {task.label}
        </Link>
      );
    } else if (byId[task.id]) {
      row2.push(
        <button key={task.id} onClick={() => onTaskClick(byId[task.id])} className={ACTIVE_CLS}>
          <Icon className="w-3 h-3 shrink-0 text-orange" strokeWidth={1.75} />
          {task.label}
        </button>
      );
    }
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-1.5">
        {row1.map((task) => {
          const Icon = ICON_MAP[task.icon] ?? FileText;
          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className={ACTIVE_CLS}
            >
              <Icon className="w-3 h-3 shrink-0 text-orange" strokeWidth={1.75} />
              {task.label}
            </button>
          );
        })}
        {row2}
      </div>
    </div>
  );
}
