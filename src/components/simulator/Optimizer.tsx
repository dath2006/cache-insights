import { useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import {
  runOptimization,
  runMultiLevelOptimization,
  runSingleLevelOptimization,
  OptimizationResult,
  MultiLevelOptimizationResult,
} from '@/lib/cacheSimulator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Wand2, Trophy, TrendingUp, Layers, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

type OptimizationMode = 'single' | 'multi';

interface OptimizerProps {
  embedded?: boolean;
}

export function Optimizer({ embedded = false }: OptimizerProps) {
  const [mode, setMode] = useState<OptimizationMode>('multi');
  const trace = useSimulatorStore((s) => s.trace);
  const multiLevelConfig = useSimulatorStore((s) => s.multiLevelConfig);
  const setL1Config = useSimulatorStore((s) => s.setL1Config);
  const setL2Config = useSimulatorStore((s) => s.setL2Config);
  const toggleCacheLevel = useSimulatorStore((s) => s.toggleCacheLevel);

  const [singleResults, setSingleResults] = useState<OptimizationResult[]>([]);
  const [multiResults, setMultiResults] = useState<MultiLevelOptimizationResult[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = () => {
    if (trace.length === 0) return;

    setIsOptimizing(true);

    setTimeout(() => {
      if (mode === 'single') {
        const results = runSingleLevelOptimization(trace);
        setSingleResults(results);
      } else {
        const results = runMultiLevelOptimization(trace);
        setMultiResults(results);
      }
      setIsOptimizing(false);
    }, 100);
  };

  const applySingleConfig = (result: OptimizationResult) => {
    setL1Config(result.config);
    toggleCacheLevel('l2', false);
  };

  const applyMultiConfig = (result: MultiLevelOptimizationResult) => {
    setL1Config(result.l1Config);
    setL2Config(result.l2Config);
    toggleCacheLevel('l1', true);
    toggleCacheLevel('l2', true);
  };

  // Group single results by cache size for bar chart
  const singleChartData = (() => {
    const grouped = new Map<string, { name: string; [key: string]: number | string }>();
    singleResults.forEach((r) => {
      const sizeKey = `${r.config.cacheSize / 1024}KB`;
      if (!grouped.has(sizeKey)) {
        grouped.set(sizeKey, { name: sizeKey });
      }
      const entry = grouped.get(sizeKey)!;
      const assocKey = `${r.config.associativity}-way`;
      // Store hit rate (higher is better, easier to compare)
      entry[assocKey] = Math.round(r.stats.hitRate * 100 * 100) / 100;
    });
    return Array.from(grouped.values()).sort((a, b) => 
      parseInt(a.name) - parseInt(b.name)
    );
  })();

  // Get unique associativities for bar colors
  const singleAssocs = [...new Set(singleResults.map(r => r.config.associativity))].sort((a, b) => a - b);

  // Group multi results by total size for bar chart  
  const multiChartData = (() => {
    const grouped = new Map<string, { name: string; [key: string]: number | string }>();
    multiResults.forEach((r) => {
      const sizeKey = `${r.totalSize / 1024}KB`;
      if (!grouped.has(sizeKey)) {
        grouped.set(sizeKey, { name: sizeKey });
      }
      const entry = grouped.get(sizeKey)!;
      const configKey = `L1:${r.l1Config.associativity}w`;
      entry[configKey] = Math.round(r.combinedStats.hitRate * 100 * 100) / 100;
    });
    return Array.from(grouped.values()).sort((a, b) => 
      parseInt(a.name) - parseInt(b.name)
    );
  })();

  // Get unique L1 associativities for multi-level bars
  const multiAssocs = [...new Set(multiResults.map(r => r.l1Config.associativity))].sort((a, b) => a - b);

  const results = mode === 'single' ? singleResults : multiResults;
  const chartData = mode === 'single' ? singleChartData : multiChartData;
  const bestSingleResult = singleResults[0];
  const bestMultiResult = multiResults[0];

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as OptimizationMode)} className="flex-1">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 h-8">
            <TabsTrigger value="single" className="flex items-center gap-1.5 text-xs h-7">
              <Cpu size={12} />
              Single (L1)
            </TabsTrigger>
            <TabsTrigger value="multi" className="flex items-center gap-1.5 text-xs h-7">
              <Layers size={12} />
              Multi (L1+L2)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={handleOptimize}
          disabled={trace.length === 0 || isOptimizing}
          size="sm"
          className="bg-gradient-to-r from-secondary to-primary hover:opacity-90 ml-3 h-8 text-xs"
        >
          {isOptimizing ? 'Optimizing...' : 'Find Optimal'}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Best Configuration - Single Level */}
            {mode === 'single' && bestSingleResult && (
              <div className="p-4 rounded-lg bg-gradient-to-r from-success/10 to-primary/10 border border-success/30">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="text-success" size={20} />
                  <span className="font-bold text-success">Optimal L1 Configuration</span>
                  <Badge variant="outline" className="ml-2">
                    {bestSingleResult.config.replacementPolicy}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Cache Size</p>
                    <p className="font-mono font-bold">
                      {bestSingleResult.config.cacheSize / 1024} KB
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Block Size</p>
                    <p className="font-mono font-bold">{bestSingleResult.config.blockSize}B</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Associativity</p>
                    <p className="font-mono font-bold">{bestSingleResult.config.associativity}-way</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Policy</p>
                    <p className="font-mono font-bold">{bestSingleResult.config.replacementPolicy}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Hit Rate</p>
                    <p className="font-mono font-bold text-success">
                      {(bestSingleResult.stats.hitRate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      onClick={() => applySingleConfig(bestSingleResult)}
                      className="w-full"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Best Configuration - Multi Level */}
            {mode === 'multi' && bestMultiResult && (
              <div className="p-4 rounded-lg bg-gradient-to-r from-success/10 to-primary/10 border border-success/30">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="text-success" size={20} />
                  <span className="font-bold text-success">Optimal Multi-Level Configuration</span>
                  <Badge variant="outline" className="ml-2">
                    {bestMultiResult.l1Config.replacementPolicy}
                  </Badge>
                </div>
                
                {/* L1 Config */}
                <div className="mb-3">
                  <p className="text-xs text-primary font-semibold mb-2">L1 Cache</p>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Size</p>
                      <p className="font-mono font-bold">
                        {bestMultiResult.l1Config.cacheSize / 1024} KB
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Block</p>
                      <p className="font-mono font-bold">{bestMultiResult.l1Config.blockSize}B</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Assoc.</p>
                      <p className="font-mono font-bold">{bestMultiResult.l1Config.associativity}-way</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Hit Rate</p>
                      <p className="font-mono font-bold text-success">
                        {(bestMultiResult.l1Stats.hitRate * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* L2 Config */}
                <div className="mb-3">
                  <p className="text-xs text-secondary font-semibold mb-2">L2 Cache</p>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Size</p>
                      <p className="font-mono font-bold">
                        {bestMultiResult.l2Config.cacheSize / 1024} KB
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Block</p>
                      <p className="font-mono font-bold">{bestMultiResult.l2Config.blockSize}B</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Assoc.</p>
                      <p className="font-mono font-bold">{bestMultiResult.l2Config.associativity}-way</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Hit Rate</p>
                      <p className="font-mono font-bold text-success">
                        {(bestMultiResult.l2Stats.hitRate * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Combined Stats */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Total Size: </span>
                      <span className="font-mono font-bold">{bestMultiResult.totalSize / 1024} KB</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Combined Hit Rate: </span>
                      <span className="font-mono font-bold text-success">
                        {(bestMultiResult.combinedStats.hitRate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">AMAT: </span>
                      <span className="font-mono font-bold">{bestMultiResult.amat.toFixed(2)}</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => applyMultiConfig(bestMultiResult)}>
                    Apply
                  </Button>
                </div>
              </div>
            )}

            {/* Bar Chart - Hit Rate by Cache Size */}
            <div className="h-64">
              <p className="text-sm text-muted-foreground mb-2">
                Hit Rate by Cache Size (grouped by associativity)
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={mode === 'single' ? singleChartData : multiChartData}
                  margin={{ top: 10, right: 30, bottom: 20, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(217, 33%, 25%)' }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(217, 33%, 25%)' }}
                    label={{
                      value: 'Hit Rate (%)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: 'hsl(215, 20%, 65%)',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(224, 71%, 4%)',
                      border: '1px solid hsl(217, 33%, 25%)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                    labelFormatter={(label) => `Cache Size: ${label}`}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                  {mode === 'single' ? (
                    singleAssocs.map((assoc, idx) => (
                      <Bar
                        key={assoc}
                        dataKey={`${assoc}-way`}
                        name={`${assoc}-way`}
                        fill={[
                          'hsl(142, 76%, 50%)', // green
                          'hsl(187, 94%, 50%)', // cyan
                          'hsl(271, 91%, 65%)', // purple
                          'hsl(45, 93%, 50%)',  // yellow
                        ][idx % 4]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))
                  ) : (
                    multiAssocs.map((assoc, idx) => (
                      <Bar
                        key={assoc}
                        dataKey={`L1:${assoc}w`}
                        name={`L1:${assoc}-way`}
                        fill={[
                          'hsl(142, 76%, 50%)',
                          'hsl(187, 94%, 50%)',
                          'hsl(271, 91%, 65%)',
                          'hsl(45, 93%, 50%)',
                        ][idx % 4]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Results Table */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Top Configurations</p>
              <div className="overflow-x-auto">
                {mode === 'single' ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Size</th>
                        <th className="pb-2 font-medium">Block</th>
                        <th className="pb-2 font-medium">Assoc.</th>
                        <th className="pb-2 font-medium">Policy</th>
                        <th className="pb-2 font-medium">Hit Rate</th>
                        <th className="pb-2 font-medium">AMAT</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleResults.slice(0, 5).map((result, idx) => (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-border/50"
                        >
                          <td className="py-2 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 font-mono">{result.config.cacheSize / 1024}KB</td>
                          <td className="py-2 font-mono">{result.config.blockSize}B</td>
                          <td className="py-2 font-mono">{result.config.associativity}-way</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">
                              {result.config.replacementPolicy}
                            </Badge>
                          </td>
                          <td className="py-2 font-mono text-success">
                            {(result.stats.hitRate * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 font-mono">{result.amat.toFixed(2)}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => applySingleConfig(result)}
                              className="h-6 text-xs"
                            >
                              Apply
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">L1</th>
                        <th className="pb-2 font-medium">L2</th>
                        <th className="pb-2 font-medium">Policy</th>
                        <th className="pb-2 font-medium">Combined Hit</th>
                        <th className="pb-2 font-medium">AMAT</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiResults.slice(0, 5).map((result, idx) => (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-border/50"
                        >
                          <td className="py-2 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 font-mono text-xs">
                            {result.l1Config.cacheSize / 1024}KB / {result.l1Config.blockSize}B / {result.l1Config.associativity}-way
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {result.l2Config.cacheSize / 1024}KB / {result.l2Config.blockSize}B / {result.l2Config.associativity}-way
                          </td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">
                              {result.l1Config.replacementPolicy}
                            </Badge>
                          </td>
                          <td className="py-2 font-mono text-success">
                            {(result.combinedStats.hitRate * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 font-mono">{result.amat.toFixed(2)}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => applyMultiConfig(result)}
                              className="h-6 text-xs"
                            >
                              Apply
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {results.length === 0 && !isOptimizing && (
        <div className="text-center py-4 text-muted-foreground">
          <TrendingUp className="mx-auto mb-2 opacity-50" size={24} />
          <p className="text-xs">
            {trace.length === 0
              ? 'Load a trace file first'
              : 'Click "Find Optimal" to analyze'}
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-secondary/20 to-primary/20">
            <Wand2 className="text-primary" size={20} />
          </div>
          <h2 className="text-lg font-bold">Sweet Spot Optimizer</h2>
        </div>
      </div>
      {content}
    </div>
  );
}