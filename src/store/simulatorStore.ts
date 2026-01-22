import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CacheSimulator,
  MultiLevelCacheSimulator,
  CacheConfig,
  MultiLevelCacheConfig,
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

interface MultiLevelLastAccess {
  l1?: LastAccess;
  l2?: LastAccess;
  address: number;
  isWrite: boolean;
}

interface SimulatorState {
  // Configuration
  multiLevelConfig: MultiLevelCacheConfig;
  setMultiLevelConfig: (config: Partial<MultiLevelCacheConfig>) => void;
  setL1Config: (config: Partial<CacheConfig>) => void;
  setL2Config: (config: Partial<CacheConfig>) => void;
  toggleCacheLevel: (level: 'l1' | 'l2', enabled: boolean) => void;
  
  // Legacy single config for compatibility
  config: CacheConfig;
  setConfig: (config: Partial<CacheConfig>) => void;
  
  // Multi-level simulator
  multiLevelSimulator: MultiLevelCacheSimulator | null;
  initSimulator: () => void;
  resetSimulator: () => void;
  
  // Cache state for visualization
  l1CacheSets: CacheSet[];
  l2CacheSets: CacheSet[];
  l1Stats: CacheStats;
  l2Stats: CacheStats;
  combinedStats: CacheStats;
  lastAccess: MultiLevelLastAccess | null;
  
  // Legacy compatibility
  cacheSets: CacheSet[];
  stats: CacheStats;
  simulator: CacheSimulator | null;
  
  // Trace data
  trace: TraceEntry[];
  traceIndex: number;
  setTrace: (trace: TraceEntry[]) => void;
  
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
  savedConfigs: { name: string; config: MultiLevelCacheConfig }[];
  saveConfig: (name: string) => void;
  loadConfig: (name: string) => void;
  deleteConfig: (name: string) => void;
}

const defaultL1Config: CacheConfig = {
  cacheSize: 4096, // 4KB
  blockSize: 32,
  associativity: 4,
  replacementPolicy: 'LRU',
  writePolicy: 'write-back',
};

const defaultL2Config: CacheConfig = {
  cacheSize: 32768, // 32KB
  blockSize: 64,
  associativity: 8,
  replacementPolicy: 'LRU',
  writePolicy: 'write-back',
};

const defaultMultiLevelConfig: MultiLevelCacheConfig = {
  l1: defaultL1Config,
  l2: defaultL2Config,
  enabled: { l1: true, l2: false },
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
      multiLevelConfig: defaultMultiLevelConfig,
      config: defaultL1Config,
      multiLevelSimulator: null,
      simulator: null,
      trace: [],
      traceIndex: 0,
      l1CacheSets: [],
      l2CacheSets: [],
      l1Stats: defaultStats,
      l2Stats: defaultStats,
      combinedStats: defaultStats,
      cacheSets: [],
      stats: defaultStats,
      lastAccess: null,
      playbackState: 'idle',
      playbackSpeed: 1,
      optimizationResults: [],
      isOptimizing: false,
      savedConfigs: [],

      setMultiLevelConfig: (newConfig) => {
        set((state) => ({
          multiLevelConfig: { ...state.multiLevelConfig, ...newConfig },
        }));
        get().initSimulator();
      },

      setL1Config: (newConfig) => {
        set((state) => ({
          multiLevelConfig: {
            ...state.multiLevelConfig,
            l1: { ...state.multiLevelConfig.l1, ...newConfig },
          },
          config: { ...state.config, ...newConfig },
        }));
        get().initSimulator();
      },

      setL2Config: (newConfig) => {
        set((state) => ({
          multiLevelConfig: {
            ...state.multiLevelConfig,
            l2: { ...state.multiLevelConfig.l2, ...newConfig },
          },
        }));
        get().initSimulator();
      },

      toggleCacheLevel: (level, enabled) => {
        set((state) => ({
          multiLevelConfig: {
            ...state.multiLevelConfig,
            enabled: { ...state.multiLevelConfig.enabled, [level]: enabled },
          },
        }));
        get().initSimulator();
      },

      setConfig: (newConfig) => {
        get().setL1Config(newConfig);
      },

      initSimulator: () => {
        const config = get().multiLevelConfig;
        const simulator = new MultiLevelCacheSimulator(config);
        
        const l1 = simulator.getL1();
        const l2 = simulator.getL2();
        
        set({
          multiLevelSimulator: simulator,
          simulator: l1,
          l1CacheSets: l1?.getSets() ?? [],
          l2CacheSets: l2?.getSets() ?? [],
          cacheSets: l1?.getSets() ?? [],
          l1Stats: l1?.getStats() ?? defaultStats,
          l2Stats: l2?.getStats() ?? defaultStats,
          combinedStats: simulator.getCombinedStats(),
          stats: l1?.getStats() ?? defaultStats,
          traceIndex: 0,
          lastAccess: null,
          playbackState: 'idle',
        });
      },

      resetSimulator: () => {
        const simulator = get().multiLevelSimulator;
        if (simulator) {
          simulator.reset();
          const l1 = simulator.getL1();
          const l2 = simulator.getL2();
          
          set({
            l1CacheSets: l1?.getSets() ?? [],
            l2CacheSets: l2?.getSets() ?? [],
            cacheSets: l1?.getSets() ?? [],
            l1Stats: l1?.getStats() ?? defaultStats,
            l2Stats: l2?.getStats() ?? defaultStats,
            combinedStats: simulator.getCombinedStats(),
            stats: l1?.getStats() ?? defaultStats,
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
        const { multiLevelSimulator, trace, traceIndex } = get();
        if (!multiLevelSimulator || traceIndex >= trace.length) {
          set({ playbackState: 'idle' });
          return;
        }

        const entry = trace[traceIndex];
        const result = multiLevelSimulator.access(entry.address, entry.isWrite);
        
        const l1 = multiLevelSimulator.getL1();
        const l2 = multiLevelSimulator.getL2();

        const lastAccess: MultiLevelLastAccess = {
          address: entry.address,
          isWrite: entry.isWrite,
        };
        
        if (result.l1Result) {
          lastAccess.l1 = {
            ...result.l1Result,
            address: entry.address,
            isWrite: entry.isWrite,
          };
        }
        
        if (result.l2Result) {
          lastAccess.l2 = {
            ...result.l2Result,
            address: entry.address,
            isWrite: entry.isWrite,
          };
        }

        set({
          l1CacheSets: l1?.getSets() ?? [],
          l2CacheSets: l2?.getSets() ?? [],
          cacheSets: l1?.getSets() ?? [],
          l1Stats: l1?.getStats() ?? defaultStats,
          l2Stats: l2?.getStats() ?? defaultStats,
          combinedStats: multiLevelSimulator.getCombinedStats(),
          stats: l1?.getStats() ?? defaultStats,
          traceIndex: traceIndex + 1,
          lastAccess,
        });
      },

      setOptimizationResults: (optimizationResults) => set({ optimizationResults }),
      setIsOptimizing: (isOptimizing) => set({ isOptimizing }),

      saveConfig: (name) => {
        const config = get().multiLevelConfig;
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
          set({ 
            multiLevelConfig: saved.config,
            config: saved.config.l1,
          });
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
        multiLevelConfig: state.multiLevelConfig,
        config: state.config,
        savedConfigs: state.savedConfigs,
      }),
    }
  )
);
