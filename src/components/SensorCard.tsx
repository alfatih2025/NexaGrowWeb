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
  good: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', value: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', value: 'text-amber-700' },
  danger: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', value: 'text-red-700' },
};

export function SensorCard({ title, value, unit, icon: Icon, status, trend }: SensorCardProps) {
  const colors = statusColors[status];

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className={`${colors.bg} border ${colors.border} rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium mb-1">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-bold ${colors.value}`}>{value}</span>
            <span className="text-sm text-gray-500">{unit}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl bg-white/60 ${colors.icon}`}>
          <Icon size={24} />
        </div>
      </div>
      
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={`w-2 h-2 rounded-full ${
            trend === 'up' ? 'bg-red-500' : trend === 'down' ? 'bg-emerald-500' : 'bg-gray-400'
          }`} />
          <span className="text-gray-500">
            {trend === 'up' ? 'Naik' : trend === 'down' ? 'Turun' : 'Stabil'}
          </span>
        </div>
      )}
    </motion.div>
  );
}
