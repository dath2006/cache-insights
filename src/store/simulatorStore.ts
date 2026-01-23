import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  MemoryConfig,
  MemoryStats,
  MemoryRegion,
  MemoryAccessResult,
  HierarchyAccessResult,
  defaultMemoryConfigs,
} from "@/lib/cacheSimulator";
import {
  saveSimulationToHistory,
  SimulationHistoryEntry,
} from "@/lib/historyDB";

export type PlaybackState = "idle" | "playing" | "paused";

interface LastAccess extends AccessResult {
  address: number;
  isWrite: boolean;
}

interface MultiLevelLastAccess {
  l1?: LastAccess;
  l2?: LastAccess;
  memoryResult?: MemoryAccessResult;
  memoryAccessed?: boolean;
  address: number;
  isWrite: boolean;
  totalLatency?: number;
  dataPath?: ("L1" | "L2" | "Memory")[];
}

const defaultMemoryConfig: MemoryConfig = {
  sizeMB: 256,
  latencyCycles: 80,
  busWidthBits: 64,
  frequencyMHz: 3200,
  memoryType: "DDR4",
  burstLength: 8,
};

const defaultMemoryStats: MemoryStats = {
  totalReads: 0,
  totalWrites: 0,
  totalAccesses: 0,
  bytesTransferred: 0,
  averageLatency: 0,
  bandwidthUtilization: 0,
  peakBandwidthMBps: 0,
  effectiveBandwidthMBps: 0,
};

interface SimulatorState {
  // Configuration
  multiLevelConfig: MultiLevelCacheConfig;
  setMultiLevelConfig: (config: Partial<MultiLevelCacheConfig>) => void;
  setL1Config: (config: Partial<CacheConfig>) => void;
  setL2Config: (config: Partial<CacheConfig>) => void;
  toggleCacheLevel: (level: "l1" | "l2", enabled: boolean) => void;

  // Memory Configuration
  memoryConfig: MemoryConfig;
  setMemoryConfig: (config: Partial<MemoryConfig>) => void;
  memoryStats: MemoryStats;
  memoryRegions: MemoryRegion[];

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
  savedConfigs: {
    name: string;
    config: MultiLevelCacheConfig;
    memoryConfig?: MemoryConfig;
  }[];
  saveConfig: (name: string) => void;
  loadConfig: (name: string) => void;
  deleteConfig: (name: string) => void;

  // History
  saveToHistory: () => Promise<void>;
}

const defaultL1Config: CacheConfig = {
  cacheSize: 4096, // 4KB
  blockSize: 32,
  associativity: 4,
  replacementPolicy: "LRU",
  writePolicy: "write-back",
};

