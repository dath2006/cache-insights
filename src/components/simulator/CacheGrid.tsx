import { useSimulatorStore } from '@/store/simulatorStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function CacheGrid() {
  const cacheSets = useSimulatorStore((s) => s.cacheSets);
  const lastAccess = useSimulatorStore((s) => s.lastAccess);
  const config = useSimulatorStore((s) => s.config);

  if (cacheSets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full glass-card rounded-xl">
        <p className="text-muted-foreground">Initialize simulator to view cache</p>
      </div>
    );
  }

  // Calculate grid dimensions
  const numSets = cacheSets.length;
  const associativity = cacheSets[0]?.blocks.length ?? 1;

  // Limit visible sets for large caches
  const maxVisibleSets = 32;
  const visibleSets = cacheSets.slice(0, maxVisibleSets);
  const hiddenSets = numSets - maxVisibleSets;

  return (
    <div className="glass-card rounded-xl p-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Cache Memory</h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{numSets} Sets</span>
          <span>×</span>
          <span>{associativity}-way</span>
          <span className="text-xs">({config.blockSize}B blocks)</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted border border-border" />
          <span>Empty</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/30 border border-primary/50" />
          <span>Valid</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-secondary/30 border border-secondary/50" />
          <span>Dirty</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-success glow-success" />
          <span>Hit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-error glow-error" />
          <span>Miss</span>
        </div>
      </div>

      {/* Grid */}
      <div className="relative">
        {/* Way headers */}
        <div className="flex mb-2 pl-16">
          {Array.from({ length: associativity }).map((_, wayIdx) => (
            <div
              key={wayIdx}
              className="flex-1 text-center text-xs text-muted-foreground font-mono"
            >
              Way {wayIdx}
            </div>
          ))}
        </div>

        {/* Sets */}
        <div className="space-y-1">
          <AnimatePresence mode="sync">
            {visibleSets.map((set, setIdx) => (
              <motion.div
                key={setIdx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: setIdx * 0.01 }}
                className="flex items-center gap-2"
              >
                {/* Set label */}
                <div className="w-14 text-right text-xs font-mono text-muted-foreground">
                  Set {setIdx}
                </div>

                {/* Blocks in this set */}
                <div className="flex-1 flex gap-1">
                  {set.blocks.map((block, wayIdx) => {
                    const isLastAccessed =
                      lastAccess?.setIndex === setIdx && lastAccess?.wayIndex === wayIdx;
                    const isHit = isLastAccessed && lastAccess?.hit;
                    const isMiss = isLastAccessed && !lastAccess?.hit;

                    return (
                      <Tooltip key={wayIdx}>
                        <TooltipTrigger asChild>
                          <motion.div
                            className={cn(
                              'flex-1 h-8 rounded border flex items-center justify-center cursor-pointer transition-all duration-200',
                              !block.valid && 'bg-muted/50 border-border/50',
                              block.valid && !block.dirty && 'bg-primary/20 border-primary/40',
                              block.valid && block.dirty && 'bg-secondary/20 border-secondary/40',
                              isHit && 'animate-cache-hit',
                              isMiss && 'animate-cache-miss'
                            )}
                            animate={
                              isLastAccessed
                                ? {
                                    scale: [1, 1.1, 1],
                                    transition: { duration: 0.2 },
                                  }
                                : {}
                            }
                          >
                            {block.valid && (
                              <span className="text-[10px] font-mono text-foreground/70 truncate px-1">
                                {block.tag.toString(16).toUpperCase().padStart(4, '0')}
                              </span>
                            )}
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-card border-border">
                          <div className="text-xs space-y-1">
                            <p>
                              <span className="text-muted-foreground">Set:</span> {setIdx}
                              <span className="mx-2">|</span>
                              <span className="text-muted-foreground">Way:</span> {wayIdx}
                            </p>
                            {block.valid ? (
                              <>
                                <p>
                                  <span className="text-muted-foreground">Tag:</span>{' '}
                                  <span className="font-mono text-primary">
                                    0x{block.tag.toString(16).toUpperCase()}
                                  </span>
                                </p>
                                <p>
                                  <span className="text-muted-foreground">Status:</span>{' '}
                                  {block.dirty ? (
                                    <span className="text-secondary">Dirty</span>
                                  ) : (
                                    <span className="text-success">Clean</span>
                                  )}
                                </p>
                              </>
                            ) : (
                              <p className="text-muted-foreground">Empty</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {hiddenSets > 0 && (
            <div className="text-center text-sm text-muted-foreground py-2">
              + {hiddenSets} more sets...
            </div>
          )}
        </div>
      </div>

      {/* Last Access Info */}
      {lastAccess && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'mt-4 p-3 rounded-lg border',
            lastAccess.hit
              ? 'bg-success/10 border-success/30'
              : 'bg-error/10 border-error/30'
          )}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono">
              {lastAccess.isWrite ? 'W' : 'R'} 0x
              {lastAccess.address.toString(16).toUpperCase().padStart(8, '0')}
            </span>
            <span
              className={cn(
                'font-bold',
                lastAccess.hit ? 'text-success' : 'text-error'
              )}
            >
              {lastAccess.hit ? 'HIT' : 'MISS'}
            </span>
            <span className="text-muted-foreground">
              Set {lastAccess.setIndex}, Way {lastAccess.wayIndex}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
