import { useSimulatorStore } from '@/store/simulatorStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipForward, RotateCcw, FastForward } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function PlaybackControls() {
  const trace = useSimulatorStore((s) => s.trace);
  const traceIndex = useSimulatorStore((s) => s.traceIndex);
  const playbackState = useSimulatorStore((s) => s.playbackState);
  const playbackSpeed = useSimulatorStore((s) => s.playbackSpeed);
  const setPlaybackState = useSimulatorStore((s) => s.setPlaybackState);
  const setPlaybackSpeed = useSimulatorStore((s) => s.setPlaybackSpeed);
  const stepForward = useSimulatorStore((s) => s.stepForward);
  const resetSimulator = useSimulatorStore((s) => s.resetSimulator);

  const intervalRef = useRef<number | null>(null);

  const progress = trace.length > 0 ? (traceIndex / trace.length) * 100 : 0;
  const isComplete = traceIndex >= trace.length;
  const hasTrace = trace.length > 0;

  useEffect(() => {
    if (playbackState === 'playing' && !isComplete) {
      // Speed scaling:
      // 1x = 500ms interval (2 steps/sec) - slow for observation
      // 10x = 50ms interval (20 steps/sec)
      // 100x = 16ms interval with 2 steps (120 steps/sec)
      // 1000x = 16ms interval with 16 steps (1000 steps/sec)
      
      let interval: number;
      let stepsPerTick: number;
      
      if (playbackSpeed <= 30) {
        // Low speeds: adjust interval, 1 step per tick
        interval = Math.max(16, 500 / playbackSpeed);
        stepsPerTick = 1;
      } else {
        // High speeds: fixed interval, multiple steps per tick
        interval = 16; // ~60fps
        stepsPerTick = Math.ceil(playbackSpeed / 60);
      }
      
      intervalRef.current = window.setInterval(() => {
        for (let i = 0; i < stepsPerTick; i++) {
          stepForward();
        }
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (isComplete && playbackState === 'playing') {
        setPlaybackState('idle');
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playbackState, playbackSpeed, isComplete, stepForward, setPlaybackState]);

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      setPlaybackState('paused');
    } else {
      setPlaybackState('playing');
    }
  };

  const handleReset = () => {
    resetSimulator();
  };

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-4">
        {/* Progress bar */}
        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>
              {traceIndex.toLocaleString()} / {trace.length.toLocaleString()}
            </span>
            <span>{progress.toFixed(1)}%</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleReset}
            disabled={!hasTrace}
            className="border-border"
          >
            <RotateCcw size={16} />
          </Button>

          <Button
            size="icon"
            onClick={handlePlayPause}
            disabled={!hasTrace || isComplete}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {playbackState === 'playing' ? <Pause size={16} /> : <Play size={16} />}
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={stepForward}
            disabled={!hasTrace || isComplete}
            className="border-border"
          >
            <SkipForward size={16} />
          </Button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-3 min-w-[160px]">
          <FastForward size={14} className="text-muted-foreground" />
          <Slider
            value={[playbackSpeed]}
            min={1}
            max={1000}
            step={1}
            onValueChange={([v]) => setPlaybackSpeed(v)}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground w-12">
            {playbackSpeed}x
          </span>
        </div>
      </div>
    </div>
  );
}
