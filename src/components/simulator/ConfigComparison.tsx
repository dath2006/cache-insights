import { useState, useMemo } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Scale, Plus, Trash2, Play, Trophy, Zap, Target, Clock } from 'lucide-react';
import { CacheSimulator, MultiLevelCacheSimulator, CacheConfig, ReplacementPolicy, WritePolicy } from '@/lib/cacheSimulator';
import { cn } from '@/lib/utils';

interface ComparisonConfig {
  id: string;
  name: string;
  l1: CacheConfig;
  l2: CacheConfig;
  enabled: { l1: boolean; l2: boolean };
  results?: {
    l1Hits: number;
    l1Misses: number;
    l1HitRate: number;
    l2Hits: number;
    l2Misses: number;
    l2HitRate: number;
    combinedHitRate: number;
    amat: number;
    totalCycles: number;
  };
}

const defaultL1Config: CacheConfig = {
  cacheSize: 32 * 1024,
  blockSize: 64,
  associativity: 4,
  replacementPolicy: 'LRU',
  writePolicy: 'write-back',
};

const defaultL2Config: CacheConfig = {
  cacheSize: 256 * 1024,
  blockSize: 64,
  associativity: 8,
  replacementPolicy: 'LRU',
  writePolicy: 'write-back',
};

export function ConfigComparison() {
  const trace = useSimulatorStore((s) => s.trace);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);
  const memoryConfig = useSimulatorStore((s) => s.memoryConfig);
  
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<ComparisonConfig[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New config form state
  const [newConfig, setNewConfig] = useState<Omit<ComparisonConfig, 'id' | 'results'>>({
    name: 'Config 1',
    l1: { ...defaultL1Config },
    l2: { ...defaultL2Config },
    enabled: { l1: true, l2: false },
  });

  // Add current config when opening
  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && configs.length === 0) {
      // Add current configuration as the first comparison
      setConfigs([{
        id: crypto.randomUUID(),
        name: 'Current Config',
        l1: { ...multiLevelConfig.l1 },
        l2: { ...multiLevelConfig.l2 },
        enabled: { ...multiLevelConfig.enabled },
      }]);
    }
  };

  const addConfig = () => {
    setConfigs([...configs, {
      id: crypto.randomUUID(),
      ...newConfig,
      name: newConfig.name || `Config ${configs.length + 1}`,
    }]);
    setNewConfig({
      name: `Config ${configs.length + 2}`,
      l1: { ...defaultL1Config },
      l2: { ...defaultL2Config },
      enabled: { l1: true, l2: false },
    });
    setShowAddForm(false);
  };

  const removeConfig = (id: string) => {
    setConfigs(configs.filter(c => c.id !== id));
  };

  const runComparison = async () => {
    if (trace.length === 0) return;
    
    setIsRunning(true);
    
    // Run simulation for each config
    const updatedConfigs = configs.map(config => {
      const simulator = new MultiLevelCacheSimulator(
        { l1: config.l1, l2: config.l2, enabled: config.enabled },
        memoryConfig
      );
      
      let totalCycles = 0;
      const l1HitTime = 1;
      const l2HitTime = 10;
      
      for (const entry of trace) {
        const result = simulator.access(entry.address, entry.isWrite);
        
        if (result.l1Result?.hit) {
          totalCycles += l1HitTime;
        } else if (result.l2Result?.hit) {
          totalCycles += l1HitTime + l2HitTime;
        } else {
          totalCycles += l1HitTime + (config.enabled.l2 ? l2HitTime : 0) + memoryConfig.latencyCycles;
        }
      }
      
      const l1Stats = simulator.getL1Stats() ?? { hits: 0, misses: 0, totalAccesses: 0, hitRate: 0, writebacks: 0 };
      const l2Stats = simulator.getL2Stats() ?? { hits: 0, misses: 0, totalAccesses: 0, hitRate: 0, writebacks: 0 };
      
      // Calculate combined hit rate
      const l1HitRate = l1Stats.totalAccesses > 0 ? l1Stats.hits / l1Stats.totalAccesses : 0;
      const l2HitRate = l2Stats.totalAccesses > 0 ? l2Stats.hits / l2Stats.totalAccesses : 0;
      const l1MissRate = 1 - l1HitRate;
      const l2MissRate = 1 - l2HitRate;
      
      // Combined hit rate = L1 hit rate + L1 miss rate * L2 hit rate
      const combinedHitRate = config.enabled.l2 
        ? l1HitRate + l1MissRate * l2HitRate
        : l1HitRate;
      
      // AMAT calculation
      const amat = config.enabled.l2
        ? l1HitTime + l1MissRate * (l2HitTime + l2MissRate * memoryConfig.latencyCycles)
        : l1HitTime + l1MissRate * memoryConfig.latencyCycles;
      
      return {
        ...config,
        results: {
          l1Hits: l1Stats.hits,
          l1Misses: l1Stats.misses,
          l1HitRate: l1HitRate * 100,
          l2Hits: l2Stats.hits,
          l2Misses: l2Stats.misses,
          l2HitRate: l2HitRate * 100,
          combinedHitRate: combinedHitRate * 100,
          amat,
          totalCycles,
        },
      };
    });
    
    setConfigs(updatedConfigs);
    setIsRunning(false);
  };

  // Find best config for each metric
  const bestMetrics = useMemo(() => {
    const configsWithResults = configs.filter(c => c.results);
    if (configsWithResults.length === 0) return null;
    
    return {
      bestHitRate: configsWithResults.reduce((best, c) => 
        (c.results!.combinedHitRate > (best.results?.combinedHitRate || 0)) ? c : best
      ).id,
      bestAmat: configsWithResults.reduce((best, c) => 
        (c.results!.amat < (best.results?.amat || Infinity)) ? c : best
      ).id,
      bestCycles: configsWithResults.reduce((best, c) => 
        (c.results!.totalCycles < (best.results?.totalCycles || Infinity)) ? c : best
      ).id,
    };
  }, [configs]);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Scale size={16} />
          Compare Configs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="text-primary" size={20} />
            Configuration Comparison
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="text-sm text-muted-foreground">
            {trace.length > 0 ? (
              <span>Trace loaded: <Badge variant="secondary">{trace.length.toLocaleString()} accesses</Badge></span>
            ) : (
              <span className="text-destructive">No trace loaded - please load a trace first</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1"
            >
              <Plus size={14} />
              Add Config
            </Button>
            <Button 
              size="sm" 
              onClick={runComparison}
              disabled={trace.length === 0 || configs.length === 0 || isRunning}
              className="gap-1"
            >
              <Play size={14} />
              {isRunning ? 'Running...' : 'Run Comparison'}
            </Button>
          </div>
        </div>

        {/* Add Config Form */}
        {showAddForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">New Configuration</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Config Name</Label>
                <Input 
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  placeholder="Configuration name"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>L1 Cache</Label>
                  <Switch 
                    checked={newConfig.enabled.l1}
                    onCheckedChange={(v) => setNewConfig({ 
                      ...newConfig, 
                      enabled: { ...newConfig.enabled, l1: v }
                    })}
                  />
                </div>
                {newConfig.enabled.l1 && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Size: {formatSize(newConfig.l1.cacheSize)}</span>
                      <Slider
                        value={[Math.log2(newConfig.l1.cacheSize / 1024)]}
                        min={2}
                        max={10}
                        step={1}
                        className="w-24"
                        onValueChange={([v]) => setNewConfig({
                          ...newConfig,
                          l1: { ...newConfig.l1, cacheSize: Math.pow(2, v) * 1024 }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Assoc: {newConfig.l1.associativity}-way</span>
                      <Select
                        value={String(newConfig.l1.associativity)}
                        onValueChange={(v) => setNewConfig({
                          ...newConfig,
                          l1: { ...newConfig.l1, associativity: parseInt(v) }
                        })}
                      >
                        <SelectTrigger className="w-20 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 4, 8, 16].map(a => (
                            <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Policy:</span>
                      <Select
                        value={newConfig.l1.replacementPolicy}
                        onValueChange={(v) => setNewConfig({
                          ...newConfig,
                          l1: { ...newConfig.l1, replacementPolicy: v as ReplacementPolicy }
                        })}
                      >
                        <SelectTrigger className="w-20 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['LRU', 'FIFO', 'LFU', 'RANDOM'].map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>L2 Cache</Label>
                  <Switch 
                    checked={newConfig.enabled.l2}
                    onCheckedChange={(v) => setNewConfig({ 
                      ...newConfig, 
                      enabled: { ...newConfig.enabled, l2: v }
                    })}
                  />
                </div>
                {newConfig.enabled.l2 && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Size: {formatSize(newConfig.l2.cacheSize)}</span>
                      <Slider
                        value={[Math.log2(newConfig.l2.cacheSize / 1024)]}
                        min={4}
                        max={14}
                        step={1}
                        className="w-24"
                        onValueChange={([v]) => setNewConfig({
                          ...newConfig,
                          l2: { ...newConfig.l2, cacheSize: Math.pow(2, v) * 1024 }
                        })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Assoc: {newConfig.l2.associativity}-way</span>
                      <Select
                        value={String(newConfig.l2.associativity)}
                        onValueChange={(v) => setNewConfig({
                          ...newConfig,
                          l2: { ...newConfig.l2, associativity: parseInt(v) }
                        })}
                      >
                        <SelectTrigger className="w-20 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 4, 8, 16, 32].map(a => (
                            <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Policy:</span>
                      <Select
                        value={newConfig.l2.replacementPolicy}
                        onValueChange={(v) => setNewConfig({
                          ...newConfig,
                          l2: { ...newConfig.l2, replacementPolicy: v as ReplacementPolicy }
                        })}
                      >
                        <SelectTrigger className="w-20 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['LRU', 'FIFO', 'LFU', 'RANDOM'].map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Button onClick={addConfig} className="w-full">Add Configuration</Button>
          </div>
        )}

        {/* Results Table */}
        <ScrollArea className="flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Configuration</TableHead>
                <TableHead className="text-center">L1 Size</TableHead>
                <TableHead className="text-center">L1 Assoc</TableHead>
                <TableHead className="text-center">L2 Size</TableHead>
                <TableHead className="text-center">L2 Assoc</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Target size={12} />
                    L1 Hit%
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Target size={12} />
                    L2 Hit%
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Trophy size={12} className="text-primary" />
                    Combined Hit%
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Zap size={12} className="text-accent" />
                    AMAT
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Clock size={12} />
                    Cycles
                  </div>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No configurations added. Click "Add Config" to start comparing.
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {config.name}
                        {config.results && bestMetrics?.bestHitRate === config.id && (
                          <Badge variant="default" className="text-[10px] px-1">Best</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {config.enabled.l1 ? formatSize(config.l1.cacheSize) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.enabled.l1 ? `${config.l1.associativity}-way` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.enabled.l2 ? formatSize(config.l2.cacheSize) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.enabled.l2 ? `${config.l2.associativity}-way` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.results ? (
                        <span className={cn(
                          "font-mono",
                          config.results.l1HitRate >= 90 ? "text-primary" : 
                          config.results.l1HitRate >= 70 ? "text-accent" : "text-destructive"
                        )}>
                          {config.results.l1HitRate.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.results && config.enabled.l2 ? (
                        <span className={cn(
                          "font-mono",
                          config.results.l2HitRate >= 90 ? "text-primary" : 
                          config.results.l2HitRate >= 70 ? "text-accent" : "text-destructive"
                        )}>
                          {config.results.l2HitRate.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.results ? (
                        <span className={cn(
                          "font-mono font-bold",
                          bestMetrics?.bestHitRate === config.id ? "text-primary" : "",
                          config.results.combinedHitRate >= 95 ? "text-primary" : 
                          config.results.combinedHitRate >= 80 ? "text-accent" : "text-destructive"
                        )}>
                          {config.results.combinedHitRate.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.results ? (
                        <span className={cn(
                          "font-mono",
                          bestMetrics?.bestAmat === config.id ? "text-primary font-bold" : ""
                        )}>
                          {config.results.amat.toFixed(2)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.results ? (
                        <span className={cn(
                          "font-mono text-sm",
                          bestMetrics?.bestCycles === config.id ? "text-primary font-bold" : ""
                        )}>
                          {config.results.totalCycles.toLocaleString()}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => removeConfig(config.id)}
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Insights */}
        {bestMetrics && configs.some(c => c.results) && (
          <div className="border-t pt-4 space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Trophy size={14} className="text-primary" />
              Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-muted-foreground text-xs">Best Hit Rate</div>
                <div className="font-bold text-primary">
                  {configs.find(c => c.id === bestMetrics.bestHitRate)?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {configs.find(c => c.id === bestMetrics.bestHitRate)?.results?.combinedHitRate.toFixed(2)}% combined
                </div>
              </div>
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                <div className="text-muted-foreground text-xs">Lowest AMAT</div>
                <div className="font-bold text-accent">
                  {configs.find(c => c.id === bestMetrics.bestAmat)?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {configs.find(c => c.id === bestMetrics.bestAmat)?.results?.amat.toFixed(2)} cycles
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                <div className="text-muted-foreground text-xs">Fastest Execution</div>
                <div className="font-bold">
                  {configs.find(c => c.id === bestMetrics.bestCycles)?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {configs.find(c => c.id === bestMetrics.bestCycles)?.results?.totalCycles.toLocaleString()} cycles
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