const defaultL2Config: CacheConfig = {
  cacheSize: 32768, // 32KB
  blockSize: 64,
  associativity: 8,
  replacementPolicy: "LRU",
  writePolicy: "write-back",
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
      memoryConfig: defaultMemoryConfig,
      memoryStats: defaultMemoryStats,
      memoryRegions: [],
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
      playbackState: "idle",
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

      setMemoryConfig: (newConfig) => {
        set((state) => ({
          memoryConfig: { ...state.memoryConfig, ...newConfig },
        }));
        get().initSimulator();
      },

      setConfig: (newConfig) => {
        get().setL1Config(newConfig);
      },

      initSimulator: () => {
        const config = get().multiLevelConfig;
        const memConfig = get().memoryConfig;
        const simulator = new MultiLevelCacheSimulator(config, memConfig);

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
          memoryStats: simulator.getMemoryStats(),
          memoryRegions: simulator.getMemoryRegions(),
          traceIndex: 0,
          lastAccess: null,
          playbackState: "idle",
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
            memoryStats: simulator.getMemoryStats(),
            memoryRegions: simulator.getMemoryRegions(),
            traceIndex: 0,
            lastAccess: null,
            playbackState: "idle",
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
          set({ playbackState: "idle" });
          return;
        }

        const entry = trace[traceIndex];
        const result = multiLevelSimulator.access(entry.address, entry.isWrite);

        const l1 = multiLevelSimulator.getL1();
        const l2 = multiLevelSimulator.getL2();

        const lastAccess: MultiLevelLastAccess = {
          address: entry.address,
          isWrite: entry.isWrite,
          totalLatency: result.totalLatency,
          dataPath: result.dataPath,
          memoryResult: result.memoryResult,
          memoryAccessed: result.memoryResult !== undefined,
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

        const newIndex = traceIndex + 1;
        const isComplete = newIndex >= trace.length;

        set({
          l1CacheSets: l1?.getSets() ?? [],
          l2CacheSets: l2?.getSets() ?? [],
          cacheSets: l1?.getSets() ?? [],
          l1Stats: l1?.getStats() ?? defaultStats,
          l2Stats: l2?.getStats() ?? defaultStats,
          combinedStats: multiLevelSimulator.getCombinedStats(),
          stats: l1?.getStats() ?? defaultStats,
          memoryStats: multiLevelSimulator.getMemoryStats(),
          memoryRegions: multiLevelSimulator.getMemoryRegions(),
          traceIndex: newIndex,
          lastAccess,
        });

        // Note: History saving is handled by PlaybackControls component
        // to avoid duplicate saves during automatic playback
      },

      setOptimizationResults: (optimizationResults) =>
        set({ optimizationResults }),
      setIsOptimizing: (isOptimizing) => set({ isOptimizing }),

      saveConfig: (name) => {
        const config = get().multiLevelConfig;
        const memConfig = get().memoryConfig;
        set((state) => ({
          savedConfigs: [
            ...state.savedConfigs.filter((c) => c.name !== name),
            { name, config, memoryConfig: memConfig },
          ],
        }));
      },

      loadConfig: (name) => {
        const saved = get().savedConfigs.find((c) => c.name === name);
        if (saved) {
          set({
            multiLevelConfig: saved.config,
            config: saved.config.l1,
            memoryConfig: saved.memoryConfig ?? defaultMemoryConfig,
          });
          get().initSimulator();
        }
      },

      deleteConfig: (name) => {
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.name !== name),
        }));
      },

      saveToHistory: async () => {
        const state = get();
        const {
          multiLevelConfig,
          trace,
          l1Stats,
          l2Stats,
          combinedStats,
          memoryStats,
        } = state;

        console.log("[History] Attempting to save to history...", {
          traceLength: trace.length,
          totalAccesses: combinedStats.totalAccesses,
        });

        if (trace.length === 0 || combinedStats.totalAccesses === 0) {
          console.log("[History] Skipping save - no simulation has run");
          return; // Don't save if no simulation has run
        }

        const historyEntry: Omit<SimulationHistoryEntry, "id"> = {
          timestamp: Date.now(),
          config: {
            l1: multiLevelConfig.l1,
            l2: multiLevelConfig.l2,
            enabled: multiLevelConfig.enabled,
          },
          trace: {
            length: trace.length,
          },
          stats: {
            l1: multiLevelConfig.enabled.l1 ? l1Stats : undefined,
            l2: multiLevelConfig.enabled.l2 ? l2Stats : undefined,
            combined: combinedStats,
          },
          memoryStats:
            memoryStats.totalAccesses > 0
              ? {
                  totalReads: memoryStats.totalReads,
                  totalWrites: memoryStats.totalWrites,
                  totalAccesses: memoryStats.totalAccesses,
                  bytesTransferred: memoryStats.bytesTransferred,
                  averageLatency: memoryStats.averageLatency,
                }
              : undefined,
        };

        try {
          const id = await saveSimulationToHistory(historyEntry);
          console.log(
            "[History] Successfully saved simulation to history with ID:",
            id,
          );
        } catch (error) {
          console.error(
            "[History] Failed to save simulation to history:",
            error,
          );
        }
      },
    }),
    {
      name: "cachelab-pro-storage",
      partialize: (state) => ({
        multiLevelConfig: state.multiLevelConfig,
        config: state.config,
        memoryConfig: state.memoryConfig,
        savedConfigs: state.savedConfigs,
      }),
    },
  ),
);
