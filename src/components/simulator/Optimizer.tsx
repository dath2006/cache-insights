import { useSimulatorStore } from '@/store/simulatorStore';
import { runOptimization, OptimizationResult } from '@/lib/cacheSimulator';
import { Button } from '@/components/ui/button';
import { Wand2, Trophy, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
} from 'recharts';

export function Optimizer() {
  const trace = useSimulatorStore((s) => s.trace);
  const optimizationResults = useSimulatorStore((s) => s.optimizationResults);
  const isOptimizing = useSimulatorStore((s) => s.isOptimizing);
  const setOptimizationResults = useSimulatorStore((s) => s.setOptimizationResults);
  const setIsOptimizing = useSimulatorStore((s) => s.setIsOptimizing);
  const setConfig = useSimulatorStore((s) => s.setConfig);

  const handleOptimize = () => {
    if (trace.length === 0) return;

    setIsOptimizing(true);

    // Run optimization (simulates async for UI feedback)
    setTimeout(() => {
      const results = runOptimization(trace);
      setOptimizationResults(results);
      setIsOptimizing(false);
    }, 100);
  };

  const applyConfig = (result: OptimizationResult) => {
    setConfig(result.config);
  };

  const bestResult = optimizationResults[0];

  // Prepare data for scatter chart
  const chartData = optimizationResults.map((r) => ({
    x: r.config.cacheSize / 1024,
    y: r.config.associativity,
    z: (1 - r.stats.hitRate) * 100,
    missRate: ((1 - r.stats.hitRate) * 100).toFixed(2),
    size: r.config.cacheSize,
    assoc: r.config.associativity,
    blockSize: r.config.blockSize,
    score: r.score,
  }));

  const getColor = (missRate: number) => {
    if (missRate < 5) return 'hsl(142, 76%, 50%)'; // Green
    if (missRate < 15) return 'hsl(187, 94%, 50%)'; // Cyan
    if (missRate < 30) return 'hsl(271, 91%, 65%)'; // Purple
    return 'hsl(0, 84%, 60%)'; // Red
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-secondary/20 to-primary/20">
            <Wand2 className="text-primary" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Sweet Spot Optimizer</h2>
            <p className="text-xs text-muted-foreground">
              Find the optimal cache configuration for your workload
            </p>
          </div>
        </div>

        <Button
          onClick={handleOptimize}
          disabled={trace.length === 0 || isOptimizing}
          className="bg-gradient-to-r from-secondary to-primary hover:opacity-90"
        >
          {isOptimizing ? (
            <>
              <span className="animate-spin mr-2">⚙️</span>
              Optimizing...
            </>
          ) : (
            <>
              <Wand2 className="mr-2" size={16} />
              Find Optimal Config
            </>
          )}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {optimizationResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Best Configuration */}
            {bestResult && (
              <div className="p-4 rounded-lg bg-gradient-to-r from-success/10 to-primary/10 border border-success/30">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="text-success" size={20} />
                  <span className="font-bold text-success">Optimal Configuration</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Cache Size</p>
                    <p className="font-mono font-bold">
                      {bestResult.config.cacheSize / 1024} KB
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Block Size</p>
                    <p className="font-mono font-bold">{bestResult.config.blockSize}B</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Associativity</p>
                    <p className="font-mono font-bold">{bestResult.config.associativity}-way</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Hit Rate</p>
                    <p className="font-mono font-bold text-success">
                      {(bestResult.stats.hitRate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      onClick={() => applyConfig(bestResult)}
                      className="w-full"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Scatter Chart - Size vs Associativity vs Miss Rate */}
            <div className="h-64">
              <p className="text-sm text-muted-foreground mb-2">
                Miss Rate by Configuration (bubble size = miss rate)
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Size (KB)"
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(217, 33%, 25%)' }}
                    tickLine={{ stroke: 'hsl(217, 33%, 25%)' }}
                    label={{
                      value: 'Cache Size (KB)',
                      position: 'bottom',
                      fill: 'hsl(215, 20%, 65%)',
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Associativity"
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(217, 33%, 25%)' }}
                    tickLine={{ stroke: 'hsl(217, 33%, 25%)' }}
                    label={{
                      value: 'Associativity',
                      angle: -90,
                      position: 'left',
                      fill: 'hsl(215, 20%, 65%)',
                      fontSize: 11,
                    }}
                  />
                  <ZAxis type="number" dataKey="z" range={[50, 400]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 text-sm">
                            <p className="font-bold mb-1">Configuration</p>
                            <p>Size: {data.size / 1024}KB</p>
                            <p>Associativity: {data.assoc}-way</p>
                            <p>Block: {data.blockSize}B</p>
                            <p className="mt-1 font-semibold">
                              Miss Rate:{' '}
                              <span
                                style={{ color: getColor(parseFloat(data.missRate)) }}
                              >
                                {data.missRate}%
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter data={chartData}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={getColor(parseFloat(entry.missRate))}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Top 5 Results Table */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Top Configurations</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Size</th>
                      <th className="pb-2 font-medium">Block</th>
                      <th className="pb-2 font-medium">Assoc.</th>
                      <th className="pb-2 font-medium">Hit Rate</th>
                      <th className="pb-2 font-medium">AMAT</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationResults.slice(0, 5).map((result, idx) => (
                      <motion.tr
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border-b border-border/50"
                      >
                        <td className="py-2 font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2 font-mono">
                          {result.config.cacheSize / 1024}KB
                        </td>
                        <td className="py-2 font-mono">{result.config.blockSize}B</td>
                        <td className="py-2 font-mono">
                          {result.config.associativity}-way
                        </td>
                        <td className="py-2 font-mono text-success">
                          {(result.stats.hitRate * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 font-mono">{result.amat.toFixed(2)}</td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => applyConfig(result)}
                            className="h-6 text-xs"
                          >
                            Apply
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {optimizationResults.length === 0 && !isOptimizing && (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="mx-auto mb-2 opacity-50" size={32} />
          <p className="text-sm">
            {trace.length === 0
              ? 'Load a trace file first to run optimization'
              : 'Click "Find Optimal Config" to analyze your workload'}
          </p>
        </div>
      )}
    </div>
  );
}
