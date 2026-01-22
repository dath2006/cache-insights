import { useSimulatorStore } from '@/store/simulatorStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TraceViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TraceViewer({ open, onOpenChange }: TraceViewerProps) {
  const trace = useSimulatorStore((s) => s.trace);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);
  const traceIndex = useSimulatorStore((s) => s.traceIndex);

  // Use L1 config if enabled, otherwise L2
  const config = multiLevelConfig.enabled.l1 
    ? multiLevelConfig.l1 
    : multiLevelConfig.l2;

  // Calculate address components
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Trace File Viewer
            <Badge variant="outline" className="ml-3 text-xs">
              {trace.length.toLocaleString()} entries
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Showing memory access trace with address breakdown (Tag | Index | Offset)
          </DialogDescription>
        </DialogHeader>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary hover:bg-primary/20">R</Badge>
            <span className="text-muted-foreground">Read Operation</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-secondary/20 text-secondary hover:bg-secondary/20">W</Badge>
            <span className="text-muted-foreground">Write Operation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-cyan-500/50" />
            <span className="text-muted-foreground">Tag (cache line ID)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500/50" />
            <span className="text-muted-foreground">Index (set #)</span>
          </div>
        </div>

        {/* Trace List */}
        <ScrollArea className="h-[400px] w-full rounded-lg border border-border">
          {trace.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No trace loaded. Upload a file or generate a pattern.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[60px_60px_1fr_1fr] gap-2 p-2 text-xs font-semibold text-muted-foreground border-b border-border sticky top-0 bg-background">
                <span>#</span>
                <span>Type</span>
                <span>Address</span>
                <span>Breakdown</span>
              </div>
              
              {trace.map((entry, idx) => {
                const { tag, index, offset } = extractComponents(entry.address);
                const isCurrent = idx === traceIndex - 1;
                const isPast = idx < traceIndex;
                
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[60px_60px_1fr_1fr] gap-2 p-2 rounded-md text-sm font-mono transition-colors ${
                      isCurrent
                        ? 'bg-primary/20 border border-primary/50'
                        : isPast
                        ? 'opacity-50'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-muted-foreground">{idx + 1}</span>
                    <Badge
                      className={`w-fit ${
                        entry.isWrite
                          ? 'bg-secondary/20 text-secondary hover:bg-secondary/20'
                          : 'bg-primary/20 text-primary hover:bg-primary/20'
                      }`}
                    >
                      {entry.isWrite ? 'W' : 'R'}
                    </Badge>
                    <span className="text-foreground">{formatHex(entry.address)}</span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400" title="Tag">
                        T:{formatHex(tag, 4)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400" title="Set Index">
                        I:{index}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Block Offset">
                        O:{offset}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-1">
          <p><strong>Tag:</strong> Identifies which memory block is stored in a cache line.</p>
          <p><strong>Index:</strong> Determines which cache set the address maps to.</p>
          <p><strong>Offset:</strong> Byte position within the cache block.</p>
          <p className="pt-2 border-t border-border mt-2">
            Current config: {offsetBits} offset bits, {indexBits} index bits, {32 - offsetBits - indexBits} tag bits
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
