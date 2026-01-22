import { useEffect, useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { StatsBar } from '@/components/simulator/StatsBar';
import { ConfigPanel } from '@/components/simulator/ConfigPanel';
import { CacheGrid } from '@/components/simulator/CacheGrid';
import { PlaybackControls } from '@/components/simulator/PlaybackControls';
import { Optimizer } from '@/components/simulator/Optimizer';
import { MemoryPanel } from '@/components/simulator/MemoryPanel';
import { MemoryVisualizer } from '@/components/simulator/MemoryVisualizer';
import { ConfigComparison } from '@/components/simulator/ConfigComparison';
import { CollapsiblePanel } from '@/components/simulator/CollapsiblePanel';
import { TraceInput } from '@/components/simulator/TraceInput';
import { Cpu, Settings, FileText, Wand2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const Index = () => {
  const initSimulator = useSimulatorStore((s) => s.initSimulator);
  const simulator = useSimulatorStore((s) => s.simulator);

  // Track collapsed states for responsive layout
  const [configOpen, setConfigOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [optimizerOpen, setOptimizerOpen] = useState(true);

  useEffect(() => {
    if (!simulator) {
      initSimulator();
    }
  }, [simulator, initSimulator]);

  // Calculate dynamic column spans based on collapsed states
  const leftCollapsed = !configOpen && !traceOpen;
  const rightCollapsed = !rightPanelOpen;

  const getLeftColSpan = () => {
    if (leftCollapsed) return 'lg:col-span-0 lg:hidden';
    return 'lg:col-span-3';
  };

  const getCenterColSpan = () => {
    if (leftCollapsed && rightCollapsed) return 'lg:col-span-12';
    if (leftCollapsed) return 'lg:col-span-9';
    if (rightCollapsed) return 'lg:col-span-9';
    return 'lg:col-span-6';
  };

  const getRightColSpan = () => {
    if (rightCollapsed) return 'lg:col-span-0 lg:hidden';
    return 'lg:col-span-3';
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 glow-cyan">
            <Cpu className="text-primary" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold neon-text-cyan">CacheLab-Pro</h1>
            <p className="text-sm text-muted-foreground">
              Intelligent Cache & Memory Hierarchy Simulator
            </p>
          </div>
        </div>
        <StatsBar />
      </header>

      {/* Quick toggles for collapsed panels */}
      {(leftCollapsed || rightCollapsed) && (
        <div className="flex gap-2 mb-4">
          {leftCollapsed && (
            <>
              <button
                onClick={() => setConfigOpen(true)}
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-2"
              >
                <Settings size={14} />
                Config
              </button>
              <button
                onClick={() => setTraceOpen(true)}
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-2"
              >
                <FileText size={14} />
                Trace
              </button>
            </>
          )}
          {rightCollapsed && (
            <button
              onClick={() => setRightPanelOpen(true)}
              className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-2 ml-auto"
            >
              Memory Hierarchy
            </button>
          )}
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Sidebar - Config & Trace Input */}
        <div className={cn('space-y-4 transition-all duration-300', getLeftColSpan())}>
          <CollapsiblePanel
            title="Configuration"
            icon={<Settings size={18} className="text-primary" />}
            defaultOpen={configOpen}
            onToggle={setConfigOpen}
          >
            <Tabs defaultValue="cache" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="cache" className="text-xs">Cache</TabsTrigger>
                <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
              </TabsList>
              <TabsContent value="cache" className="mt-3">
                <ConfigPanel />
              </TabsContent>
              <TabsContent value="memory" className="mt-3">
                <MemoryPanel />
              </TabsContent>
            </Tabs>
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Trace Input"
            icon={<FileText size={18} className="text-secondary" />}
            defaultOpen={traceOpen}
            onToggle={setTraceOpen}
          >
            <TraceInputContent />
          </CollapsiblePanel>
        </div>

        {/* Main Content - Cache Grid & Controls */}
        <div className={cn('space-y-4 transition-all duration-300', getCenterColSpan())}>
          <div className={cn(
            'transition-all duration-300',
            !optimizerOpen ? 'h-[650px]' : 'h-[500px]'
          )}>
            <CacheGrid />
          </div>
          <PlaybackControls />
          
          <CollapsiblePanel
            title="Sweet Spot Optimizer"
            icon={<Wand2 size={18} className="text-primary" />}
            defaultOpen={optimizerOpen}
            onToggle={setOptimizerOpen}
          >
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <Optimizer />
              </div>
              <ConfigComparison />
            </div>
          </CollapsiblePanel>
        </div>

        {/* Right Sidebar - Memory Hierarchy Visualization */}
        <div className={cn('transition-all duration-300', getRightColSpan())}>
          <MemoryVisualizer 
            defaultOpen={rightPanelOpen}
            onToggle={setRightPanelOpen}
          />
        </div>
      </div>
    </div>
  );
};

// Simplified TraceInput content for the collapsible panel
function TraceInputContent() {
  const setTrace = useSimulatorStore((s) => s.setTrace);
  const trace = useSimulatorStore((s) => s.trace);
  
  const [pattern, setPattern] = useState<'sequential' | 'random' | 'strided' | 'temporal' | 'workingset' | 'thrashing' | 'lrukiller' | 'zipfian' | 'scanreuse'>('sequential');
  const [traceSize, setTraceSize] = useState(1000);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Dynamic imports to avoid circular dependencies
  const { TraceViewer } = require('@/components/simulator/TraceViewer');
  const { parseTraceFile, generateSequentialTrace, generateRandomTrace, generateStridedTrace, generateTemporalLocalityTrace, generateWorkingSetTrace, generateThrashingTrace, generateLRUKillerTrace, generateZipfianTrace, generateScanWithReuseTrace } = require('@/lib/cacheSimulator');
  const { Button } = require('@/components/ui/button');
  const { Label } = require('@/components/ui/label');
  const { Slider } = require('@/components/ui/slider');
  const { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = require('@/components/ui/select');
  const { Upload, Wand2, Eye } = require('lucide-react');

  const patternDescriptions: Record<string, string> = {
    sequential: 'Array traversal - high spatial locality',
    random: 'Random access - minimal locality',
    strided: 'Matrix operations - stride pattern',
    temporal: 'Hot/cold data - frequency-based',
    workingset: 'Fixed working set - capacity tests',
    thrashing: 'Cache thrashing - eviction stress',
    lrukiller: 'LRU adversarial pattern',
    zipfian: 'Zipfian distribution - realistic',
    scanreuse: 'Scan with reuse pattern',
  };

  const generateTrace = () => {
    const baseAddress = 0x10000;
    let newTrace;

    switch (pattern) {
      case 'sequential':
        newTrace = generateSequentialTrace(baseAddress, traceSize, 4);
        break;
      case 'random':
        newTrace = generateRandomTrace(baseAddress, 0x100000, traceSize);
        break;
      case 'strided':
        newTrace = generateStridedTrace(baseAddress, traceSize, 256);
        break;
      case 'temporal':
        newTrace = generateTemporalLocalityTrace(baseAddress, 50, 500, Math.max(1, Math.floor(traceSize / 500)));
        break;
      case 'workingset':
        newTrace = generateWorkingSetTrace(baseAddress, 32, traceSize);
        break;
      case 'thrashing':
        newTrace = generateThrashingTrace(baseAddress, 8, traceSize);
        break;
      case 'lrukiller':
        newTrace = generateLRUKillerTrace(baseAddress, 4, traceSize);
        break;
      case 'zipfian':
        newTrace = generateZipfianTrace(baseAddress, 1000, traceSize, 1.2);
        break;
      case 'scanreuse':
        newTrace = generateScanWithReuseTrace(baseAddress, 256, 32, traceSize);
        break;
      default:
        newTrace = generateSequentialTrace(baseAddress, traceSize, 4);
    }

    setTrace(newTrace);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsedTrace = parseTraceFile(content);
      if (parsedTrace.length > 0) {
        setTrace(parsedTrace);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      {trace.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {trace.length.toLocaleString()} entries
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewerOpen(true)}
            className="h-6 px-2 text-[10px] ml-auto"
          >
            <Eye size={12} className="mr-1" />
            View
          </Button>
        </div>
      )}

      <TraceViewer open={viewerOpen} onOpenChange={setViewerOpen} />

      {/* File Upload */}
      <div
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileUpload(file);
        }}
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <Upload className="mx-auto text-muted-foreground mb-1" size={18} />
        <p className="text-[10px] text-muted-foreground mb-1">
          Drop .trace file or
        </p>
        <label>
          <input
            type="file"
            accept=".trace,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <Button variant="outline" size="sm" className="cursor-pointer text-[10px] h-6" asChild>
            <span>Browse</span>
          </Button>
        </label>
      </div>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="px-2 text-[10px] text-muted-foreground">or generate</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Pattern Generator */}
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label className="text-[10px]">Pattern</Label>
          <Select value={pattern} onValueChange={(v: any) => setPattern(v)}>
            <SelectTrigger className="bg-muted border-border h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential</SelectItem>
              <SelectItem value="random">Random</SelectItem>
              <SelectItem value="strided">Strided</SelectItem>
              <SelectItem value="temporal">Temporal</SelectItem>
              <SelectItem value="workingset">Working Set</SelectItem>
              <SelectItem value="thrashing">Thrashing</SelectItem>
              <SelectItem value="lrukiller">LRU Killer</SelectItem>
              <SelectItem value="zipfian">Zipfian</SelectItem>
              <SelectItem value="scanreuse">Scan+Reuse</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground">{patternDescriptions[pattern]}</p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <Label className="text-[10px]">Size</Label>
            <span className="font-mono text-primary text-[10px] font-bold">
              {traceSize.toLocaleString()}
            </span>
          </div>
          <Slider
            value={[traceSize]}
            min={100}
            max={10000}
            step={100}
            onValueChange={([v]: number[]) => setTraceSize(v)}
            className="py-0.5"
          />
        </div>

        <Button
          onClick={generateTrace}
          className="w-full bg-gradient-to-r from-secondary to-primary hover:opacity-90 h-7 text-[10px]"
        >
          <Wand2 className="mr-1" size={12} />
          Generate
        </Button>
      </div>
    </div>
  );
}

export default Index;
