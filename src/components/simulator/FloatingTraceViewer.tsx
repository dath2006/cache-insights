import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Minimize2, Maximize2, GripHorizontal, Check, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingTraceViewerProps {
  open: boolean;
  onClose: () => void;
}

interface TraceResult {
  l1Hit?: boolean;
  l2Hit?: boolean;
  memoryAccess?: boolean;
}

interface TraceRowProps {
  entry: { address: number; isWrite: boolean };
  idx: number;
  isCurrent: boolean;
  isPast: boolean;
  isNext: boolean;
  result: TraceResult | undefined;
  extractComponents: (address: number) => { tag: number; index: number; offset: number };
  formatHex: (num: number, padLength?: number) => string;
  rowRef: React.RefObject<HTMLDivElement | null> | null;
}

// Memoized row component to prevent unnecessary re-renders
const TraceRow = memo(function TraceRow({ 
  entry, 
  idx, 
  isCurrent, 
  isPast, 
  isNext, 
  result,
  extractComponents,
  formatHex,
  rowRef
}: TraceRowProps) {
  const { tag, index, offset } = extractComponents(entry.address);
  
  const getResultBadge = () => {
    if (!result) return null;

    if (result.l1Hit) {
      return (
        <Badge className="bg-success/20 text-success h-4 text-[9px] gap-0.5">
          <Check size={8} /> L1
        </Badge>
      );
    }
    if (result.l2Hit) {
      return (
        <Badge className="bg-secondary/20 text-secondary h-4 text-[9px] gap-0.5">
          <Check size={8} /> L2
        </Badge>
      );
    }
    if (result.memoryAccess) {
      return (
        <Badge className="bg-destructive/20 text-destructive h-4 text-[9px] gap-0.5">
          <XIcon size={8} /> Mem
        </Badge>
      );
    }
    return (
      <Badge className="bg-destructive/20 text-destructive h-4 text-[9px] gap-0.5">
        <XIcon size={8} /> Miss
      </Badge>
    );
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        "grid grid-cols-[40px_40px_50px_1fr_1fr] gap-1 px-2 py-1.5 text-xs font-mono",
        isCurrent && "bg-primary/20 border-l-2 border-primary rounded-r-md",
        isNext && "bg-muted/30 border-l-2 border-muted-foreground/30",
        isPast && "opacity-50",
        !isCurrent && !isPast && !isNext && "hover:bg-muted/20"
      )}
    >
      <span className="text-muted-foreground text-[10px]">{idx + 1}</span>
      <Badge
        className={cn(
          "w-fit h-4 text-[9px]",
          entry.isWrite
            ? 'bg-secondary/20 text-secondary hover:bg-secondary/20'
            : 'bg-primary/20 text-primary hover:bg-primary/20'
        )}
      >
        {entry.isWrite ? 'W' : 'R'}
      </Badge>
      <div className="flex items-center">
        {getResultBadge()}
      </div>
      <span className="text-foreground text-[11px]">{formatHex(entry.address)}</span>
      <div className="flex items-center gap-0.5 text-[9px]">
        <span className="px-1 py-0.5 rounded bg-primary/20 text-primary" title="Tag">
          {formatHex(tag, 4)}
        </span>
        <span className="px-1 py-0.5 rounded bg-secondary/20 text-secondary" title="Index">
          {index}
        </span>
        <span className="px-1 py-0.5 rounded bg-muted text-muted-foreground" title="Offset">
          {offset}
        </span>
      </div>
    </div>
  );
});

// Row height constant for virtualization calculations
const ROW_HEIGHT = 32;
const OVERSCAN = 5;

