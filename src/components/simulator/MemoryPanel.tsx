import { useSimulatorStore } from '@/store/simulatorStore';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HardDrive, Activity, Zap, Info } from 'lucide-react';
import { MemoryType, defaultMemoryConfigs } from '@/lib/cacheSimulator';

interface MemoryPanelProps {
  embedded?: boolean;
}

export function MemoryPanel({ embedded = false }: MemoryPanelProps) {
  const memoryConfig = useSimulatorStore((s) => s.memoryConfig);
  const setMemoryConfig = useSimulatorStore((s) => s.setMemoryConfig);
  const memoryStats = useSimulatorStore((s) => s.memoryStats);

  const sizeOptions = [64, 128, 256, 512, 1024, 2048, 4096];
  const currentSizeIndex = sizeOptions.indexOf(memoryConfig.sizeMB);

  const handleTypeChange = (type: MemoryType) => {
    const defaults = defaultMemoryConfigs[type];
    setMemoryConfig({
      memoryType: type,
      ...defaults,
    });
  };

  const formatBandwidth = (mbps: number) => {
    if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} GB/s`;
    return `${mbps.toFixed(0)} MB/s`;
  };

  const content = (
    <div className="space-y-4">
      {/* Memory Type */}
      <div className="space-y-2">
        <Label className="text-xs">Memory Type</Label>
        <Select
          value={memoryConfig.memoryType}
          onValueChange={(v) => handleTypeChange(v as MemoryType)}
        >
          <SelectTrigger className="bg-muted border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DDR3">DDR3 (Legacy)</SelectItem>
            <SelectItem value="DDR4">DDR4 (Standard)</SelectItem>
            <SelectItem value="DDR5">DDR5 (High Performance)</SelectItem>
            <SelectItem value="SRAM">SRAM (Low Latency)</SelectItem>
            <SelectItem value="Custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Memory Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs">Memory Size</Label>
          <span className="font-mono text-accent text-xs font-bold">
            {memoryConfig.sizeMB >= 1024 
              ? `${(memoryConfig.sizeMB / 1024).toFixed(0)} GB`
              : `${memoryConfig.sizeMB} MB`}
          </span>
        </div>
        <Slider
          value={[currentSizeIndex >= 0 ? currentSizeIndex : 2]}
          min={0}
          max={sizeOptions.length - 1}
          step={1}
          onValueChange={([idx]) => setMemoryConfig({ sizeMB: sizeOptions[idx] })}
          className="py-1"
        />
      </div>

      {/* Latency */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Access Latency</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-2 text-xs">
                <p>Memory access latency in CPU cycles.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-auto font-mono text-accent text-xs font-bold">
            {memoryConfig.latencyCycles} cyc
          </span>
        </div>
        <Slider
          value={[memoryConfig.latencyCycles]}
          min={5}
          max={200}
          step={5}
          onValueChange={([v]) => setMemoryConfig({ latencyCycles: v })}
          className="py-1"
        />
      </div>

      {/* Bus Width */}
      <div className="space-y-2">
        <Label className="text-xs">Bus Width</Label>
        <Select
          value={memoryConfig.busWidthBits.toString()}
          onValueChange={(v) => setMemoryConfig({ busWidthBits: parseInt(v) })}
        >
          <SelectTrigger className="bg-muted border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="32">32-bit</SelectItem>
            <SelectItem value="64">64-bit</SelectItem>
            <SelectItem value="128">128-bit</SelectItem>
            <SelectItem value="256">256-bit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs">Frequency</Label>
          <span className="font-mono text-accent text-xs font-bold">
            {memoryConfig.frequencyMHz} MHz
          </span>
        </div>
        <Slider
          value={[memoryConfig.frequencyMHz]}
          min={800}
          max={6400}
          step={100}
          onValueChange={([v]) => setMemoryConfig({ frequencyMHz: v })}
          className="py-1"
        />
      </div>

      {/* Memory Stats */}
      {memoryStats.totalAccesses > 0 && (
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Activity size={14} className="text-muted-foreground" />
            Statistics
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-[10px] text-muted-foreground">Accesses</div>
              <div className="font-mono text-xs font-bold text-accent">
                {memoryStats.totalAccesses.toLocaleString()}
              </div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-[10px] text-muted-foreground">Transferred</div>
              <div className="font-mono text-xs font-bold text-accent">
                {(memoryStats.bytesTransferred / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>

          <div className="p-2 bg-gradient-to-r from-accent/10 to-primary/10 rounded flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Zap size={12} className="text-accent" />
              <span className="text-xs">Peak BW</span>
            </div>
            <span className="font-mono text-xs font-bold">
              {formatBandwidth(memoryStats.peakBandwidthMBps)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="glass-card rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-lg bg-accent/20">
          <HardDrive className="text-accent" size={20} />
        </div>
        <h2 className="text-lg font-bold">Main Memory</h2>
        <Badge variant="outline" className="ml-auto text-xs">
          {memoryConfig.memoryType}
        </Badge>
      </div>
      {content}
    </div>
  );
}
