import { useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, ArrowDown, Cpu, Layers, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MemoryVisualizer() {
  const [isVisible, setIsVisible] = useState(true);
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

  const formatAddress = (addr: number) => {
    if (addr === 0 && memoryStats.totalAccesses === 0) return '---';
    return `0x${addr.toString(16).toUpperCase().padStart(8, '0')}`;
  };
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const totalCacheSize = 
    (multiLevelConfig.enabled.l1 ? multiLevelConfig.l1.cacheSize : 0) +
    (multiLevelConfig.enabled.l2 ? multiLevelConfig.l2.cacheSize : 0);

  return (
    <div className="relative h-full">
      {/* Toggle Button - Always visible */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(!isVisible)}
        className={cn(
          "absolute z-10 transition-all duration-300",
          isVisible ? "top-3 right-3" : "top-0 left-0"
        )}
      >
        {isVisible ? (
          <PanelRightClose size={16} />
        ) : (
          <>
            <PanelRightOpen size={16} className="mr-2" />
            <span className="text-xs">Memory</span>
          </>
        )}
      </Button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-card rounded-xl p-4 space-y-3 h-full flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Layers className="text-accent" size={18} />
              </div>
              <h2 className="text-base font-bold">Memory Hierarchy</h2>
            </div>

            {/* Hierarchy Flow Visualization */}
            <div className="flex flex-col items-center gap-1.5 py-2 shrink-0">
              {/* CPU */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg border border-primary/30">
                <Cpu size={16} className="text-primary" />
                <span className="text-xs font-medium">CPU</span>
              </div>
              
              <ArrowDown size={14} className="text-muted-foreground animate-pulse" />
        
              {/* L1 Cache */}
              {multiLevelConfig.enabled.l1 && (
                <>
                  <motion.div 
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs",
                      lastAccess?.l1?.hit 
                        ? "bg-primary/20 border-primary/50" 
                        : lastAccess?.l1 
                          ? "bg-destructive/20 border-destructive/50"
                          : "bg-muted/50 border-border"
                    )}
                    animate={lastAccess?.l1 ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">L1</Badge>
                    <span>{formatSize(multiLevelConfig.l1.cacheSize)}</span>
                    <span className="text-muted-foreground">~1 cyc</span>
                  </motion.div>
                  <ArrowDown size={12} className="text-muted-foreground" />
                </>
              )}
              
              {/* L2 Cache */}
              {multiLevelConfig.enabled.l2 && (
                <>
                  <motion.div 
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs",
                      lastAccess?.l2?.hit 
                        ? "bg-primary/20 border-primary/50" 
                        : lastAccess?.l2 && !lastAccess?.l2?.hit
                          ? "bg-destructive/20 border-destructive/50"
                          : "bg-muted/50 border-border"
                    )}
                    animate={lastAccess?.l2 ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">L2</Badge>
                    <span>{formatSize(multiLevelConfig.l2.cacheSize)}</span>
                    <span className="text-muted-foreground">~10 cyc</span>
                  </motion.div>
                  <ArrowDown size={12} className="text-muted-foreground" />
                </>
              )}
              
              {/* Main Memory */}
              <motion.div 
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs",
                  lastAccess?.memoryAccessed 
                    ? "bg-accent/20 border-accent/50" 
                    : "bg-muted/50 border-border"
                )}
                animate={lastAccess?.memoryAccessed ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <HardDrive size={14} className="text-accent" />
                <span className="font-medium">Memory</span>
                <span>{formatSize(memoryConfig.sizeMB * 1024 * 1024)}</span>
                <span className="text-muted-foreground">~{memoryConfig.latencyCycles} cyc</span>
              </motion.div>
            </div>

            {/* Memory Region Heat Map */}
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Heat Map</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 rounded bg-muted/30" />
                  <span className="text-muted-foreground">Cold</span>
                  <div className="w-2 h-2 rounded bg-destructive/60 ml-1" />
                  <span className="text-muted-foreground">Hot</span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-1">
                {memoryRegions.map((region, idx) => (
                  <motion.div
                    key={idx}
                    className={cn(
                      "relative p-1.5 rounded border border-border/50 cursor-default",
                      getHeatColor(region.accessCount)
                    )}
                    whileHover={{ scale: 1.05 }}
                    title={`Region ${idx}: ${region.accessCount} accesses`}
                  >
                    <div className="text-[8px] font-mono text-muted-foreground truncate">
                      {region.accessCount > 0 ? formatAddress(region.startAddress).slice(0, 10) : '---'}
                    </div>
                    <div className="text-[10px] font-bold">
                      {region.accessCount > 0 ? region.accessCount : '-'}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Stats Summary */}
            {memoryStats.totalAccesses > 0 && (
              <div className="pt-2 border-t border-border shrink-0">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Accesses</div>
                    <div className="font-mono text-xs font-bold text-accent">
                      {memoryStats.totalAccesses}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Transferred</div>
                    <div className="font-mono text-xs font-bold text-accent">
                      {formatSize(memoryStats.bytesTransferred)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Latency</div>
                    <div className="font-mono text-xs font-bold text-accent">
                      {memoryStats.averageLatency.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}