import { useSimulatorStore } from '@/store/simulatorStore';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CacheSet } from '@/lib/cacheSimulator';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { GripHorizontal } from 'lucide-react';

interface CacheLevelGridProps {
  sets: CacheSet[];
  config: { blockSize: number; cacheSize: number; associativity: number };
  lastAccess?: {
    setIndex: number;
    wayIndex: number;
    hit: boolean;
  } | null;
  level: 'L1' | 'L2';
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Row height for virtualization
const SET_ROW_HEIGHT = 36;
const OVERSCAN = 3;

function CacheLevelGrid({ sets, config, lastAccess, level, scrollContainerRef }: CacheLevelGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(300);

  const numSets = sets.length;
  const associativity = sets[0]?.blocks.length ?? 1;

  // Calculate visible range - must be called unconditionally (before any early returns)
  const visibleRange = useMemo(() => {
    if (numSets === 0) return { startIndex: 0, endIndex: 0 };
    const startIndex = Math.max(0, Math.floor(scrollTop / SET_ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(
      numSets,
      Math.ceil((scrollTop + containerHeight) / SET_ROW_HEIGHT) + OVERSCAN
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, numSets]);

  const totalHeight = numSets * SET_ROW_HEIGHT;

  // Update scroll position and container height
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll);
    updateHeight();

    // Use ResizeObserver to track container height changes
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [scrollContainerRef]);

  if (sets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {level} Cache disabled
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between px-2">
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

      {/* Way headers - Fixed */}
      <div className="flex mb-1 pl-16 pr-2">
        {Array.from({ length: associativity }).map((_, wayIdx) => (
          <div
            key={wayIdx}
            className="flex-1 text-center text-xs text-muted-foreground font-mono"
          >
            Way {wayIdx}
          </div>
        ))}
      </div>

      {/* Virtualized Sets Container */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: visibleRange.startIndex * SET_ROW_HEIGHT,
            left: 0,
            right: 0,
          }}
        >
          {sets.slice(visibleRange.startIndex, visibleRange.endIndex).map((set, i) => {
            const setIdx = visibleRange.startIndex + i;
            return (
              <div
                key={setIdx}
                className="flex items-center gap-2 px-2"
                style={{ height: SET_ROW_HEIGHT }}
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
                          <div
                            className={cn(
                              'flex-1 h-8 rounded border flex items-center justify-center cursor-pointer transition-colors',
                              !block.valid && 'bg-muted/50 border-border/50',
                              block.valid && !block.dirty && 'bg-primary/20 border-primary/40',
                              block.valid && block.dirty && 'bg-secondary/20 border-secondary/40',
                              isHit && 'ring-2 ring-success bg-success/30',
                              isMiss && 'ring-2 ring-error bg-error/30'
                            )}
                          >
                            {block.valid && (
                              <span className="text-[10px] font-mono text-foreground/70 truncate px-1">
                                {block.tag.toString(16).toUpperCase().padStart(4, '0')}
                              </span>
                            )}
                          </div>
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
              </div>
            );
          })}
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

  // Resizable state
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(400);
  const [, forceUpdate] = useState({});
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ y: 0, height: 0 });

  const applyHeight = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.height = `${heightRef.current}px`;
    }
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartRef.current = {
      y: e.clientY,
      height: heightRef.current,
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    
    const dy = e.clientY - resizeStartRef.current.y;
    const newHeight = Math.max(200, Math.min(800, resizeStartRef.current.height + dy));
    heightRef.current = newHeight;
    applyHeight();
  }, [applyHeight]);

  const handleMouseUp = useCallback(() => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      forceUpdate({});
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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
    <div 
      ref={containerRef}
      className="glass-card rounded-xl flex flex-col relative"
      style={{ height: heightRef.current }}
    >
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 p-4 pb-2 border-b border-border/30">
        {/* Last Access Info - Fixed at top */}
        {lastAccess && accessDisplay && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mb-3 p-3 rounded-lg border',
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

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
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
            <div className="w-4 h-4 rounded ring-2 ring-success bg-success/30" />
            <span>Hit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded ring-2 ring-error bg-error/30" />
            <span>Miss</span>
          </div>
        </div>
      </div>

      {/* Cache Tabs - Sticky */}
      {l1Enabled && l2Enabled ? (
        <Tabs defaultValue="l1" className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-4 py-2 border-b border-border/30">
            <TabsList className="grid w-full grid-cols-2">
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
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-2">
            <TabsContent value="l1" className="mt-0">
              <CacheLevelGrid
                sets={l1CacheSets}
                config={multiLevelConfig.l1}
                lastAccess={lastAccess?.l1}
                level="L1"
                scrollContainerRef={scrollRef}
              />
            </TabsContent>
            <TabsContent value="l2" className="mt-0">
              <CacheLevelGrid
                sets={l2CacheSets}
                config={multiLevelConfig.l2}
                lastAccess={lastAccess?.l2}
                level="L2"
                scrollContainerRef={scrollRef}
              />
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-2">
          {l1Enabled ? (
            <CacheLevelGrid
              sets={l1CacheSets}
              config={multiLevelConfig.l1}
              lastAccess={lastAccess?.l1}
              level="L1"
              scrollContainerRef={scrollRef}
            />
          ) : (
            <CacheLevelGrid
              sets={l2CacheSets}
              config={multiLevelConfig.l2}
              lastAccess={lastAccess?.l2}
              level="L2"
              scrollContainerRef={scrollRef}
            />
          )}
        </div>
      )}

      {/* Resize Handle at Bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center bg-gradient-to-t from-muted/50 to-transparent hover:from-muted transition-colors group"
        onMouseDown={handleResizeStart}
      >
        <GripHorizontal 
          size={16} 
          className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" 
        />
      </div>
    </div>
  );
}

