import { useSimulatorStore } from '@/store/simulatorStore';
import {
  parseTraceFile,
  generateSequentialTrace,
  generateRandomTrace,
  generateStridedTrace,
  generateTemporalLocalityTrace,
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
import { Upload, Wand2, FileText } from 'lucide-react';
import { useState, useCallback } from 'react';

type PatternType = 'sequential' | 'random' | 'strided' | 'temporal';

const patternDescriptions: Record<PatternType, string> = {
  sequential: 'Array traversal - high spatial locality',
  random: 'Hash table simulation - low locality',
  strided: 'Matrix operations - regular stride pattern',
  temporal: 'Hot/cold data - high temporal locality',
};

export function TraceInput() {
  const setTrace = useSimulatorStore((s) => s.setTrace);
  const trace = useSimulatorStore((s) => s.trace);
  
  const [pattern, setPattern] = useState<PatternType>('sequential');
  const [traceSize, setTraceSize] = useState(1000);
  const [isDragOver, setIsDragOver] = useState(false);

  const generateTrace = useCallback(() => {
    const baseAddress = 0x10000;
    let newTrace;

    switch (pattern) {
      case 'sequential':
        newTrace = generateSequentialTrace(baseAddress, traceSize, 4);
        break;
      case 'random':
        newTrace = generateRandomTrace(baseAddress, 0x10000, traceSize);
        break;
      case 'strided':
        newTrace = generateStridedTrace(baseAddress, traceSize, 64);
        break;
      case 'temporal':
        newTrace = generateTemporalLocalityTrace(baseAddress, 10, 100, Math.floor(traceSize / 150));
        break;
      default:
        newTrace = generateSequentialTrace(baseAddress, traceSize, 4);
    }

    setTrace(newTrace);
  }, [pattern, traceSize, setTrace]);

  const handleFileUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsedTrace = parseTraceFile(content);
        if (parsedTrace.length > 0) {
          setTrace(parsedTrace);
        }
      };
      reader.readAsText(file);
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
          <span className="ml-auto text-sm text-muted-foreground">
            {trace.length.toLocaleString()} entries loaded
          </span>
        )}
      </div>

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
              <SelectItem value="random">Random</SelectItem>
              <SelectItem value="strided">Strided</SelectItem>
              <SelectItem value="temporal">Temporal Locality</SelectItem>
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
