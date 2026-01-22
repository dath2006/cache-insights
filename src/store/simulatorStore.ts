import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CacheSimulator,
  CacheConfig,
  CacheSet,
  CacheStats,
  TraceEntry,
  AccessResult,
  OptimizationResult,
} from '@/lib/cacheSimulator';

export type PlaybackState = 'idle' | 'playing' | 'paused';

interface LastAccess extends AccessResult {
  address: number;
  isWrite: boolean;
}

interface SimulatorState {
  // Configuration
  config: CacheConfig;
  setConfig: (config: Partial<CacheConfig>) => void;
  
  // Simulator instance
  simulator: CacheSimulator | null;
  initSimulator: () => void;
  resetSimulator: () => void;
  
  // Trace data
  trace: TraceEntry[];
  traceIndex: number;
  setTrace: (trace: TraceEntry[]) => void;
  
  // Cache state for visualization
  cacheSets: CacheSet[];
  stats: CacheStats;
  lastAccess: LastAccess | null;
  
  // Playback controls
  playbackState: PlaybackState;
  playbackSpeed: number;
  setPlaybackState: (state: PlaybackState) => void;
  setPlaybackSpeed: (speed: number) => void;
  stepForward: () => void;
  
  // Optimization
  optimizationResults: OptimizationResult[];
  isOptimizing: boolean;
  setOptimizationResults: (results: OptimizationResult[]) => void;
  setIsOptimizing: (isOptimizing: boolean) => void;
  
  // Saved configurations
  savedConfigs: { name: string; config: CacheConfig }[];
  saveConfig: (name: string) => void;
  loadConfig: (name: string) => void;
  deleteConfig: (name: string) => void;
}

const defaultConfig: CacheConfig = {
  cacheSize: 4096, // 4KB
  blockSize: 32,
  associativity: 4,
  replacementPolicy: 'LRU',
  writePolicy: 'write-back',
};

const defaultStats: CacheStats = {
  hits: 0,
  misses: 0,
  hitRate: 0,
  totalAccesses: 0,
  writebacks: 0,
};

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      simulator: null,
      trace: [],
      traceIndex: 0,
      cacheSets: [],
      stats: defaultStats,
      lastAccess: null,
      playbackState: 'idle',
      playbackSpeed: 1,
      optimizationResults: [],
      isOptimizing: false,
      savedConfigs: [],

      setConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }));
        get().initSimulator();
      },

      initSimulator: () => {
        const config = get().config;
        const simulator = new CacheSimulator(config);
        set({
          simulator,
          cacheSets: simulator.getSets(),
          stats: simulator.getStats(),
          traceIndex: 0,
          lastAccess: null,
          playbackState: 'idle',
        });
      },

      resetSimulator: () => {
        const simulator = get().simulator;
        if (simulator) {
          simulator.reset();
          set({
            cacheSets: simulator.getSets(),
            stats: simulator.getStats(),
            traceIndex: 0,
            lastAccess: null,
            playbackState: 'idle',
          });
        }
      },

      setTrace: (trace) => {
        set({ trace, traceIndex: 0 });
        get().resetSimulator();
      },

      setPlaybackState: (playbackState) => set({ playbackState }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

      stepForward: () => {
        const { simulator, trace, traceIndex } = get();
        if (!simulator || traceIndex >= trace.length) {
          set({ playbackState: 'idle' });
          return;
        }

        const entry = trace[traceIndex];
        const result = simulator.access(entry.address, entry.isWrite);

        set({
          cacheSets: simulator.getSets(),
          stats: simulator.getStats(),
          traceIndex: traceIndex + 1,
          lastAccess: {
            ...result,
            address: entry.address,
            isWrite: entry.isWrite,
          },
        });
      },

      setOptimizationResults: (optimizationResults) => set({ optimizationResults }),
      setIsOptimizing: (isOptimizing) => set({ isOptimizing }),

      saveConfig: (name) => {
        const config = get().config;
        set((state) => ({
          savedConfigs: [
            ...state.savedConfigs.filter((c) => c.name !== name),
            { name, config },
          ],
        }));
      },

      loadConfig: (name) => {
        const saved = get().savedConfigs.find((c) => c.name === name);
        if (saved) {
          set({ config: saved.config });
          get().initSimulator();
        }
      },

      deleteConfig: (name) => {
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.name !== name),
        }));
      },
    }),
    {
      name: 'cachelab-pro-storage',
      partialize: (state) => ({
        config: state.config,
        savedConfigs: state.savedConfigs,
      }),
    }
  )
);
