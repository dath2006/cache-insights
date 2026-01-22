import { useSimulatorStore } from '@/store/simulatorStore';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

export function StatsBar() {
  const stats = useSimulatorStore((s) => s.stats);
  const simulator = useSimulatorStore((s) => s.simulator);
  
  const amat = simulator?.calculateAMAT() ?? 0;

  const statItems = [
    {
      label: 'Hits',
      value: stats.hits.toLocaleString(),
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      label: 'Misses',
      value: stats.misses.toLocaleString(),
      icon: TrendingDown,
      color: 'text-error',
    },
    {
      label: 'Hit Rate',
      value: `${(stats.hitRate * 100).toFixed(2)}%`,
      icon: Activity,
      color: 'text-primary',
    },
    {
      label: 'AMAT',
      value: amat.toFixed(2),
      icon: Zap,
      color: 'text-secondary',
    },
  ];

  return (
    <div className="flex items-center gap-6 px-6 py-4 glass-card rounded-xl">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center gap-3"
        >
          <div className={`p-2 rounded-lg bg-muted ${item.color}`}>
            <item.icon size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {item.label}
            </p>
            <motion.p
              key={item.value}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={`text-xl font-bold font-mono ${item.color}`}
            >
              {item.value}
            </motion.p>
          </div>
        </motion.div>
      ))}
      
      <div className="ml-auto flex items-center gap-2 text-muted-foreground">
        <span className="text-sm">Total:</span>
        <span className="font-mono font-bold text-foreground">
          {stats.totalAccesses.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
