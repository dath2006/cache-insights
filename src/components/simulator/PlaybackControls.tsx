import { useSimulatorStore } from "@/store/simulatorStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  FastForward,
  Save,
  ChevronsRight,
} from "lucide-react";
import { useEffect, useRef } from "react";

export function PlaybackControls() {
  const trace = useSimulatorStore((s) => s.trace);
  const traceIndex = useSimulatorStore((s) => s.traceIndex);
  const playbackState = useSimulatorStore((s) => s.playbackState);
  const playbackSpeed = useSimulatorStore((s) => s.playbackSpeed);
  const setPlaybackState = useSimulatorStore((s) => s.setPlaybackState);
  const setPlaybackSpeed = useSimulatorStore((s) => s.setPlaybackSpeed);
  const stepForward = useSimulatorStore((s) => s.stepForward);
  const skipToEnd = useSimulatorStore((s) => s.skipToEnd);
  const resetSimulator = useSimulatorStore((s) => s.resetSimulator);
  const saveToHistory = useSimulatorStore((s) => s.saveToHistory);

  const intervalRef = useRef<number | null>(null);

  const progress = trace.length > 0 ? (traceIndex / trace.length) * 100 : 0;
  const isComplete = traceIndex >= trace.length;
  const hasTrace = trace.length > 0;

  useEffect(() => {
    if (playbackState === "playing" && !isComplete) {
      // Speed scaling with exponential growth for high speeds:
      // 1x = 500ms interval (2 steps/sec) - slow for observation
      // 10x = 50ms interval (20 steps/sec)
      // 100x = 16ms interval with ~7 steps (400 steps/sec)
      // 500x = 16ms interval with ~30 steps (2000 steps/sec)

      let interval: number;
      let stepsPerTick: number;

      if (playbackSpeed <= 30) {
        // Low speeds: adjust interval, 1 step per tick
        interval = Math.max(16, 500 / playbackSpeed);
        stepsPerTick = 1;
      } else if (playbackSpeed <= 100) {
        // Medium-high speeds: fixed interval, linear scaling
        interval = 16; // ~60fps
        stepsPerTick = Math.ceil(playbackSpeed / 15);
      } else {
        // Very high speeds: exponential scaling for noticeable difference
        interval = 16;
        stepsPerTick = Math.ceil(Math.pow(playbackSpeed / 50, 1.5));
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
      if (isComplete && playbackState === "playing") {
        setPlaybackState("idle");
        // Save to history when simulation completes
        console.log("[History] Simulation complete, saving to history...");
        saveToHistory().catch((err) =>
          console.error("[History] Failed to save history:", err),
        );
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    playbackState,
    playbackSpeed,
    isComplete,
    stepForward,
    setPlaybackState,
    saveToHistory,
  ]);

  const handlePlayPause = () => {
    if (playbackState === "playing") {
      setPlaybackState("paused");
    } else {
      setPlaybackState("playing");
    }
  };

  const handleReset = () => {
    resetSimulator();
  };

  const handleStepForward = () => {
    const wasAtEnd = traceIndex === trace.length - 1;
    stepForward();

    // If this step completes the simulation, save to history
    if (wasAtEnd) {
      console.log(
        "[History] Simulation completed via stepping, saving to history...",
      );
      setTimeout(() => {
        saveToHistory().catch((err) =>
          console.error("[History] Failed to save history:", err),
        );
      }, 100); // Small delay to ensure state is updated
    }
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
            {playbackState === "playing" ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={handleStepForward}
            disabled={!hasTrace || isComplete}
            className="border-border"
          >
            <SkipForward size={16} />
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              skipToEnd();
            }}
            disabled={!hasTrace || isComplete}
            className="border-border"
            title="Quick Finish (Skip to End)"
          >
            <ChevronsRight size={16} />
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              console.log("[History] Manual save triggered");
              saveToHistory();
            }}
            disabled={!hasTrace || traceIndex === 0}
            className="border-border"
            title="Save to History"
          >
            <Save size={16} />
          </Button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-3 min-w-[300px]">
          <FastForward size={14} className="text-muted-foreground" />
          <Slider
            value={[playbackSpeed]}
            min={1}
            max={500}
            step={1}
            onValueChange={([v]) => setPlaybackSpeed(v)}
            className="flex-1"
          />
          <span className="text-xs font-mono text-primary min-w-[36px] text-right">
            {playbackSpeed}x
          </span>
          <div className="flex items-center gap-1">
            {[1, 10, 100, 500].map((speed) => (
              <Button
                key={speed}
                size="sm"
                variant={playbackSpeed === speed ? "default" : "outline"}
                className={`h-6 px-2 text-[10px] font-mono ${
                  playbackSpeed === speed
                    ? "bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
