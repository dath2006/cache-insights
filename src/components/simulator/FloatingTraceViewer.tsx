import { useEffect, useRef, useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Minimize2, Maximize2, GripHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingTraceViewerProps {
  open: boolean;
  onClose: () => void;
}

export function FloatingTraceViewer({ open, onClose }: FloatingTraceViewerProps) {
  const trace = useSimulatorStore((s) => s.trace);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);
  const traceIndex = useSimulatorStore((s) => s.traceIndex);

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 450, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Use L1 config if enabled, otherwise L2
  const config = multiLevelConfig.enabled.l1 
    ? multiLevelConfig.l1 
    : multiLevelConfig.l2;

  const offsetBits = Math.log2(config.blockSize);
  const numBlocks = config.cacheSize / config.blockSize;
  const numSets = numBlocks / config.associativity;
  const indexBits = Math.log2(numSets);

  const extractComponents = (address: number) => {
    const offset = address & ((1 << offsetBits) - 1);
    const index = (address >>> offsetBits) & ((1 << indexBits) - 1);
    const tag = address >>> (offsetBits + indexBits);
    return { tag, index, offset };
  };

  const formatHex = (num: number, padLength: number = 8) => {
    return '0x' + num.toString(16).toUpperCase().padStart(padLength, '0');
  };

  // Auto-scroll to current trace index
  useEffect(() => {
    if (scrollRef.current && traceIndex > 0) {
      const rowHeight = 36; // approximate row height
      const scrollTop = (traceIndex - 1) * rowHeight - size.height / 2 + rowHeight;
      scrollRef.current.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
    }
  }, [traceIndex, size.height]);

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y))
      });
    }
    if (isResizing) {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      
      let newWidth = resizeStart.current.width;
      let newHeight = resizeStart.current.height;
      let newX = position.x;
      let newY = position.y;

      if (isResizing.includes('e')) {
        newWidth = Math.max(350, resizeStart.current.width + dx);
      }
      if (isResizing.includes('w')) {
        newWidth = Math.max(350, resizeStart.current.width - dx);
        newX = position.x + (resizeStart.current.width - newWidth);
      }
      if (isResizing.includes('s')) {
        newHeight = Math.max(200, resizeStart.current.height + dy);
      }
      if (isResizing.includes('n')) {
        newHeight = Math.max(200, resizeStart.current.height - dy);
        newY = position.y + (resizeStart.current.height - newHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      if (isResizing.includes('w') || isResizing.includes('n')) {
        setPosition({ x: newX, y: newY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(null);
  };

  const startResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing]);

  if (!open) return null;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 glass-card rounded-xl overflow-hidden shadow-2xl border border-border/50"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 48 : size.height,
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
              <div className="w-2 h-2 rounded bg-primary/50" />
              <span className="text-muted-foreground">Tag</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-secondary/50" />
              <span className="text-muted-foreground">Index</span>
            </div>
          </div>

          {/* Trace List */}
          <div 
            ref={scrollRef}
            className="overflow-auto"
            style={{ height: size.height - 100 }}
          >
            {trace.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No trace loaded
              </div>
            ) : (
              <div className="p-1">
                {/* Header */}
                <div className="grid grid-cols-[40px_40px_1fr_1fr] gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm">
                  <span>#</span>
                  <span>Op</span>
                  <span>Address</span>
                  <span>Breakdown</span>
                </div>
                
                {trace.map((entry, idx) => {
                  const { tag, index, offset } = extractComponents(entry.address);
                  const isCurrent = idx === traceIndex - 1;
                  const isPast = idx < traceIndex - 1;
                  
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "grid grid-cols-[40px_40px_1fr_1fr] gap-1 px-2 py-1.5 text-xs font-mono transition-all duration-200",
                        isCurrent && "bg-primary/20 border-l-2 border-primary rounded-r-md",
                        isPast && "opacity-40",
                        !isCurrent && !isPast && "hover:bg-muted/30"
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
                })}
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
    </motion.div>
  );
}
