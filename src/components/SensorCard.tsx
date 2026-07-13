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
      className={`rounded-2xl border ${colors.border} ${colors.bg} p-3 shadow-sm transition-all hover:shadow-md sm:p-3 h-full min-h-[120px]`}
    >
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-xs">{title}</p>
            <div className="mt-2 flex items-end gap-2 sm:mt-3">
              <span className={`text-xl font-bold leading-none sm:text-2xl ${colors.value}`}>{value}</span>
              {unit && <span className="pb-0.5 text-xs text-slate-500 sm:text-sm">{unit}</span>}
            </div>
          </div>

          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/70 ${colors.icon} sm:h-10 sm:w-10`}>
            <Icon size={18} />
          </div>
        </div>

        {trend && (
          <div className="flex items-center gap-1 text-[11px] sm:text-xs">
            <span
              className={`h-2 w-2 rounded-full ${trend === 'up' ? 'bg-red-500' : trend === 'down' ? 'bg-emerald-500' : 'bg-gray-400'}`}
            />
            <span className="text-slate-500">{trend === 'up' ? 'Meningkat' : trend === 'down' ? 'Menurun' : 'Stabil'}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