export function FloatingTraceViewer({ open, onClose }: FloatingTraceViewerProps) {
  const trace = useSimulatorStore((s) => s.trace);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);
  const traceIndex = useSimulatorStore((s) => s.traceIndex);
  const lastAccess = useSimulatorStore((s) => s.lastAccess);

  // Use refs for position/size during drag/resize to avoid re-renders
  const positionRef = useRef({ x: 100, y: 100 });
  const sizeRef = useRef({ width: 500, height: 400 });
  const [, forceUpdate] = useState({});
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [traceResults, setTraceResults] = useState<Map<number, TraceResult>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef<string | null>(null);
  
  // Virtualization state
  const [scrollTop, setScrollTop] = useState(0);

  const [selectedLevel, setSelectedLevel] = useState<'l1' | 'l2'>('l1');
  
  // Update selected level if current becomes disabled, or on initial load
  useEffect(() => {
    if (multiLevelConfig.enabled.l1) {
      // Prefer L1 if enabled
      if (!multiLevelConfig.enabled.l2 && selectedLevel === 'l2') setSelectedLevel('l1');
    } else if (multiLevelConfig.enabled.l2) {
      // If L1 disabled and L2 enabled, must show L2
      if (selectedLevel === 'l1') setSelectedLevel('l2');
    }
  }, [multiLevelConfig.enabled.l1, multiLevelConfig.enabled.l2, selectedLevel]);

  // Use selected config
  const config = multiLevelConfig[selectedLevel];

  // Memoize bit calculations
  const { offsetBits, indexBits } = useMemo(() => {
    const offsetBits = Math.log2(config.blockSize);
    const numBlocks = config.cacheSize / config.blockSize;
    const numSets = numBlocks / config.associativity;
    const indexBits = Math.log2(numSets);
    return { offsetBits, indexBits };
  }, [config.blockSize, config.cacheSize, config.associativity]);

  // Memoize extractComponents function
  const extractComponents = useCallback((address: number) => {
    const offset = address & ((1 << offsetBits) - 1);
    const index = (address >>> offsetBits) & ((1 << indexBits) - 1);
    const tag = address >>> (offsetBits + indexBits);
    return { tag, index, offset };
  }, [offsetBits, indexBits]);

  const formatHex = useCallback((num: number, padLength: number = 8) => {
    return '0x' + num.toString(16).toUpperCase().padStart(padLength, '0');
  }, []);

  // Track results as simulation progresses
  useEffect(() => {
    if (lastAccess && traceIndex > 0) {
      setTraceResults(prev => {
        const newMap = new Map(prev);
        newMap.set(traceIndex - 1, {
          l1Hit: lastAccess.l1?.hit,
          l2Hit: lastAccess.l2?.hit,
          memoryAccess: lastAccess.memoryAccessed,
        });
        return newMap;
      });
    }
  }, [lastAccess, traceIndex]);

  // Reset results when trace changes
  useEffect(() => {
    setTraceResults(new Map());
  }, [trace]);

  // Auto-scroll to current trace index
  useEffect(() => {
    if (open && scrollRef.current && traceIndex > 0) {
      const container = scrollRef.current;
      const containerHeight = container.clientHeight;
      const rowTop = (traceIndex - 1) * ROW_HEIGHT;
      
      // Center the current row in the viewport
      const targetScrollTop = rowTop - containerHeight / 2 + ROW_HEIGHT / 2;
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [traceIndex, open]);

  // Apply position and size to container using direct DOM manipulation during drag/resize
  const applyTransform = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.left = `${positionRef.current.x}px`;
      containerRef.current.style.top = `${positionRef.current.y}px`;
      containerRef.current.style.width = `${sizeRef.current.width}px`;
      if (!isMinimized) {
        containerRef.current.style.height = `${sizeRef.current.height}px`;
      }
      // Update scroll container height
      if (scrollRef.current) {
        scrollRef.current.style.height = `${sizeRef.current.height - 100}px`;
      }
    }
  }, [isMinimized]);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      isDraggingRef.current = true;
      dragOffset.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y
      };
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingRef.current) {
      positionRef.current = {
        x: Math.max(0, Math.min(window.innerWidth - sizeRef.current.width, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y))
      };
      applyTransform();
    }
    if (isResizingRef.current) {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      const direction = isResizingRef.current;
      
      let newWidth = resizeStart.current.width;
      let newHeight = resizeStart.current.height;
      let newX = resizeStart.current.posX;
      let newY = resizeStart.current.posY;

      if (direction.includes('e')) {
        newWidth = Math.max(400, resizeStart.current.width + dx);
      }
      if (direction.includes('w')) {
        const proposedWidth = resizeStart.current.width - dx;
        if (proposedWidth >= 400) {
          newWidth = proposedWidth;
          newX = resizeStart.current.posX + dx;
        }
      }
      if (direction.includes('s')) {
        newHeight = Math.max(200, resizeStart.current.height + dy);
      }
      if (direction.includes('n')) {
        const proposedHeight = resizeStart.current.height - dy;
        if (proposedHeight >= 200) {
          newHeight = proposedHeight;
          newY = resizeStart.current.posY + dy;
        }
      }

      sizeRef.current = { width: newWidth, height: newHeight };
      positionRef.current = { x: newX, y: newY };
      applyTransform();
    }
  }, [applyTransform]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current || isResizingRef.current) {
      isDraggingRef.current = false;
      isResizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Force a re-render to sync React state with refs
      forceUpdate({});
    }
  }, []);

  const startResize = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = direction;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      posX: positionRef.current.x,
      posY: positionRef.current.y
    };
    document.body.style.cursor = direction.includes('e') || direction.includes('w') 
      ? (direction.includes('s') || direction.includes('n') ? `${direction}-resize` : 'ew-resize')
      : 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Global mouse event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Handle scroll for virtualization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible range for virtualization
  const visibleRange = useMemo(() => {
    const containerHeight = sizeRef.current.height - 100; // Account for header and legend
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(
      trace.length,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
    );
    return { startIndex, endIndex };
  }, [scrollTop, trace.length]);

  if (!open) return null;

  const totalHeight = trace.length * ROW_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 glass-card rounded-xl overflow-hidden shadow-2xl border border-border/50"
      style={{
        left: positionRef.current.x,
        top: positionRef.current.y,
        width: sizeRef.current.width,
        height: isMinimized ? 48 : sizeRef.current.height,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header / Drag Handle */}
      <div className="drag-handle flex items-center justify-between px-3 py-2 bg-muted/50 cursor-move border-b border-border/50">
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-muted-foreground" />
          <span className="font-semibold text-sm">Trace Viewer</span>
          <Badge variant="outline" className="text-[10px] h-5">
            {trace.length} entries
          </Badge>
          {traceIndex > 0 && (
            <Badge className="bg-primary/20 text-primary text-[10px] h-5">
              Step {traceIndex}
            </Badge>
          )}

          
          <div className="flex items-center bg-background/50 rounded-md border border-border/50 p-0.5 ml-2 h-6">
            <button
              onClick={() => multiLevelConfig.enabled.l1 && setSelectedLevel('l1')}
              disabled={!multiLevelConfig.enabled.l1}
              className={cn(
                "px-2 text-[10px] rounded-sm transition-colors",
                selectedLevel === 'l1' 
                  ? "bg-primary/20 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              L1
            </button>
            <div className="w-px h-3 bg-border/50 mx-0.5" />
            <button
              onClick={() => multiLevelConfig.enabled.l2 && setSelectedLevel('l2')}
              disabled={!multiLevelConfig.enabled.l2}
              className={cn(
                "px-2 text-[10px] rounded-sm transition-colors",
                selectedLevel === 'l2' 
                  ? "bg-primary/20 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              L2
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
            onClick={onClose}
          >
            <X size={12} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-4 px-3 py-2 bg-muted/30 text-[10px] border-b border-border/30">
            <div className="flex items-center gap-1">
              <Badge className="bg-primary/20 text-primary hover:bg-primary/20 h-4 text-[9px]">R</Badge>
              <span className="text-muted-foreground">Read</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-secondary/20 text-secondary hover:bg-secondary/20 h-4 text-[9px]">W</Badge>
              <span className="text-muted-foreground">Write</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-success/20 text-success h-4 text-[9px]">Hit</Badge>
              <span className="text-muted-foreground">Cache Hit</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-destructive/20 text-destructive h-4 text-[9px]">Miss</Badge>
              <span className="text-muted-foreground">Cache Miss</span>
            </div>
          </div>

          {/* Trace List with Virtualization */}
          <div 
            ref={scrollRef}
            className="overflow-auto"
            style={{ height: sizeRef.current.height - 100 }}
            onScroll={handleScroll}
          >
            {trace.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No trace loaded
              </div>
            ) : (
              <div className="p-1">
                {/* Header */}
                <div className="grid grid-cols-[40px_40px_50px_1fr_1fr] gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                  <span>#</span>
                  <span>Op</span>
                  <span>Result</span>
                  <span>Address</span>
                  <span>Breakdown</span>
                </div>
                
                {/* Virtualized list container */}
                <div style={{ height: totalHeight, position: 'relative' }}>
                  {/* Render only visible rows */}
                  <div style={{ 
                    position: 'absolute', 
                    top: visibleRange.startIndex * ROW_HEIGHT,
                    left: 0,
                    right: 0
                  }}>
                    {trace.slice(visibleRange.startIndex, visibleRange.endIndex).map((entry, i) => {
                      const idx = visibleRange.startIndex + i;
                      const isCurrent = idx === traceIndex - 1;
                      const isPast = idx < traceIndex - 1;
                      const isNext = idx === traceIndex;
                      
                      return (
                        <TraceRow
                          key={idx}
                          entry={entry}
                          idx={idx}
                          isCurrent={isCurrent}
                          isPast={isPast}
                          isNext={isNext}
                          result={traceResults.get(idx)}
                          extractComponents={extractComponents}
                          formatHex={formatHex}
                          rowRef={isCurrent ? currentRowRef : null}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resize Handles */}
          <div 
            className="absolute top-0 left-0 w-1 h-full cursor-w-resize hover:bg-accent/50"
            onMouseDown={(e) => startResize(e, 'w')}
          />
          <div 
            className="absolute top-0 right-0 w-1 h-full cursor-e-resize hover:bg-accent/50"
            onMouseDown={(e) => startResize(e, 'e')}
          />
          <div 
            className="absolute bottom-0 left-0 w-full h-1 cursor-s-resize hover:bg-accent/50"
            onMouseDown={(e) => startResize(e, 's')}
          />
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize hover:bg-accent/50 rounded-tl-md"
            onMouseDown={(e) => startResize(e, 'se')}
          />
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize hover:bg-accent/50 rounded-tr-md"
            onMouseDown={(e) => startResize(e, 'sw')}
          />
        </>
      )}
    </div>
  );
}
