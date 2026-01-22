import { useSimulatorStore } from '@/store/simulatorStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CacheSet } from '@/lib/cacheSimulator';

interface CacheLevelGridProps {
  sets: CacheSet[];
  config: { blockSize: number; cacheSize: number; associativity: number };
  lastAccess?: {
    setIndex: number;
    wayIndex: number;
    hit: boolean;
  } | null;
  level: 'L1' | 'L2';
}

function CacheLevelGrid({ sets, config, lastAccess, level }: CacheLevelGridProps) {
  if (sets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {level} Cache disabled
      </div>
    );
  }

  const numSets = sets.length;
  const associativity = sets[0]?.blocks.length ?? 1;

  const maxVisibleSets = 32;
  const visibleSets = sets.slice(0, maxVisibleSets);
  const hiddenSets = numSets - maxVisibleSets;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={level === 'L1' ? 'default' : 'secondary'}>
            {level}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {(config.cacheSize / 1024).toFixed(0)}KB
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{numSets} Sets</span>
          <span>×</span>
          <span>{associativity}-way</span>
          <span className="text-xs">({config.blockSize}B blocks)</span>
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
                <div className="w-14 text-right text-xs font-mono text-muted-foreground">
                  Set {setIdx}
                </div>

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
                                  <span className="text-muted-foreground">Access Count:</span>{' '}
                                  <span className="font-mono">{block.accessCount}</span>
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
    </div>
  );
}

export function CacheGrid() {
  const l1CacheSets = useSimulatorStore((s) => s.l1CacheSets);
  const l2CacheSets = useSimulatorStore((s) => s.l2CacheSets);
  const lastAccess = useSimulatorStore((s) => s.lastAccess);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);

  const l1Enabled = multiLevelConfig.enabled.l1;
  const l2Enabled = multiLevelConfig.enabled.l2;

  if (!l1Enabled && !l2Enabled) {
    return (
      <div className="flex items-center justify-center h-full glass-card rounded-xl">
        <p className="text-muted-foreground">Enable at least one cache level</p>
      </div>
    );
  }

  // Determine what to show in last access bar
  const getLastAccessDisplay = () => {
    if (!lastAccess) return null;
    
    const l1Hit = lastAccess.l1?.hit;
    const l2Hit = lastAccess.l2?.hit;
    
    let resultText = 'MISS';
    let resultClass = 'text-error';
    let level = '';
    
    if (l1Hit) {
      resultText = 'L1 HIT';
      resultClass = 'text-success';
      level = `Set ${lastAccess.l1?.setIndex}, Way ${lastAccess.l1?.wayIndex}`;
    } else if (l2Hit) {
      resultText = 'L2 HIT';
      resultClass = 'text-primary';
      level = `Set ${lastAccess.l2?.setIndex}, Way ${lastAccess.l2?.wayIndex}`;
    } else if (lastAccess.l1 && !l1Hit) {
      level = l2Enabled ? 'L1 miss → L2 miss' : `Set ${lastAccess.l1?.setIndex}, Way ${lastAccess.l1?.wayIndex}`;
    }
    
    return { resultText, resultClass, level };
  };

  const accessDisplay = getLastAccessDisplay();

  return (
    <div className="glass-card rounded-xl p-6 overflow-auto h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
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

      {/* Cache Tabs or Single View */}
      {l1Enabled && l2Enabled ? (
        <Tabs defaultValue="l1" className="flex-1">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="l1" className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">L1</Badge>
              <span className="text-xs text-muted-foreground">
                {(multiLevelConfig.l1.cacheSize / 1024).toFixed(0)}KB
              </span>
            </TabsTrigger>
            <TabsTrigger value="l2" className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">L2</Badge>
              <span className="text-xs text-muted-foreground">
                {(multiLevelConfig.l2.cacheSize / 1024).toFixed(0)}KB
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="l1" className="flex-1">
            <CacheLevelGrid
              sets={l1CacheSets}
              config={multiLevelConfig.l1}
              lastAccess={lastAccess?.l1}
              level="L1"
            />
          </TabsContent>
          <TabsContent value="l2" className="flex-1">
            <CacheLevelGrid
              sets={l2CacheSets}
              config={multiLevelConfig.l2}
              lastAccess={lastAccess?.l2}
              level="L2"
            />
          </TabsContent>
        </Tabs>
      ) : l1Enabled ? (
        <CacheLevelGrid
          sets={l1CacheSets}
          config={multiLevelConfig.l1}
          lastAccess={lastAccess?.l1}
          level="L1"
        />
      ) : (
        <CacheLevelGrid
          sets={l2CacheSets}
          config={multiLevelConfig.l2}
          lastAccess={lastAccess?.l2}
          level="L2"
        />
      )}

      {/* Last Access Info */}
      {lastAccess && accessDisplay && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'mt-4 p-3 rounded-lg border',
            accessDisplay.resultText.includes('HIT')
              ? 'bg-success/10 border-success/30'
              : 'bg-error/10 border-error/30'
          )}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono">
              {lastAccess.isWrite ? 'W' : 'R'} 0x
              {lastAccess.address.toString(16).toUpperCase().padStart(8, '0')}
            </span>
            <span className={cn('font-bold', accessDisplay.resultClass)}>
              {accessDisplay.resultText}
            </span>
            <span className="text-muted-foreground">{accessDisplay.level}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
