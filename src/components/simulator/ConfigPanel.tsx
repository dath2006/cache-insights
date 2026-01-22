import { useSimulatorStore } from '@/store/simulatorStore';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Settings, Save, FolderOpen, Trash2, Info } from 'lucide-react';
import { useState } from 'react';

export function ConfigPanel() {
  const config = useSimulatorStore((s) => s.config);
  const setConfig = useSimulatorStore((s) => s.setConfig);
  const savedConfigs = useSimulatorStore((s) => s.savedConfigs);
  const saveConfig = useSimulatorStore((s) => s.saveConfig);
  const loadConfig = useSimulatorStore((s) => s.loadConfig);
  const deleteConfig = useSimulatorStore((s) => s.deleteConfig);
  const resetSimulator = useSimulatorStore((s) => s.resetSimulator);

  const [configName, setConfigName] = useState('');

  const cacheSizeKB = config.cacheSize / 1024;
  const cacheSizeOptions = [1, 2, 4, 8, 16, 32, 64];
  const currentSizeIndex = cacheSizeOptions.indexOf(cacheSizeKB);

  const handleSave = () => {
    if (configName.trim()) {
      saveConfig(configName.trim());
      setConfigName('');
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-lg bg-primary/20">
          <Settings className="text-primary" size={20} />
        </div>
        <h2 className="text-lg font-bold">Configuration</h2>
      </div>

      {/* Cache Size */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm">Cache Size</Label>
          <span className="font-mono text-primary font-bold">{cacheSizeKB} KB</span>
        </div>
        <Slider
          value={[currentSizeIndex >= 0 ? currentSizeIndex : 2]}
          min={0}
          max={cacheSizeOptions.length - 1}
          step={1}
          onValueChange={([idx]) => setConfig({ cacheSize: cacheSizeOptions[idx] * 1024 })}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1KB</span>
          <span>64KB</span>
        </div>
      </div>

      {/* Block Size */}
      <div className="space-y-3">
        <Label className="text-sm">Block Size</Label>
        <Select
          value={config.blockSize.toString()}
          onValueChange={(v) => setConfig({ blockSize: parseInt(v) })}
        >
          <SelectTrigger className="bg-muted border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16">16 bytes</SelectItem>
            <SelectItem value="32">32 bytes</SelectItem>
            <SelectItem value="64">64 bytes</SelectItem>
            <SelectItem value="128">128 bytes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Associativity */}
      <div className="space-y-3">
        <Label className="text-sm">Associativity</Label>
        <Select
          value={config.associativity.toString()}
          onValueChange={(v) => setConfig({ associativity: parseInt(v) })}
        >
          <SelectTrigger className="bg-muted border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Direct Mapped</SelectItem>
            <SelectItem value="2">2-way Set Assoc.</SelectItem>
            <SelectItem value="4">4-way Set Assoc.</SelectItem>
            <SelectItem value="8">8-way Set Assoc.</SelectItem>
            <SelectItem value="16">Fully Assoc. (16-way)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Replacement Policy */}
      <div className="space-y-3">
        <Label className="text-sm">Replacement Policy</Label>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className={config.replacementPolicy === 'FIFO' ? 'text-muted-foreground' : 'text-primary font-semibold'}>
            LRU
          </span>
          <Switch
            checked={config.replacementPolicy === 'FIFO'}
            onCheckedChange={(checked) =>
              setConfig({ replacementPolicy: checked ? 'FIFO' : 'LRU' })
            }
          />
          <span className={config.replacementPolicy === 'FIFO' ? 'text-secondary font-semibold' : 'text-muted-foreground'}>
            FIFO
          </span>
        </div>
      </div>

      {/* Write Policy */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Write Policy</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={14} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-3 text-sm" side="right">
                <p className="font-semibold mb-2">Write Policy & Allocation:</p>
                <p className="mb-2">
                  <strong className="text-primary">Write-Back</strong> = Write-Allocate<br />
                  <span className="text-muted-foreground text-xs">On miss: load block to cache, then write. Data written to main memory only on eviction.</span>
                </p>
                <p>
                  <strong className="text-secondary">Write-Through</strong> = No-Write-Allocate<br />
                  <span className="text-muted-foreground text-xs">On miss: write directly to main memory without loading to cache.</span>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex flex-col">
            <span className={config.writePolicy === 'write-through' ? 'text-muted-foreground' : 'text-primary font-semibold'}>
              Write-Back
            </span>
            <span className="text-[10px] text-muted-foreground">+ Write-Allocate</span>
          </div>
          <Switch
            checked={config.writePolicy === 'write-through'}
            onCheckedChange={(checked) =>
              setConfig({ writePolicy: checked ? 'write-through' : 'write-back' })
            }
          />
          <div className="flex flex-col items-end">
            <span className={config.writePolicy === 'write-through' ? 'text-secondary font-semibold' : 'text-muted-foreground'}>
              Write-Through
            </span>
            <span className="text-[10px] text-muted-foreground">+ No-Write-Allocate</span>
          </div>
        </div>
      </div>

      <Button
        onClick={resetSimulator}
        variant="outline"
        className="w-full border-border hover:bg-muted"
      >
        Reset Cache
      </Button>

      {/* Saved Configs */}
      <div className="space-y-3 pt-4 border-t border-border">
        <Label className="text-sm">Save Configuration</Label>
        <div className="flex gap-2">
          <Input
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="Config name..."
            className="bg-muted border-border"
          />
          <Button onClick={handleSave} size="icon" variant="outline" className="shrink-0">
            <Save size={16} />
          </Button>
        </div>

        {savedConfigs.length > 0 && (
          <div className="space-y-2 mt-4">
            <Label className="text-xs text-muted-foreground">Saved Configs</Label>
            {savedConfigs.map((cfg) => (
              <div
                key={cfg.name}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <span className="text-sm truncate">{cfg.name}</span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => loadConfig(cfg.name)}
                  >
                    <FolderOpen size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteConfig(cfg.name)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
