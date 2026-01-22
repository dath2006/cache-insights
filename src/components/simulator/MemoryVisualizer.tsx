import { useSimulatorStore } from '@/store/simulatorStore';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, ArrowDown, ArrowUp, Cpu, Database, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MemoryVisualizer() {
  const memoryRegions = useSimulatorStore((s) => s.memoryRegions);
  const memoryStats = useSimulatorStore((s) => s.memoryStats);
  const memoryConfig = useSimulatorStore((s) => s.memoryConfig);
  const lastAccess = useSimulatorStore((s) => s.lastAccess);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);

  // Calculate max access for color scaling
  const maxAccess = Math.max(...memoryRegions.map(r => r.accessCount), 1);

  // Get heat color based on access frequency
  const getHeatColor = (accessCount: number) => {
    const intensity = accessCount / maxAccess;
    if (intensity === 0) return 'bg-muted/30';
    if (intensity < 0.25) return 'bg-blue-500/30';
    if (intensity < 0.5) return 'bg-green-500/40';
    if (intensity < 0.75) return 'bg-yellow-500/50';
    return 'bg-red-500/60';
  };

  const formatAddress = (addr: number) => `0x${addr.toString(16).toUpperCase().padStart(8, '0')}`;
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const totalCacheSize = 
    (multiLevelConfig.enabled.l1 ? multiLevelConfig.l1.cacheSize : 0) +
    (multiLevelConfig.enabled.l2 ? multiLevelConfig.l2.cacheSize : 0);

  return (
    <div className="glass-card rounded-xl p-5 space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-lg bg-accent/20">
          <Layers className="text-accent" size={20} />
        </div>
        <h2 className="text-lg font-bold">Memory Hierarchy</h2>
      </div>

      {/* Hierarchy Flow Visualization */}
      <div className="flex flex-col items-center gap-2 py-4">
        {/* CPU */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg border border-primary/30">
          <Cpu size={18} className="text-primary" />
          <span className="text-sm font-medium">CPU</span>
        </div>
        
        <ArrowDown size={16} className="text-muted-foreground animate-pulse" />
        
        {/* L1 Cache */}
        {multiLevelConfig.enabled.l1 && (
          <>
            <motion.div 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                lastAccess?.l1?.hit 
                  ? "bg-primary/20 border-primary/50" 
                  : lastAccess?.l1 
                    ? "bg-destructive/20 border-destructive/50"
                    : "bg-muted/50 border-border"
              )}
              animate={lastAccess?.l1 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Badge variant="default" className="text-xs">L1</Badge>
              <span className="text-sm">{formatSize(multiLevelConfig.l1.cacheSize)}</span>
              <span className="text-xs text-muted-foreground">~1 cycle</span>
            </motion.div>
            <ArrowDown size={16} className="text-muted-foreground" />
          </>
        )}
        
        {/* L2 Cache */}
        {multiLevelConfig.enabled.l2 && (
          <>
            <motion.div 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                lastAccess?.l2?.hit 
                  ? "bg-primary/20 border-primary/50" 
                  : lastAccess?.l2 && !lastAccess?.l2?.hit
                    ? "bg-destructive/20 border-destructive/50"
                    : "bg-muted/50 border-border"
              )}
              animate={lastAccess?.l2 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Badge variant="secondary" className="text-xs">L2</Badge>
              <span className="text-sm">{formatSize(multiLevelConfig.l2.cacheSize)}</span>
              <span className="text-xs text-muted-foreground">~10 cycles</span>
            </motion.div>
            <ArrowDown size={16} className="text-muted-foreground" />
          </>
        )}
        
        {/* Main Memory */}
        <motion.div 
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
            lastAccess?.memoryAccessed 
              ? "bg-accent/20 border-accent/50" 
              : "bg-muted/50 border-border"
          )}
          animate={lastAccess?.memoryAccessed ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <HardDrive size={16} className="text-accent" />
          <span className="text-sm font-medium">Main Memory</span>
          <span className="text-sm">{formatSize(memoryConfig.sizeMB * 1024 * 1024)}</span>
          <span className="text-xs text-muted-foreground">~{memoryConfig.latencyCycles} cycles</span>
        </motion.div>
      </div>

      {/* Memory Region Heat Map */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Memory Region Access Heat Map</span>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded bg-muted/30" />
            <span className="text-muted-foreground">Cold</span>
            <div className="w-3 h-3 rounded bg-destructive/60 ml-2" />
            <span className="text-muted-foreground">Hot</span>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-1.5">
          {memoryRegions.map((region, idx) => (
            <motion.div
              key={idx}
              className={cn(
                "relative p-2 rounded-md border border-border/50 cursor-default",
                getHeatColor(region.accessCount)
              )}
              whileHover={{ scale: 1.05 }}
              title={`Region ${idx}: ${region.accessCount} accesses`}
            >
              <div className="text-[10px] font-mono text-muted-foreground truncate">
                {formatAddress(region.startAddress)}
              </div>
              <div className="text-xs font-bold mt-1">
                {region.accessCount > 0 ? region.accessCount : '-'}
              </div>
              {region.accessCount > 0 && (
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    R:{region.readCount}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    W:{region.writeCount}
                  </Badge>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      {memoryStats.totalAccesses > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Memory Accesses</div>
              <div className="font-mono font-bold text-accent">
                {memoryStats.totalAccesses}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Data Transferred</div>
              <div className="font-mono font-bold text-accent">
                {formatSize(memoryStats.bytesTransferred)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
              <div className="font-mono font-bold text-accent">
                {memoryStats.averageLatency.toFixed(1)} cyc
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}