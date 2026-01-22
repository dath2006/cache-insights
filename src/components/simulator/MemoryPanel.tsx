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
import { HardDrive, Activity, Zap, Info, Database } from 'lucide-react';
import { MemoryType, defaultMemoryConfigs } from '@/lib/cacheSimulator';

export function MemoryPanel() {
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

      {/* Memory Type */}
      <div className="space-y-3">
        <Label className="text-sm">Memory Type</Label>
        <Select
          value={memoryConfig.memoryType}
          onValueChange={(v) => handleTypeChange(v as MemoryType)}
        >
          <SelectTrigger className="bg-muted border-border">
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
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm">Memory Size</Label>
          <span className="font-mono text-accent font-bold">
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
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>64 MB</span>
          <span>4 GB</span>
        </div>
      </div>

      {/* Latency */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Access Latency</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-3 text-sm">
                <p>Memory access latency in CPU cycles. Used in AMAT calculation.</p>
                <p className="mt-2 text-muted-foreground text-xs">
                  DDR4: ~80 cycles, DDR5: ~70 cycles, SRAM: ~10 cycles
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-auto font-mono text-accent font-bold">
            {memoryConfig.latencyCycles} cycles
          </span>
        </div>
        <Slider
          value={[memoryConfig.latencyCycles]}
          min={5}
          max={200}
          step={5}
          onValueChange={([v]) => setMemoryConfig({ latencyCycles: v })}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5 (Fast)</span>
          <span>200 (Slow)</span>
        </div>
      </div>

      {/* Bus Width */}
      <div className="space-y-3">
        <Label className="text-sm">Bus Width</Label>
        <Select
          value={memoryConfig.busWidthBits.toString()}
          onValueChange={(v) => setMemoryConfig({ busWidthBits: parseInt(v) })}
        >
          <SelectTrigger className="bg-muted border-border">
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
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm">Frequency</Label>
          <span className="font-mono text-accent font-bold">
            {memoryConfig.frequencyMHz} MHz
          </span>
        </div>
        <Slider
          value={[memoryConfig.frequencyMHz]}
          min={800}
          max={6400}
          step={100}
          onValueChange={([v]) => setMemoryConfig({ frequencyMHz: v })}
          className="py-2"
        />
      </div>

      {/* Memory Stats */}
      {memoryStats.totalAccesses > 0 && (
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity size={16} className="text-muted-foreground" />
            Memory Statistics
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Total Accesses</div>
              <div className="font-mono font-bold text-accent">
                {memoryStats.totalAccesses.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Bytes Transferred</div>
              <div className="font-mono font-bold text-accent">
                {(memoryStats.bytesTransferred / 1024).toFixed(1)} KB
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Avg Latency</div>
              <div className="font-mono font-bold text-accent">
                {memoryStats.averageLatency.toFixed(1)} cyc
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Bandwidth Util.</div>
              <div className="font-mono font-bold text-accent">
                {memoryStats.bandwidthUtilization.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="p-3 bg-gradient-to-r from-accent/10 to-primary/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              <span className="text-sm">Peak Bandwidth</span>
            </div>
            <span className="font-mono font-bold">
              {formatBandwidth(memoryStats.peakBandwidthMBps)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}