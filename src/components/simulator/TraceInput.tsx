import { useSimulatorStore } from '@/store/simulatorStore';
import {
  parseTraceFile,
  parseTraceFileChunked,
  parseTraceFileSampled,
  generateSequentialTrace,
  generateRandomTrace,
  generateStridedTrace,
  generateTemporalLocalityTrace,
  generateWorkingSetTrace,
  generateThrashingTrace,
  generateLRUKillerTrace,
  generateZipfianTrace,
  generateScanWithReuseTrace,
} from '@/lib/cacheSimulator';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Wand2, FileText, Eye } from 'lucide-react';
import { useState, useCallback } from 'react';
import { TraceViewer } from './TraceViewer';

type PatternType = 'sequential' | 'random' | 'strided' | 'temporal' | 'workingset' | 'thrashing' | 'lrukiller' | 'zipfian' | 'scanreuse';

const patternDescriptions: Record<PatternType, string> = {
  sequential: 'Array traversal - high spatial locality',
  random: 'Random access - minimal locality (1MB range)',
  strided: 'Matrix operations - regular stride pattern',
  temporal: 'Hot/cold data - tests frequency-based policies',
  workingset: 'Fixed working set - tests capacity limits',
  thrashing: 'Cache thrashing - forces constant evictions',
  lrukiller: 'LRU adversarial - exposes LRU weaknesses',
  zipfian: 'Zipfian distribution - realistic web/DB access',
  scanreuse: 'Scan with reuse - tests associativity benefits',
};

export function TraceInput() {
  const setTrace = useSimulatorStore((s) => s.setTrace);
  const trace = useSimulatorStore((s) => s.trace);
  
  const [pattern, setPattern] = useState<PatternType>('sequential');
  const [traceSize, setTraceSize] = useState(1000);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const generateTrace = useCallback(() => {
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
        newTrace = generateStridedTrace(baseAddress, traceSize, 256); // Larger stride
        break;
      case 'temporal':
        newTrace = generateTemporalLocalityTrace(baseAddress, 50, 500, Math.max(1, Math.floor(traceSize / 500)));
        break;
      case 'workingset':
        newTrace = generateWorkingSetTrace(baseAddress, 32, traceSize); // 32KB working set
        break;
      case 'thrashing':
        newTrace = generateThrashingTrace(baseAddress, 8, traceSize); // Thrash an 8KB cache
        break;
      case 'lrukiller':
        newTrace = generateLRUKillerTrace(baseAddress, 4, traceSize); // 4-way associativity killer
        break;
      case 'zipfian':
        newTrace = generateZipfianTrace(baseAddress, 1000, traceSize, 1.2); // 1000 items, skew 1.2
        break;
      case 'scanreuse':
        newTrace = generateScanWithReuseTrace(baseAddress, 256, 32, traceSize); // 256 elements, reuse distance 32
        break;
      default:
        newTrace = generateSequentialTrace(baseAddress, traceSize, 4);
    }

    setTrace(newTrace);
  }, [pattern, traceSize, setTrace]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const fileSizeMB = file.size / (1024 * 1024);
      
      // Warn for large files
      if (fileSizeMB > 50) {
        const proceed = confirm(
          `This file is ${fileSizeMB.toFixed(1)}MB. Large files may take time to process. Continue?`
        );
        if (!proceed) return;
      }
      
      setIsLoading(true);
      setLoadProgress(0);
      
      try {
        const content = await file.text();
        
        // For very large files, offer sampling
        if (fileSizeMB > 100) {
          const useSampling = confirm(
            `This file is very large (${fileSizeMB.toFixed(1)}MB, ~${(content.split('\n').length / 1000).toFixed(0)}K lines). \n\n` +
            `Load every 10th line for faster preview? (Click Cancel to load all lines)`
          );
          
          if (useSampling) {
            const parsedTrace = parseTraceFileSampled(content, 10);
            if (parsedTrace.length > 0) {
              setTrace(parsedTrace);
            }
          } else {
            const parsedTrace = await parseTraceFileChunked(content, setLoadProgress);
            if (parsedTrace.length > 0) {
              setTrace(parsedTrace);
            }
          }
        } else if (fileSizeMB > 10) {
          // Use chunked parsing for medium-large files
          const parsedTrace = await parseTraceFileChunked(content, setLoadProgress);
          if (parsedTrace.length > 0) {
            setTrace(parsedTrace);
          }
        } else {
          // Use synchronous parsing for small files
          const parsedTrace = parseTraceFile(content);
          if (parsedTrace.length > 0) {
            setTrace(parsedTrace);
          }
        }
      } catch (error) {
        console.error('Failed to parse trace file:', error);
        alert('Failed to parse trace file. Please check the format.');
      } finally {
        setIsLoading(false);
        setLoadProgress(0);
      }
    },
    [setTrace]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-lg bg-secondary/20">
          <FileText className="text-secondary" size={20} />
        </div>
        <h2 className="text-lg font-bold">Trace Input</h2>
        {trace.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {trace.length.toLocaleString()} entries
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewerOpen(true)}
              className="h-7 px-2 text-xs"
            >
              <Eye size={14} className="mr-1" />
              View
            </Button>
          </div>
        )}
      </div>

      <TraceViewer open={viewerOpen} onOpenChange={setViewerOpen} />

      {/* File Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        }`}
      >
        {isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading trace file...</span>
            </div>
            {loadProgress > 0 && (
              <div className="space-y-1">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{loadProgress}%</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <Upload className="mx-auto text-muted-foreground mb-2" size={24} />
            <p className="text-sm text-muted-foreground mb-2">
              Drop a .trace file here or
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
              <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-2">
              Format: R/W &lt;hex_address&gt; per line
            </p>
          </>
        )}
      </div>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="px-4 text-xs text-muted-foreground uppercase">or generate</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Pattern Generator */}
      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-sm">Access Pattern</Label>
          <Select value={pattern} onValueChange={(v) => setPattern(v as PatternType)}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential</SelectItem>
              <SelectItem value="random">Random (Large Range)</SelectItem>
              <SelectItem value="strided">Strided</SelectItem>
              <SelectItem value="temporal">Temporal Locality</SelectItem>
              <SelectItem value="workingset">Working Set Scan</SelectItem>
              <SelectItem value="thrashing">Cache Thrashing</SelectItem>
              <SelectItem value="lrukiller">LRU Killer</SelectItem>
              <SelectItem value="zipfian">Zipfian Distribution</SelectItem>
              <SelectItem value="scanreuse">Scan with Reuse</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{patternDescriptions[pattern]}</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-sm">Trace Size</Label>
            <span className="font-mono text-primary font-bold">
              {traceSize.toLocaleString()}
            </span>
          </div>
          <Slider
            value={[traceSize]}
            min={100}
            max={10000}
            step={100}
            onValueChange={([v]) => setTraceSize(v)}
            className="py-2"
          />
        </div>

        <Button
          onClick={generateTrace}
          className="w-full bg-gradient-to-r from-secondary to-primary hover:opacity-90"
        >
          <Wand2 className="mr-2" size={16} />
          Generate Trace
        </Button>
      </div>
    </div>
  );
}
