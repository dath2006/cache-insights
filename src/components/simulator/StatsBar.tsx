import { useSimulatorStore } from '@/store/simulatorStore';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Zap, Layers, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function StatsBar() {
  const l1Stats = useSimulatorStore((s) => s.l1Stats);
  const l2Stats = useSimulatorStore((s) => s.l2Stats);
  const combinedStats = useSimulatorStore((s) => s.combinedStats);
  const multiLevelSimulator = useSimulatorStore((s) => s.multiLevelSimulator);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);
  
  const l1Enabled = multiLevelConfig.enabled.l1;
  const l2Enabled = multiLevelConfig.enabled.l2;
  
  const amat = multiLevelSimulator?.calculateAMAT() ?? 0;
  const totalCacheSize = multiLevelSimulator?.getTotalCacheSize() ?? 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Main Stats Row */}
      <div className="flex items-center gap-6 px-6 py-4 border-b border-border/50">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-muted text-success">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Combined Hits</p>
            <motion.p
              key={combinedStats.hits}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold font-mono text-success"
            >
              {combinedStats.hits.toLocaleString()}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-muted text-error">
            <TrendingDown size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Combined Misses</p>
            <motion.p
              key={combinedStats.misses}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold font-mono text-error"
            >
              {combinedStats.misses.toLocaleString()}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-muted text-primary">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Hit Rate</p>
            <motion.p
              key={combinedStats.hitRate}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold font-mono text-primary"
            >
              {(combinedStats.hitRate * 100).toFixed(2)}%
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-muted text-secondary">
            <Zap size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">AMAT</p>
            <motion.p
              key={amat}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold font-mono text-secondary"
            >
              {amat.toFixed(2)}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-muted text-foreground">
            <Database size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Cache</p>
            <p className="text-xl font-bold font-mono text-foreground">
              {(totalCacheSize / 1024).toFixed(0)}KB
            </p>
          </div>
        </motion.div>
        
        <div className="ml-auto flex items-center gap-2 text-muted-foreground">
          <span className="text-sm">Total:</span>
          <span className="font-mono font-bold text-foreground">
            {combinedStats.totalAccesses.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Per-Level Stats Row */}
      <div className="flex items-center gap-8 px-6 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Per Level:</span>
        </div>
        
        {l1Enabled && (
          <div className="flex items-center gap-4">
            <Badge variant="default" className="text-xs">L1</Badge>
            <span className="text-xs font-mono">
              <span className="text-success">{l1Stats.hits}H</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-error">{l1Stats.misses}M</span>
            </span>
            <span className="text-xs text-primary font-mono">
              {(l1Stats.hitRate * 100).toFixed(1)}%
            </span>
          </div>
        )}
        
        {l2Enabled && (
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">L2</Badge>
            <span className="text-xs font-mono">
              <span className="text-success">{l2Stats.hits}H</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-error">{l2Stats.misses}M</span>
            </span>
            <span className="text-xs text-primary font-mono">
              {(l2Stats.hitRate * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
