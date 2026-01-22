import { useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, ArrowDown, Cpu, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MemoryVisualizerProps {
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export function MemoryVisualizer({ defaultOpen = true, onToggle }: MemoryVisualizerProps) {
  const [isVisible, setIsVisible] = useState(defaultOpen);
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

  const formatAddress = (addr: number, accessCount: number) => {
    if (accessCount === 0) return '---';
    return `0x${addr.toString(16).toUpperCase().padStart(6, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const handleToggle = () => {
    const newState = !isVisible;
    setIsVisible(newState);
    onToggle?.(newState);
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header - Always visible */}
      <Button
        variant="ghost"
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 rounded-none h-auto"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/20">
            <Layers className="text-accent" size={18} />
          </div>
          <span className="font-bold text-base">Memory Hierarchy</span>
        </div>
        {isVisible ? (
          <ChevronUp size={18} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={18} className="text-muted-foreground" />
        )}
      </Button>

      <AnimatePresence initial={false}>
        {isVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden flex-1"
          >
            <div className="p-4 pt-0 space-y-3 flex flex-col h-full">
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
                
                <div className="grid grid-cols-4 gap-1 mb-3">
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
                        {formatAddress(region.startAddress, region.accessCount)}
                      </div>
                      <div className="text-[10px] font-bold">
                        {region.accessCount > 0 ? region.accessCount : '-'}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Stats Summary - Always visible below heat map */}
                <div className="pt-2 border-t border-border">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Accesses</div>
                      <div className="font-mono text-xs font-bold text-accent">
                        {memoryStats.totalAccesses || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Transferred</div>
                      <div className="font-mono text-xs font-bold text-accent">
                        {memoryStats.bytesTransferred > 0 ? formatSize(memoryStats.bytesTransferred) : '0 B'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Avg Latency</div>
                      <div className="font-mono text-xs font-bold text-accent">
                        {memoryStats.averageLatency > 0 ? memoryStats.averageLatency.toFixed(1) : '0'} cyc
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
