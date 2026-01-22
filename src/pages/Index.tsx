import { useEffect } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { StatsBar } from '@/components/simulator/StatsBar';
import { ConfigPanel } from '@/components/simulator/ConfigPanel';
import { CacheGrid } from '@/components/simulator/CacheGrid';
import { TraceInput } from '@/components/simulator/TraceInput';
import { PlaybackControls } from '@/components/simulator/PlaybackControls';
import { Optimizer } from '@/components/simulator/Optimizer';
import { Cpu } from 'lucide-react';

const Index = () => {
  const initSimulator = useSimulatorStore((s) => s.initSimulator);
  const simulator = useSimulatorStore((s) => s.simulator);

  useEffect(() => {
    if (!simulator) {
      initSimulator();
    }
  }, [simulator, initSimulator]);

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

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Sidebar - Config & Trace Input */}
        <div className="lg:col-span-3 space-y-4">
          <ConfigPanel />
          <TraceInput />
        </div>

        {/* Main Content - Cache Grid & Controls */}
        <div className="lg:col-span-9 space-y-4">
          <div className="h-[500px]">
            <CacheGrid />
          </div>
          <PlaybackControls />
          <Optimizer />
        </div>
      </div>
    </div>
  );
};

export default Index;
