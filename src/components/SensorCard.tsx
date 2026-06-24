import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SensorCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  status: 'good' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}

const statusColors = {
  good: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    value: 'text-emerald-700',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    value: 'text-amber-700',
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    value: 'text-red-700',
  },
} as const;

export function SensorCard({ title, value, unit, icon: Icon, status, trend }: SensorCardProps) {
  const colors = statusColors[status];

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`rounded-2xl border ${colors.border} ${colors.bg} p-3 shadow-sm transition-all hover:shadow-md sm:p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600 sm:text-sm">{title}</p>
          <div className="mt-1 flex items-end gap-1 sm:mt-2">
            <span className={`text-2xl font-bold leading-none sm:text-3xl ${colors.value}`}>{value}</span>
            {unit && <span className="pb-0.5 text-xs text-slate-500 sm:text-sm">{unit}</span>}
          </div>
        </div>

        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/70 ${colors.icon} sm:h-10 sm:w-10`}>
          <Icon size={18} />
        </div>
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-[11px] sm:text-xs">
          <span
            className={`h-2 w-2 rounded-full ${trend === 'up' ? 'bg-red-500' : trend === 'down' ? 'bg-emerald-500' : 'bg-gray-400'}`}
          />
          <span className="text-slate-500">{trend === 'up' ? 'Meningkat' : trend === 'down' ? 'Menurun' : 'Stabil'}</span>
        </div>
      )}
    </motion.div>
  );
}
