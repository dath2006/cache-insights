// Cache Simulation Engine for CacheLab-Pro

export type ReplacementPolicy = 'LRU' | 'FIFO' | 'LFU' | 'RANDOM';
export type WritePolicy = 'write-back' | 'write-through';
export type MemoryType = 'DDR3' | 'DDR4' | 'DDR5' | 'SRAM' | 'Custom';

// ============= MEMORY SUBSYSTEM =============

export interface MemoryConfig {
  sizeMB: number;           // Memory size in MB
  latencyCycles: number;    // Access latency in CPU cycles
  busWidthBits: number;     // Bus width in bits (64, 128, 256)
  frequencyMHz: number;     // Memory frequency in MHz
  memoryType: MemoryType;   // DDR3, DDR4, DDR5, SRAM, Custom
  burstLength: number;      // Burst length for DDR (4, 8, 16)
}

export interface MemoryRegion {
  startAddress: number;
  endAddress: number;
  accessCount: number;
  readCount: number;
  writeCount: number;
  lastAccessTime: number;
}

export interface MemoryStats {
  totalReads: number;
  totalWrites: number;
  totalAccesses: number;
  bytesTransferred: number;
  averageLatency: number;
  bandwidthUtilization: number;  // Percentage
  peakBandwidthMBps: number;
  effectiveBandwidthMBps: number;
}

export interface MemoryAccessResult {
  address: number;
  isWrite: boolean;
  latencyCycles: number;
  bytesTransferred: number;
  regionIndex: number;
}

export const defaultMemoryConfigs: Record<MemoryType, Partial<MemoryConfig>> = {
  'DDR3': { latencyCycles: 100, busWidthBits: 64, frequencyMHz: 1600, burstLength: 8 },
  'DDR4': { latencyCycles: 80, busWidthBits: 64, frequencyMHz: 3200, burstLength: 8 },
  'DDR5': { latencyCycles: 70, busWidthBits: 64, frequencyMHz: 4800, burstLength: 16 },
  'SRAM': { latencyCycles: 10, busWidthBits: 128, frequencyMHz: 2000, burstLength: 1 },
  'Custom': { latencyCycles: 100, busWidthBits: 64, frequencyMHz: 2400, burstLength: 8 },
};

export class MainMemory {
  private config: MemoryConfig;
  private stats: MemoryStats;
  private regions: MemoryRegion[];
  private accessHistory: MemoryAccessResult[];
  private regionCount: number;
  private totalCycles: number;
  private minAddressSeen: number;
  private maxAddressSeen: number;
  private dynamicRegionSize: number;

  constructor(config: MemoryConfig) {
    this.config = config;
    this.totalCycles = 0;
    this.regionCount = 16; // Divide memory into 16 regions for visualization
    
    // Start with dynamic region tracking - will adapt to actual address range used
    this.minAddressSeen = Infinity;
    this.maxAddressSeen = 0;
    this.dynamicRegionSize = 0;
    
    this.stats = {
      totalReads: 0,
      totalWrites: 0,
      totalAccesses: 0,
      bytesTransferred: 0,
      averageLatency: 0,
      bandwidthUtilization: 0,
      peakBandwidthMBps: this.calculatePeakBandwidth(),
      effectiveBandwidthMBps: 0,
    };
    
    this.regions = [];
    this.accessHistory = [];
    
    // Initialize regions with placeholder addresses (will be updated dynamically)
    for (let i = 0; i < this.regionCount; i++) {
      this.regions.push({
        startAddress: 0,
        endAddress: 0,
        accessCount: 0,
        readCount: 0,
        writeCount: 0,
        lastAccessTime: 0,
      });
    }
  }

  private calculatePeakBandwidth(): number {
    // Peak bandwidth in MB/s = (busWidth * frequency * 2) / 8 for DDR
    const multiplier = this.config.memoryType.startsWith('DDR') ? 2 : 1;
    return (this.config.busWidthBits * this.config.frequencyMHz * multiplier) / 8 / 1000;
  }

  access(address: number, isWrite: boolean, blockSize: number = 64): MemoryAccessResult {
    this.totalCycles++;
    
    // Wrap address to memory size
    const memorySize = this.config.sizeMB * 1024 * 1024;
    const wrappedAddress = address % memorySize;
    
    // Track address range dynamically
    this.minAddressSeen = Math.min(this.minAddressSeen, wrappedAddress);
    this.maxAddressSeen = Math.max(this.maxAddressSeen, wrappedAddress);
    
    // Recalculate dynamic region size based on observed address range
    const addressRange = this.maxAddressSeen - this.minAddressSeen + 1;
    this.dynamicRegionSize = Math.max(1, Math.ceil(addressRange / this.regionCount));
    
    // Update region boundaries based on observed address range
    for (let i = 0; i < this.regionCount; i++) {
      this.regions[i].startAddress = this.minAddressSeen + i * this.dynamicRegionSize;
      this.regions[i].endAddress = this.minAddressSeen + (i + 1) * this.dynamicRegionSize - 1;
    }
    
    // Find region based on dynamic sizing
    const regionIndex = Math.min(
      Math.floor((wrappedAddress - this.minAddressSeen) / this.dynamicRegionSize),
      this.regionCount - 1
    );
    const region = this.regions[Math.max(0, regionIndex)];
    
    // Update region stats
    region.accessCount++;
    region.lastAccessTime = this.totalCycles;
    if (isWrite) {
      region.writeCount++;
      this.stats.totalWrites++;
    } else {
      region.readCount++;
      this.stats.totalReads++;
    }
    
    // Calculate transfer size (burst-aligned)
    const bytesPerBurst = (this.config.busWidthBits / 8) * this.config.burstLength;
    const transferSize = Math.max(blockSize, bytesPerBurst);
    
    this.stats.totalAccesses++;
    this.stats.bytesTransferred += transferSize;
    
    // Calculate effective latency (includes burst transfer time)
    const burstCycles = Math.ceil(transferSize / (this.config.busWidthBits / 8));
    const totalLatency = this.config.latencyCycles + burstCycles;
    
    // Update average latency
    this.stats.averageLatency = 
      ((this.stats.averageLatency * (this.stats.totalAccesses - 1)) + totalLatency) / 
      this.stats.totalAccesses;
    
    // Calculate bandwidth utilization
    this.stats.effectiveBandwidthMBps = 
      (this.stats.bytesTransferred / this.totalCycles) * this.config.frequencyMHz;
    this.stats.bandwidthUtilization = 
      (this.stats.effectiveBandwidthMBps / this.stats.peakBandwidthMBps) * 100;
    
    const result: MemoryAccessResult = {
      address: wrappedAddress,
      isWrite,
      latencyCycles: totalLatency,
      bytesTransferred: transferSize,
      regionIndex: Math.max(0, regionIndex),
    };
    
    this.accessHistory.push(result);
    if (this.accessHistory.length > 1000) {
      this.accessHistory.shift();
    }
    
    return result;
  }

  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  getStats(): MemoryStats {
    return { ...this.stats };
  }

  getRegions(): MemoryRegion[] {
    return this.regions.map(r => ({ ...r }));
  }

  getAccessHistory(): MemoryAccessResult[] {
    return [...this.accessHistory];
  }

  getLatency(): number {
    return this.config.latencyCycles;
  }

  reset(): void {
    this.totalCycles = 0;
    this.minAddressSeen = Infinity;
    this.maxAddressSeen = 0;
    this.dynamicRegionSize = 0;
    
    this.stats = {
      totalReads: 0,
      totalWrites: 0,
      totalAccesses: 0,
      bytesTransferred: 0,
      averageLatency: 0,
      bandwidthUtilization: 0,
      peakBandwidthMBps: this.calculatePeakBandwidth(),
      effectiveBandwidthMBps: 0,
    };
    
    for (const region of this.regions) {
      region.startAddress = 0;
      region.endAddress = 0;
      region.accessCount = 0;
      region.readCount = 0;
      region.writeCount = 0;
      region.lastAccessTime = 0;
    }
    
    this.accessHistory = [];
  }
}

// ============= CACHE SUBSYSTEM =============

export interface CacheBlock {
  valid: boolean;
  dirty: boolean;
  tag: number;
  lastAccessTime: number;
  insertionTime: number;
  accessCount: number; // For LFU
}

export interface CacheSet {
  blocks: CacheBlock[];
}

export interface AccessResult {
  hit: boolean;
  setIndex: number;
  wayIndex: number;
  tag: number;
  evicted: boolean;
  evictedTag?: number;
  level?: 'L1' | 'L2'; // Which cache level was accessed
  memoryAccessed?: boolean; // Did this access go to main memory?
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalAccesses: number;
  writebacks: number;
}

export interface CacheConfig {
  cacheSize: number; // in bytes
  blockSize: number; // in bytes
  associativity: number; // n-way
  replacementPolicy: ReplacementPolicy;
  writePolicy: WritePolicy;
}

export interface MultiLevelCacheConfig {
  l1: CacheConfig;
  l2: CacheConfig;
  enabled: { l1: boolean; l2: boolean };
}

export interface TraceEntry {
  isWrite: boolean;
  address: number;
}

export class CacheSimulator {
  private config: CacheConfig;
  private sets: CacheSet[];
  private stats: CacheStats;
  private accessTime: number;
  
  // Derived values
  private numSets: number;
  private numBlocks: number;
  private offsetBits: number;
  private indexBits: number;
  private tagBits: number;

  constructor(config: CacheConfig) {
    this.config = config;
    this.accessTime = 0;
    
    // Calculate cache parameters
    this.numBlocks = config.cacheSize / config.blockSize;
    this.numSets = this.numBlocks / config.associativity;
    this.offsetBits = Math.log2(config.blockSize);
    this.indexBits = Math.log2(this.numSets);
    this.tagBits = 32 - this.offsetBits - this.indexBits;
    
    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAccesses: 0,
      writebacks: 0,
    };
    
    // Initialize cache sets
    this.sets = [];
    for (let i = 0; i < this.numSets; i++) {
      const blocks: CacheBlock[] = [];
      for (let j = 0; j < config.associativity; j++) {
        blocks.push({
          valid: false,
          dirty: false,
          tag: 0,
          lastAccessTime: 0,
          insertionTime: 0,
          accessCount: 0,
        });
      }
      this.sets.push({ blocks });
    }
  }

  private extractTag(address: number): number {
    return address >>> (this.offsetBits + this.indexBits);
  }

  private extractIndex(address: number): number {
    const mask = (1 << this.indexBits) - 1;
    return (address >>> this.offsetBits) & mask;
  }

  access(address: number, isWrite: boolean): AccessResult {
    this.accessTime++;
    this.stats.totalAccesses++;
    
    const tag = this.extractTag(address);
    const setIndex = this.extractIndex(address);
    const set = this.sets[setIndex];
    
    // Search for hit
    for (let i = 0; i < set.blocks.length; i++) {
      const block = set.blocks[i];
      if (block.valid && block.tag === tag) {
        // Hit!
        this.stats.hits++;
        this.stats.hitRate = this.stats.hits / this.stats.totalAccesses;
        block.lastAccessTime = this.accessTime;
        block.accessCount++; // For LFU
        
        if (isWrite && this.config.writePolicy === 'write-back') {
          block.dirty = true;
        }
        
        return {
          hit: true,
          setIndex,
          wayIndex: i,
          tag,
          evicted: false,
        };
      }
    }
    
    // Miss - need to bring in block
    this.stats.misses++;
    this.stats.hitRate = this.stats.hits / this.stats.totalAccesses;
    
    // Find block to replace
    const { wayIndex, evictedTag, hadEviction } = this.findVictim(set, setIndex);
    const block = set.blocks[wayIndex];
    
    // Check for writeback
    if (hadEviction && block.dirty) {
      this.stats.writebacks++;
    }
    
    // Install new block
    block.valid = true;
    block.tag = tag;
    block.lastAccessTime = this.accessTime;
    block.insertionTime = this.accessTime;
    block.accessCount = 1; // Reset for LFU
    block.dirty = isWrite && this.config.writePolicy === 'write-back';
    
    return {
      hit: false,
      setIndex,
      wayIndex,
      tag,
      evicted: hadEviction,
      evictedTag,
    };
  }

  private findVictim(set: CacheSet, setIndex: number): { wayIndex: number; evictedTag?: number; hadEviction: boolean } {
    // First, look for invalid block
    for (let i = 0; i < set.blocks.length; i++) {
      if (!set.blocks[i].valid) {
        return { wayIndex: i, hadEviction: false };
      }
    }
    
    // All blocks valid, need to evict
    let victimIndex = 0;
    
    switch (this.config.replacementPolicy) {
      case 'LRU': {
        let minTime = Infinity;
        for (let i = 0; i < set.blocks.length; i++) {
          if (set.blocks[i].lastAccessTime < minTime) {
            minTime = set.blocks[i].lastAccessTime;
            victimIndex = i;
          }
        }
        break;
      }
      case 'LFU': {
        // LFU: Find block with lowest access count
        let minCount = Infinity;
        let minTime = Infinity;
        for (let i = 0; i < set.blocks.length; i++) {
          // Use access count, tie-break with LRU
          if (set.blocks[i].accessCount < minCount ||
              (set.blocks[i].accessCount === minCount && set.blocks[i].lastAccessTime < minTime)) {
            minCount = set.blocks[i].accessCount;
            minTime = set.blocks[i].lastAccessTime;
            victimIndex = i;
          }
        }
        break;
      }
      case 'RANDOM': {
        // Random: Select a random block to evict
        victimIndex = Math.floor(Math.random() * set.blocks.length);
        break;
      }
      case 'FIFO':
      default: {
        // FIFO
        let minInsertTime = Infinity;
        for (let i = 0; i < set.blocks.length; i++) {
          if (set.blocks[i].insertionTime < minInsertTime) {
            minInsertTime = set.blocks[i].insertionTime;
            victimIndex = i;
          }
        }
        break;
      }
    }
    
    return {
      wayIndex: victimIndex,
      evictedTag: set.blocks[victimIndex].tag,
      hadEviction: true,
    };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  getSets(): CacheSet[] {
    return this.sets.map(set => ({
      blocks: set.blocks.map(block => ({ ...block })),
    }));
  }

  getNumSets(): number {
    return this.numSets;
  }

  getAssociativity(): number {
    return this.config.associativity;
  }

  reset(): void {
    this.accessTime = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAccesses: 0,
      writebacks: 0,
    };
    
    for (const set of this.sets) {
      for (const block of set.blocks) {
        block.valid = false;
        block.dirty = false;
        block.tag = 0;
        block.lastAccessTime = 0;
        block.insertionTime = 0;
        block.accessCount = 0;
      }
    }
  }

  // Calculate Average Memory Access Time (AMAT)
  calculateAMAT(hitTime: number = 1, missPenalty: number = 100): number {
    const missRate = 1 - this.stats.hitRate;
    return hitTime + (missRate * missPenalty);
  }
}

// Multi-Level Cache Simulator with Main Memory (L1 + L2 + Memory)
export interface HierarchyAccessResult {
  l1Result?: AccessResult;
  l2Result?: AccessResult;
  memoryResult?: MemoryAccessResult;
  totalLatency: number;
  dataPath: ('L1' | 'L2' | 'Memory')[];
}

export class MultiLevelCacheSimulator {
  private l1: CacheSimulator | null = null;
  private l2: CacheSimulator | null = null;
  private memory: MainMemory;
  private config: MultiLevelCacheConfig;
  private memoryConfig: MemoryConfig;
  private combinedStats: CacheStats;
  private memoryAccesses: number;

  constructor(config: MultiLevelCacheConfig, memoryConfig?: MemoryConfig) {
    this.config = config;
    this.memoryConfig = memoryConfig ?? {
      sizeMB: 256,
      latencyCycles: 100,
      busWidthBits: 64,
      frequencyMHz: 3200,
      memoryType: 'DDR4',
      burstLength: 8,
    };
    
    this.memory = new MainMemory(this.memoryConfig);
    this.memoryAccesses = 0;
    
    if (config.enabled.l1) {
      this.l1 = new CacheSimulator(config.l1);
    }
    if (config.enabled.l2) {
      this.l2 = new CacheSimulator(config.l2);
    }
    
    this.combinedStats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAccesses: 0,
      writebacks: 0,
    };
  }

  access(address: number, isWrite: boolean): HierarchyAccessResult {
    this.combinedStats.totalAccesses++;
    
    let l1Result: AccessResult | undefined;
    let l2Result: AccessResult | undefined;
    let memoryResult: MemoryAccessResult | undefined;
    const dataPath: ('L1' | 'L2' | 'Memory')[] = [];
    let totalLatency = 0;
    
    // L1 hit time
    const l1HitTime = 1;
    const l2HitTime = 10;
    
    // Try L1 first
    if (this.l1) {
      l1Result = this.l1.access(address, isWrite);
      l1Result.level = 'L1';
      dataPath.push('L1');
      totalLatency += l1HitTime;
      
      if (l1Result.hit) {
        this.combinedStats.hits++;
        this.combinedStats.hitRate = this.combinedStats.hits / this.combinedStats.totalAccesses;
        return { l1Result, totalLatency, dataPath };
      }
    }
    
    // L1 miss or disabled, try L2
    if (this.l2) {
      l2Result = this.l2.access(address, isWrite);
      l2Result.level = 'L2';
      dataPath.push('L2');
      totalLatency += l2HitTime;
      
      if (l2Result.hit) {
        this.combinedStats.hits++;
        this.combinedStats.hitRate = this.combinedStats.hits / this.combinedStats.totalAccesses;
        return { l1Result, l2Result, totalLatency, dataPath };
      }
    }
    
    // Both missed, access main memory
    const blockSize = this.l1?.getConfig().blockSize ?? this.l2?.getConfig().blockSize ?? 64;
    memoryResult = this.memory.access(address, isWrite, blockSize);
    dataPath.push('Memory');
    totalLatency += memoryResult.latencyCycles;
    this.memoryAccesses++;
    
    // Mark the cache results as having accessed memory
    if (l1Result) l1Result.memoryAccessed = true;
    if (l2Result) l2Result.memoryAccessed = true;
    
    // Miss in all levels
    this.combinedStats.misses++;
    this.combinedStats.hitRate = this.combinedStats.hits / this.combinedStats.totalAccesses;
    
    return { l1Result, l2Result, memoryResult, totalLatency, dataPath };
  }

  getL1(): CacheSimulator | null {
    return this.l1;
  }

  getL2(): CacheSimulator | null {
    return this.l2;
  }

  getMemory(): MainMemory {
    return this.memory;
  }

  getL1Stats(): CacheStats | null {
    return this.l1?.getStats() ?? null;
  }

  getL2Stats(): CacheStats | null {
    return this.l2?.getStats() ?? null;
  }

  getMemoryStats(): MemoryStats {
    return this.memory.getStats();
  }

  getMemoryRegions(): MemoryRegion[] {
    return this.memory.getRegions();
  }

  getMemoryConfig(): MemoryConfig {
    return this.memory.getConfig();
  }

  getMemoryAccesses(): number {
    return this.memoryAccesses;
  }

  getCombinedStats(): CacheStats {
    return { ...this.combinedStats };
  }

  getConfig(): MultiLevelCacheConfig {
    return this.config;
  }

  getTotalCacheSize(): number {
    let total = 0;
    if (this.config.enabled.l1) total += this.config.l1.cacheSize;
    if (this.config.enabled.l2) total += this.config.l2.cacheSize;
    return total;
  }

  reset(): void {
    this.l1?.reset();
    this.l2?.reset();
    this.memory.reset();
    this.memoryAccesses = 0;
    this.combinedStats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAccesses: 0,
      writebacks: 0,
    };
  }

  // Calculate combined AMAT for multi-level cache with actual memory latency
  calculateAMAT(
    l1HitTime: number = 1,
    l2HitTime: number = 10,
    memoryPenalty?: number
  ): number {
    const actualMemoryPenalty = memoryPenalty ?? this.memoryConfig.latencyCycles;
    const l1Stats = this.l1?.getStats();
    const l2Stats = this.l2?.getStats();
    
    if (!this.config.enabled.l1 && !this.config.enabled.l2) {
      return actualMemoryPenalty;
    }
    
    if (!this.config.enabled.l2) {
      // Only L1
      const l1MissRate = l1Stats ? 1 - l1Stats.hitRate : 1;
      return l1HitTime + l1MissRate * actualMemoryPenalty;
    }
    
    if (!this.config.enabled.l1) {
      // Only L2
      const l2MissRate = l2Stats ? 1 - l2Stats.hitRate : 1;
      return l2HitTime + l2MissRate * actualMemoryPenalty;
    }
    
    // Both L1 and L2
    const l1MissRate = l1Stats ? 1 - l1Stats.hitRate : 1;
    const l2MissRate = l2Stats ? 1 - l2Stats.hitRate : 1;
    
    // AMAT = L1 hit time + L1 miss rate * (L2 hit time + L2 miss rate * Memory penalty)
    return l1HitTime + l1MissRate * (l2HitTime + l2MissRate * actualMemoryPenalty);
  }
}

// Trace file parser
export function parseTraceFile(content: string): TraceEntry[] {
  const lines = content.trim().split('\n');
  const entries: TraceEntry[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Format: R/W <hex_address> or just <hex_address>
    const parts = trimmed.split(/\s+/);
    
    if (parts.length >= 2) {
      const isWrite = parts[0].toUpperCase() === 'W';
      const address = parseInt(parts[1], 16);
      if (!isNaN(address)) {
        entries.push({ isWrite, address });
      }
    } else if (parts.length === 1) {
      const address = parseInt(parts[0], 16);
      if (!isNaN(address)) {
        entries.push({ isWrite: false, address });
      }
    }
  }
  
  return entries;
}

// Chunked trace file parser for large files
export async function parseTraceFileChunked(
  content: string,
  onProgress?: (percent: number) => void
): Promise<TraceEntry[]> {
  const lines = content.trim().split('\n');
  const entries: TraceEntry[] = [];
  const chunkSize = 10000; // Process 10k lines at a time
  
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, Math.min(i + chunkSize, lines.length));
    
    for (const line of chunk) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Format: R/W <hex_address> or just <hex_address>
      const parts = trimmed.split(/\s+/);
      
      if (parts.length >= 2) {
        const isWrite = parts[0].toUpperCase() === 'W';
        const address = parseInt(parts[1], 16);
        if (!isNaN(address)) {
          entries.push({ isWrite, address });
        }
      } else if (parts.length === 1) {
        const address = parseInt(parts[0], 16);
        if (!isNaN(address)) {
          entries.push({ isWrite: false, address });
        }
      }
    }
    
    // Report progress
    if (onProgress) {
      onProgress(Math.round((i / lines.length) * 100));
    }
    
    // Yield to browser to prevent freezing
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return entries;
}

// Sampled trace file parser for very large files (loads every Nth line)
export function parseTraceFileSampled(
  content: string,
  sampleRate: number = 10
): TraceEntry[] {
  const lines = content.trim().split('\n');
  const entries: TraceEntry[] = [];
  
  for (let i = 0; i < lines.length; i += sampleRate) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Format: R/W <hex_address> or just <hex_address>
    const parts = trimmed.split(/\s+/);
    
    if (parts.length >= 2) {
      const isWrite = parts[0].toUpperCase() === 'W';
      const address = parseInt(parts[1], 16);
      if (!isNaN(address)) {
        entries.push({ isWrite, address });
      }
    } else if (parts.length === 1) {
      const address = parseInt(parts[0], 16);
      if (!isNaN(address)) {
        entries.push({ isWrite: false, address });
      }
    }
  }
  
  return entries;
}


// Pattern generators - Cache-Aware versions

// Configuration interface for cache-aware trace generation
export interface CacheAwareConfig {
  l1CacheSize?: number;      // L1 cache size in bytes
  l1BlockSize?: number;      // L1 block size in bytes
  l1Associativity?: number;  // L1 associativity
  l2CacheSize?: number;      // L2 cache size in bytes
  l2BlockSize?: number;      // L2 block size in bytes
  l2Associativity?: number;  // L2 associativity
}

// Stress level for trace generation - controls working set sizes
export type StressLevel = 'light' | 'moderate' | 'heavy' | 'extreme';

// User-controllable trace generation options
export interface TraceGenerationOptions {
  stressLevel: StressLevel;           // How aggressively to stress the cache
  targetWorkingSetKB?: number;        // Override: absolute working set size
  writeRatio?: number;                // 0.0 - 1.0 write percentage (default varies by pattern)
  enableL2Pressure?: boolean;         // Whether to additionally stress L2
}

// Default trace generation options
export const defaultTraceOptions: TraceGenerationOptions = {
  stressLevel: 'moderate',
  writeRatio: undefined, // Use pattern default
  enableL2Pressure: false,
};

// Stress level multipliers relative to L1 cache size
// Key insight: we calculate ABSOLUTE sizes that span cache configurations
const stressMultipliers: Record<StressLevel, { 
  workingSetMultiplier: number;  // Multiplier for L1 cache size
  hotSetRatio: number;           // Hot set as ratio of working set
  coldSetRatio: number;          // Cold set as ratio of working set
  itemMultiplier: number;        // For Zipfian: items as multiple of cache blocks
  description: string;
}> = {
  light: {
    workingSetMultiplier: 0.5,   // 50% of L1 - fits comfortably
    hotSetRatio: 0.7,
    coldSetRatio: 0.3,
    itemMultiplier: 2,
    description: 'Fits in L1, high hit rates expected',
  },
  moderate: {
    workingSetMultiplier: 1.5,   // 150% of L1 - causes some misses
    hotSetRatio: 0.4,
    coldSetRatio: 1.0,
    itemMultiplier: 5,
    description: 'Spills from L1, tests replacement policy',
  },
  heavy: {
    workingSetMultiplier: 3.0,   // 300% of L1 - significant misses
    hotSetRatio: 0.3,
    coldSetRatio: 2.0,
    itemMultiplier: 15,
    description: 'Heavy L1 pressure, L2 becomes important',
  },
  extreme: {
    workingSetMultiplier: 8.0,   // 800% of L1 - stresses entire hierarchy
    hotSetRatio: 0.2,
    coldSetRatio: 5.0,
    itemMultiplier: 50,
    description: 'Stresses entire cache hierarchy',
  },
};

// Get stress-aware working set sizes
export function getStressAwareSizes(
  config: Required<CacheAwareConfig>,
  options: TraceGenerationOptions = defaultTraceOptions
): {
  workingSetBytes: number;
  hotSetBytes: number;
  coldSetBytes: number;
  numItems: number;
  description: string;
} {
  const stress = stressMultipliers[options.stressLevel];
  
  // If user provided explicit target, use it
  if (options.targetWorkingSetKB) {
    const workingSetBytes = options.targetWorkingSetKB * 1024;
    return {
      workingSetBytes,
      hotSetBytes: Math.floor(workingSetBytes * stress.hotSetRatio),
      coldSetBytes: Math.floor(workingSetBytes * stress.coldSetRatio),
      numItems: Math.floor(workingSetBytes / config.l1BlockSize * 2),
      description: `Custom ${options.targetWorkingSetKB}KB working set`,
    };
  }
  
  // Calculate based on stress level and L1 size
  const baseWorkingSet = config.l1CacheSize * stress.workingSetMultiplier;
  
  // Apply L2 pressure if enabled (use L2 as base instead)
  const workingSetBytes = options.enableL2Pressure
    ? config.l2CacheSize * stress.workingSetMultiplier * 0.5
    : baseWorkingSet;
  
  const cacheBlocks = config.l1CacheSize / config.l1BlockSize;
  
  return {
    workingSetBytes: Math.floor(workingSetBytes),
    hotSetBytes: Math.floor(workingSetBytes * stress.hotSetRatio),
    coldSetBytes: Math.floor(workingSetBytes * stress.coldSetRatio),
    numItems: Math.floor(cacheBlocks * stress.itemMultiplier),
    description: stress.description,
  };
}

// Get stress level description for UI
export function getStressLevelInfo(level: StressLevel): {
  name: string;
  description: string;
  expectedHitRate: string;
} {
  switch (level) {
    case 'light':
      return {
        name: 'Light',
        description: 'Working set fits in L1 cache',
        expectedHitRate: '90%+ hit rate',
      };
    case 'moderate':
      return {
        name: 'Moderate', 
        description: 'Working set exceeds L1, tests replacement',
        expectedHitRate: '60-85% hit rate',
      };
    case 'heavy':
      return {
        name: 'Heavy',
        description: 'Significant L1 misses, L2 becomes critical',
        expectedHitRate: '30-60% hit rate',
      };
    case 'extreme':
      return {
        name: 'Extreme',
        description: 'Stresses entire cache hierarchy',
        expectedHitRate: '<30% hit rate',
      };
  }
}

// Info about generated trace pattern
export interface TraceGeneratorInfo {
  name: string;
  description: string;
  whatItTests: string[];
  expectedBehavior: string;
  optimalFor: string[];
  worstFor: string[];
  stressInfo?: string; // Added: stress level context
}

// Default cache config if none provided
const defaultCacheAwareConfig: Required<CacheAwareConfig> = {
  l1CacheSize: 32 * 1024,    // 32KB L1
  l1BlockSize: 64,           // 64B blocks
  l1Associativity: 4,        // 4-way
  l2CacheSize: 256 * 1024,   // 256KB L2
  l2BlockSize: 64,
  l2Associativity: 8,
};

function getEffectiveConfig(config?: CacheAwareConfig): Required<CacheAwareConfig> {
  return {
    ...defaultCacheAwareConfig,
    ...config,
  };
}

// SEQUENTIAL TRACE - Tests spatial locality
export function generateSequentialTrace(
  startAddress: number, 
  count: number, 
  stride: number = 4,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  
  // Use block-aligned addresses for optimal cache utilization
  const blockSize = config.l1BlockSize;
  const alignedStart = Math.floor(startAddress / blockSize) * blockSize;
  
  // Stride covers working set based on stress level
  const effectiveStride = Math.max(stride, blockSize / 4);
  const writeRatio = options.writeRatio ?? 0.25;
  
  for (let i = 0; i < count; i++) {
    entries.push({
      isWrite: Math.random() < writeRatio,
      address: alignedStart + (i * effectiveStride),
    });
  }
  return entries;
}

export function getSequentialTraceInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const blocksInL1 = config.l1CacheSize / config.l1BlockSize;
  const stressInfo = getStressLevelInfo(options.stressLevel);
  
  return {
    name: "Sequential Access",
    description: `Linear memory traversal with stride-4 access. Block-aligned to ${config.l1BlockSize}B cache lines.`,
    whatItTests: [
      "Spatial locality exploitation",
      "Cache block utilization efficiency",
      "Prefetcher effectiveness (if enabled)",
    ],
    expectedBehavior: `Near 100% hit rate after initial compulsory misses. ${blocksInL1} blocks fill L1 before cycling.`,
    optimalFor: ["All replacement policies", "All cache sizes"],
    worstFor: ["None - this is the ideal access pattern"],
    stressInfo: `${stressInfo.name}: ${stressInfo.description}`,
  };
}

// RANDOM TRACE - Tests cache capacity under random access
export function generateRandomTrace(
  baseAddress: number, 
  range: number, 
  count: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  
  // Use stress-aware working set size for address range
  const effectiveRange = options.targetWorkingSetKB 
    ? options.targetWorkingSetKB * 1024 
    : sizes.workingSetBytes;
  const blockSize = config.l1BlockSize;
  const writeRatio = options.writeRatio ?? 0.30;
  
  for (let i = 0; i < count; i++) {
    // Block-align random addresses
    const randomOffset = Math.floor(Math.random() * (effectiveRange / blockSize)) * blockSize;
    entries.push({
      isWrite: Math.random() < writeRatio,
      address: baseAddress + randomOffset,
    });
  }
  return entries;
}

export function getRandomTraceInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const l1Blocks = config.l1CacheSize / config.l1BlockSize;
  const rangeBlocks = sizes.workingSetBytes / config.l1BlockSize;
  const expectedHitRate = Math.min(100, (l1Blocks / rangeBlocks * 100)).toFixed(1);
  const stressInfo = getStressLevelInfo(options.stressLevel);
  const rangeKB = (sizes.workingSetBytes / 1024).toFixed(0);
  
  return {
    name: "Random Access",
    description: `Uniformly random access across ${rangeKB}KB range. No temporal or spatial locality.`,
    whatItTests: [
      "Cache behavior under minimal locality",
      "Associativity effectiveness for conflict handling",
      "Replacement policy under random workload",
    ],
    expectedBehavior: `Expected ~${expectedHitRate}% hit rate. ${stressInfo.expectedHitRate}.`,
    optimalFor: ["Larger caches", "Higher associativity"],
    worstFor: ["Small caches", "Direct-mapped configurations"],
    stressInfo: `${stressInfo.name}: ${rangeKB}KB working set (${stressInfo.description})`,
  };
}

// STRIDED TRACE - Tests matrix-like access patterns
export function generateStridedTrace(
  startAddress: number, 
  count: number, 
  stride: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  const writeRatio = options.writeRatio ?? 0.0;
  
  // Use stride that causes conflicts based on stress level
  // Light: stride = block size (sequential), Heavy: stride = set size (conflict)
  const numSets = config.l1CacheSize / config.l1BlockSize / config.l1Associativity;
  const setSize = numSets * config.l1BlockSize;
  const stressMultiplier = options.stressLevel === 'light' ? 0.25 
    : options.stressLevel === 'moderate' ? 0.5 
    : options.stressLevel === 'heavy' ? 1.0 
    : 2.0; // extreme
  const effectiveStride = stride || Math.floor(setSize * stressMultiplier);
  
  for (let i = 0; i < count; i++) {
    entries.push({
      isWrite: Math.random() < writeRatio,
      address: startAddress + (i * effectiveStride),
    });
  }
  return entries;
}

export function getStridedTraceInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const numSets = config.l1CacheSize / config.l1BlockSize / config.l1Associativity;
  const setSize = numSets * config.l1BlockSize;
  const stressMultiplier = options.stressLevel === 'light' ? 0.25 
    : options.stressLevel === 'moderate' ? 0.5 
    : options.stressLevel === 'heavy' ? 1.0 
    : 2.0;
  const effectiveStride = Math.floor(setSize * stressMultiplier);
  const stressInfo = getStressLevelInfo(options.stressLevel);
  
  return {
    name: "Strided Access",
    description: `Matrix column traversal. Stride = ${(effectiveStride / 1024).toFixed(1)}KB. Stresses set conflicts.`,
    whatItTests: [
      "Set-associative conflict handling",
      "Matrix/2D array access patterns",
      "Stride=set_size worst-case scenario",
    ],
    expectedBehavior: `${options.stressLevel === 'extreme' ? 'Very high miss rate' : 'Moderate conflicts'}. ${config.l1Associativity}-way limits concurrent strides.`,
    optimalFor: ["Higher associativity caches"],
    worstFor: ["Direct-mapped (1-way) caches", "Low associativity"],
    stressInfo: `${stressInfo.name}: Stride ${(effectiveStride / 1024).toFixed(1)}KB (${stressInfo.description})`,
  };
}

// TEMPORAL LOCALITY TRACE - Tests LRU/LFU differentiation
export function generateTemporalLocalityTrace(
  baseAddress: number, 
  hotCount: number, 
  coldCount: number, 
  iterations: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  const blockSize = config.l1BlockSize;
  
  // Stress-aware hot and cold set sizes
  // Hot set should fit in cache for light stress, exceed for heavy stress
  const hotBlocks = Math.max(hotCount, Math.floor(sizes.hotSetBytes / blockSize));
  const coldBlocks = Math.max(coldCount, Math.floor(sizes.coldSetBytes / blockSize));
  
  const hotAddresses = Array.from({ length: hotBlocks }, (_, i) => 
    baseAddress + i * blockSize);
  const coldAddresses = Array.from({ length: coldBlocks }, (_, i) => 
    baseAddress + 0x100000 + i * blockSize);
  
  for (let iter = 0; iter < iterations; iter++) {
    // Access hot addresses with frequency gradient (LFU differentiator)
    for (let j = 0; j < hotAddresses.length; j++) {
      // More frequent accesses for lower indices (LFU will protect these)
      const repeatCount = Math.max(1, 5 - Math.floor(j / Math.max(1, hotAddresses.length / 5)));
      for (let r = 0; r < repeatCount; r++) {
        entries.push({ isWrite: false, address: hotAddresses[j] });
      }
    }
    // Cold scan causes pressure - tests if hot data stays resident
    for (const addr of coldAddresses) {
      entries.push({ isWrite: false, address: addr });
    }
  }
  
  return entries;
}

export function getTemporalLocalityInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const hotSizeKB = (sizes.hotSetBytes / 1024).toFixed(1);
  const coldSizeKB = (sizes.coldSetBytes / 1024).toFixed(1);
  const l1SizeKB = config.l1CacheSize / 1024;
  const stressInfo = getStressLevelInfo(options.stressLevel);
  const hotFitsL1 = sizes.hotSetBytes < config.l1CacheSize;
  
  return {
    name: "Temporal Locality (Hot/Cold)",
    description: `Hot set ${hotSizeKB}KB with ${coldSizeKB}KB cold scans. ${hotFitsL1 ? 'Hot fits in L1' : 'Hot exceeds L1'}.`,
    whatItTests: [
      "LRU vs LFU policy effectiveness",
      "Working set retention under pressure",
      "Frequency-based eviction decisions",
    ],
    expectedBehavior: hotFitsL1 
      ? `High hit rate on hot data. LFU should protect frequently-accessed items.`
      : `Hot set exceeds ${l1SizeKB}KB L1, expect significant misses. L2 becomes critical.`,
    optimalFor: ["LFU replacement policy", "Larger cache sizes"],
    worstFor: ["FIFO (no recency awareness)", `Caches smaller than ${hotSizeKB}KB`],
    stressInfo: `${stressInfo.name}: Hot=${hotSizeKB}KB, Cold=${coldSizeKB}KB (${stressInfo.description})`,
  };
}

// WORKING SET TRACE - Tests cache capacity boundaries
export function generateWorkingSetTrace(
  baseAddress: number, 
  workingSetKB: number, 
  count: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  
  // Use stress-aware working set size
  const effectiveWorkingSetBytes = options.targetWorkingSetKB 
    ? options.targetWorkingSetKB * 1024 
    : sizes.workingSetBytes;
  const blockSize = config.l1BlockSize;
  const numBlocks = Math.max(1, Math.floor(effectiveWorkingSetBytes / blockSize));
  const writeRatio = options.writeRatio ?? 0.125;
  
  for (let i = 0; i < count; i++) {
    const blockIndex = i % numBlocks;
    entries.push({
      isWrite: Math.random() < writeRatio,
      address: baseAddress + blockIndex * blockSize,
    });
  }
  return entries;
}

export function getWorkingSetInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const workingSetKB = (sizes.workingSetBytes / 1024).toFixed(1);
  const l1SizeKB = config.l1CacheSize / 1024;
  const stressInfo = getStressLevelInfo(options.stressLevel);
  const fitsL1 = sizes.workingSetBytes < config.l1CacheSize;
  
  return {
    name: "Working Set Cycle",
    description: `Cycles through ${workingSetKB}KB working set. ${fitsL1 ? 'Fits in L1' : 'Exceeds L1, spills to L2'}.`,
    whatItTests: [
      "Cache capacity utilization",
      "Steady-state hit rate",
      "Write-back behavior with periodic writes",
    ],
    expectedBehavior: fitsL1 
      ? `High hit rate (~95%+) after warm-up since working set fits in ${l1SizeKB}KB L1.`
      : `Moderate hit rate. Working set exceeds ${l1SizeKB}KB L1, L2 catches spills.`,
    optimalFor: ["All replacement policies", "Write-back policy"],
    worstFor: fitsL1 ? ["None when working set < cache size"] : [`Caches smaller than ${workingSetKB}KB`],
    stressInfo: `${stressInfo.name}: ${workingSetKB}KB working set (${stressInfo.description})`,
  };
}

// THRASHING TRACE - Deliberately causes cache thrashing
export function generateThrashingTrace(
  baseAddress: number, 
  cacheKB: number, 
  count: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  
  // Thrashing size increases with stress level
  // Always at least 1.2x L1 to guarantee thrashing
  const minThrashMultiplier = 1.2;
  const stressMultiplier = options.stressLevel === 'light' ? 1.3 
    : options.stressLevel === 'moderate' ? 2.0 
    : options.stressLevel === 'heavy' ? 4.0 
    : 10.0; // extreme
  const thrashSize = Math.floor(config.l1CacheSize * stressMultiplier);
  const blockSize = config.l1BlockSize;
  const numBlocks = Math.floor(thrashSize / blockSize);
  
  for (let i = 0; i < count; i++) {
    // Sequential cycle through oversized working set
    const blockIndex = i % numBlocks;
    entries.push({
      isWrite: false,
      address: baseAddress + blockIndex * blockSize,
    });
  }
  return entries;
}

export function getThrashingInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const stressMultiplier = options.stressLevel === 'light' ? 1.3 
    : options.stressLevel === 'moderate' ? 2.0 
    : options.stressLevel === 'heavy' ? 4.0 
    : 10.0;
  const thrashSizeKB = Math.floor((config.l1CacheSize * stressMultiplier) / 1024);
  const l1SizeKB = config.l1CacheSize / 1024;
  const stressInfo = getStressLevelInfo(options.stressLevel);
  
  return {
    name: "Cache Thrashing",
    description: `Cycles through ${thrashSizeKB}KB (${(stressMultiplier * 100).toFixed(0)}% of ${l1SizeKB}KB L1), forcing evictions.`,
    whatItTests: [
      "Behavior when working set exceeds capacity",
      "Eviction storms and their impact",
      "L2 cache effectiveness as victim cache",
    ],
    expectedBehavior: `Very low L1 hit rate. Data evicted before reuse. L2 critical for ${options.stressLevel === 'extreme' ? 'survival' : 'catching misses'}.`,
    optimalFor: ["Larger L1 configurations", "L2 cache testing"],
    worstFor: ["Small L1 caches", "Single-level hierarchies"],
    stressInfo: `${stressInfo.name}: ${thrashSizeKB}KB thrash size (${stressInfo.description})`,
  };
}

// LRU KILLER TRACE - Exploits LRU weakness
// KEY INSIGHT: All addresses must map to the SAME set in ANY cache configuration
// We use a stride >= largest tested cache (1MB) so addresses always collide
export function generateLRUKillerTrace(
  baseAddress: number, 
  setCount: number, 
  count: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const entries: TraceEntry[] = [];
  const blockSize = config.l1BlockSize;
  
  // CRITICAL FIX: Use a stride larger than ANY cache we might test
  // This ensures ALL addresses map to set 0 in any cache <= 1MB
  const BIG_STRIDE = 1024 * 1024; // 1MB - larger than any L1/L2 we test
  
  // Target associativity based on stress level
  const minTargetAssoc = options.stressLevel === 'light' ? 2 
    : options.stressLevel === 'moderate' ? 4 
    : options.stressLevel === 'heavy' ? 8 
    : 16; // extreme: target 16-way caches
  
  const effectiveAssoc = Math.max(config.l1Associativity, minTargetAssoc);
  
  // Number of blocks = associativity + extra (guarantees evictions)
  const extraBlocks = options.stressLevel === 'light' ? 1 
    : options.stressLevel === 'moderate' ? 2 
    : options.stressLevel === 'heavy' ? 4 
    : effectiveAssoc; // extreme: double
  
  const blocksPerSet = effectiveAssoc + extraBlocks;
  
  // Generate addresses that ALL map to set 0 in any cache
  for (let i = 0; i < count; i++) {
    const blockInSet = i % blocksPerSet;
    // Each block is BIG_STRIDE apart - they all map to same set
    entries.push({
      isWrite: false,
      address: baseAddress + blockInSet * BIG_STRIDE,
    });
  }
  return entries;
}

export function getLRUKillerInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const ways = config.l1Associativity;
  
  // Match the generator's logic
  const minTargetAssoc = options.stressLevel === 'light' ? 2 
    : options.stressLevel === 'moderate' ? 4 
    : options.stressLevel === 'heavy' ? 8 
    : 16;
  const effectiveAssoc = Math.max(ways, minTargetAssoc);
  const extraBlocks = options.stressLevel === 'light' ? 1 
    : options.stressLevel === 'moderate' ? 2 
    : options.stressLevel === 'heavy' ? 4 
    : effectiveAssoc;
  const totalBlocks = effectiveAssoc + extraBlocks;
  const stressInfo = getStressLevelInfo(options.stressLevel);
  
  return {
    name: "LRU Killer Pattern",
    description: `${totalBlocks} addresses cycle to stress up to ${effectiveAssoc}-way caches.`,
    whatItTests: [
      "LRU replacement policy weakness",
      "Cyclic access patterns",
      "Belady's anomaly-like behavior",
    ],
    expectedBehavior: `Caches with <${effectiveAssoc} ways will thrash. ${effectiveAssoc}+ way caches may partially survive.`,
    optimalFor: ["RANDOM replacement", `>${effectiveAssoc}-way associativity`],
    worstFor: ["LRU replacement", "FIFO replacement", `<=${effectiveAssoc}-way caches`],
    stressInfo: `${stressInfo.name}: Targets up to ${effectiveAssoc}-way caches with ${totalBlocks} blocks (${stressInfo.description})`,
  };
}

// ZIPFIAN TRACE - Realistic web/database access distribution
export function generateZipfianTrace(
  baseAddress: number, 
  numItems: number, 
  count: number, 
  skew: number = 1.0,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  const blockSize = config.l1BlockSize;
  const writeRatio = options.writeRatio ?? 0.20;
  
  // Number of unique items scales with stress level
  const effectiveNumItems = numItems || sizes.numItems;
  
  // Pre-compute Zipfian probabilities
  const probs: number[] = [];
  let sum = 0;
  for (let i = 1; i <= effectiveNumItems; i++) {
    const p = 1.0 / Math.pow(i, skew);
    probs.push(p);
    sum += p;
  }
  // Normalize
  for (let i = 0; i < probs.length; i++) {
    probs[i] /= sum;
  }
  
  // Create cumulative distribution
  const cdf: number[] = [];
  let cumulative = 0;
  for (const p of probs) {
    cumulative += p;
    cdf.push(cumulative);
  }
  
  // Generate trace using inverse CDF
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let itemIndex = 0;
    for (let j = 0; j < cdf.length; j++) {
      if (r <= cdf[j]) {
        itemIndex = j;
        break;
      }
    }
    entries.push({
      isWrite: Math.random() < writeRatio,
      address: baseAddress + itemIndex * blockSize,
    });
  }
  return entries;
}

export function getZipfianInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const cacheBlocks = config.l1CacheSize / config.l1BlockSize;
  const numItems = sizes.numItems;
  const stressInfo = getStressLevelInfo(options.stressLevel);
  const itemsToBlocksRatio = numItems / cacheBlocks;
  
  return {
    name: "Zipfian Distribution",
    description: `Power-law over ${numItems} items (${itemsToBlocksRatio.toFixed(1)}× L1 blocks). Top 20% get 80% accesses.`,
    whatItTests: [
      "Real-world access pattern simulation",
      "Frequency-based caching effectiveness",
      "Hot item retention",
    ],
    expectedBehavior: `Hit rate depends on stress. ${options.stressLevel === 'light' ? 'High' : options.stressLevel === 'extreme' ? 'Low' : 'Moderate'} hit rate expected.`,
    optimalFor: ["LFU replacement", "LRU replacement", "Larger caches"],
    worstFor: ["RANDOM replacement", "Very small caches"],
    stressInfo: `${stressInfo.name}: ${numItems} items for ${cacheBlocks} L1 blocks (${stressInfo.description})`,
  };
}

// SCAN WITH REUSE - Tests larger associativity benefits
export function generateScanWithReuseTrace(
  baseAddress: number, 
  arraySize: number, 
  reuseDistance: number, 
  count: number,
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceEntry[] {
  const config = getEffectiveConfig(cacheConfig);
  const sizes = getStressAwareSizes(config, options);
  const entries: TraceEntry[] = [];
  const blockSize = config.l1BlockSize;
  
  // Array size scales with stress level
  const l1Blocks = config.l1CacheSize / blockSize;
  const stressArrayMultiplier = options.stressLevel === 'light' ? 0.5 
    : options.stressLevel === 'moderate' ? 1.0 
    : options.stressLevel === 'heavy' ? 2.0 
    : 4.0;
  const effectiveArraySize = arraySize || Math.floor(l1Blocks * stressArrayMultiplier);
  const effectiveReuseDistance = reuseDistance || Math.floor(effectiveArraySize * 0.25);
  
  for (let i = 0; i < count; i++) {
    const phase = i % (effectiveArraySize + effectiveReuseDistance);
    let address: number;
    
    if (phase < effectiveArraySize) {
      // Forward scan
      address = baseAddress + phase * blockSize;
    } else {
      // Reuse: access recently used data
      const reuseIndex = effectiveArraySize - 1 - (phase - effectiveArraySize);
      address = baseAddress + Math.max(0, reuseIndex) * blockSize;
    }
    
    entries.push({ isWrite: false, address });
  }
  return entries;
}

export function getScanWithReuseInfo(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): TraceGeneratorInfo {
  const config = getEffectiveConfig(cacheConfig);
  const l1Blocks = config.l1CacheSize / config.l1BlockSize;
  const stressArrayMultiplier = options.stressLevel === 'light' ? 0.5 
    : options.stressLevel === 'moderate' ? 1.0 
    : options.stressLevel === 'heavy' ? 2.0 
    : 4.0;
  const arrayBlocks = Math.floor(l1Blocks * stressArrayMultiplier);
  const arrayKB = (arrayBlocks * config.l1BlockSize / 1024).toFixed(1);
  const stressInfo = getStressLevelInfo(options.stressLevel);
  const fitsL1 = arrayBlocks < l1Blocks;
  
  return {
    name: "Scan with Reuse",
    description: `Scan ${arrayKB}KB array (${(stressArrayMultiplier * 100).toFixed(0)}% of L1), reuse last 25%. ${fitsL1 ? 'Fits in L1' : 'Exceeds L1'}.`,
    whatItTests: [
      "Forward scan followed by backward reuse",
      "Recency-based policy effectiveness",
      "Array algorithm simulation",
    ],
    expectedBehavior: fitsL1 
      ? `LRU shows high reuse hit rate since scanned items stay cached.`
      : `Array exceeds L1, expect reuse misses unless L2 catches spills.`,
    optimalFor: ["LRU replacement", "Caches larger than scan size"],
    worstFor: ["FIFO (no recency adaptation)", "Small caches"],
    stressInfo: `${stressInfo.name}: ${arrayKB}KB scan size (${stressInfo.description})`,
  };
}

// Get all pattern infos for UI
export function getAllPatternInfos(
  cacheConfig?: CacheAwareConfig,
  options: TraceGenerationOptions = defaultTraceOptions
): Record<string, TraceGeneratorInfo> {
  return {
    sequential: getSequentialTraceInfo(cacheConfig, options),
    random: getRandomTraceInfo(cacheConfig, options),
    strided: getStridedTraceInfo(cacheConfig, options),
    temporal: getTemporalLocalityInfo(cacheConfig, options),
    workingset: getWorkingSetInfo(cacheConfig, options),
    thrashing: getThrashingInfo(cacheConfig, options),
    lrukiller: getLRUKillerInfo(cacheConfig, options),
    zipfian: getZipfianInfo(cacheConfig, options),
    scanreuse: getScanWithReuseInfo(cacheConfig, options),
  };
}


// Sweet Spot Optimizer
export interface OptimizationResult {
  config: CacheConfig;
  stats: CacheStats;
  amat: number;
  score: number;
}

export interface MultiLevelOptimizationResult {
  l1Config: CacheConfig;
  l2Config: CacheConfig;
  l1Stats: CacheStats;
  l2Stats: CacheStats;
  combinedStats: CacheStats;
  amat: number;
  score: number;
  totalSize: number;
}

export function runOptimization(
  trace: TraceEntry[],
  sizesKB: number[] = [1, 2, 4, 8, 16, 32, 64],
  associativities: number[] = [1, 2, 4, 8],
  blockSizes: number[] = [16, 32, 64]
): OptimizationResult[] {
  const results: OptimizationResult[] = [];
  
  for (const sizeKB of sizesKB) {
    for (const assoc of associativities) {
      for (const blockSize of blockSizes) {
        const cacheSize = sizeKB * 1024;
        
        // Skip invalid configurations
        if (cacheSize / blockSize < assoc) continue;
        
        const config: CacheConfig = {
          cacheSize,
          blockSize,
          associativity: assoc,
          replacementPolicy: 'LRU',
          writePolicy: 'write-back',
        };
        
        const sim = new CacheSimulator(config);
        
        for (const entry of trace) {
          sim.access(entry.address, entry.isWrite);
        }
        
        const stats = sim.getStats();
        const amat = sim.calculateAMAT();
        
        // Score: lower is better (penalize size for cost)
        const costFactor = Math.log2(sizeKB) * 0.1;
        const score = (1 / amat) * (1 / (1 + costFactor));
        
        results.push({ config, stats, amat, score });
      }
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

// Multi-Level Cache Optimization
export function runMultiLevelOptimization(
  trace: TraceEntry[],
  l1SizesKB: number[] = [1, 2, 4, 8],
  l2SizesKB: number[] = [16, 32, 64],
  l1Associativities: number[] = [1, 2, 4],
  l2Associativities: number[] = [4, 8],
  l1BlockSizes: number[] = [32, 64],
  l2BlockSizes: number[] = [64, 128],
  replacementPolicies: ReplacementPolicy[] = ['LRU', 'LFU', 'FIFO', 'RANDOM']
): MultiLevelOptimizationResult[] {
  const results: MultiLevelOptimizationResult[] = [];
  
  for (const l1SizeKB of l1SizesKB) {
    for (const l2SizeKB of l2SizesKB) {
      // L2 should be larger than L1
      if (l2SizeKB <= l1SizeKB) continue;
      
      for (const l1Assoc of l1Associativities) {
        for (const l2Assoc of l2Associativities) {
          for (const l1BlockSize of l1BlockSizes) {
            for (const l2BlockSize of l2BlockSizes) {
              for (const policy of replacementPolicies) {
                const l1CacheSize = l1SizeKB * 1024;
                const l2CacheSize = l2SizeKB * 1024;
                
                // Skip invalid configurations
                if (l1CacheSize / l1BlockSize < l1Assoc) continue;
                if (l2CacheSize / l2BlockSize < l2Assoc) continue;
                
                const l1Config: CacheConfig = {
                  cacheSize: l1CacheSize,
                  blockSize: l1BlockSize,
                  associativity: l1Assoc,
                  replacementPolicy: policy,
                  writePolicy: 'write-back',
                };
                
                const l2Config: CacheConfig = {
                  cacheSize: l2CacheSize,
                  blockSize: l2BlockSize,
                  associativity: l2Assoc,
                  replacementPolicy: policy,
                  writePolicy: 'write-back',
                };
                
                const multiConfig: MultiLevelCacheConfig = {
                  l1: l1Config,
                  l2: l2Config,
                  enabled: { l1: true, l2: true },
                };
                
                const sim = new MultiLevelCacheSimulator(multiConfig);
                
                for (const entry of trace) {
                  sim.access(entry.address, entry.isWrite);
                }
                
                const l1Stats = sim.getL1Stats()!;
                const l2Stats = sim.getL2Stats()!;
                const combinedStats = sim.getCombinedStats();
                const amat = sim.calculateAMAT();
                const totalSize = l1CacheSize + l2CacheSize;
                
                // Score: balance between AMAT and cost (size)
                const costFactor = Math.log2(totalSize / 1024) * 0.05;
                const score = (1 / amat) * (1 / (1 + costFactor));
                
                results.push({
                  l1Config,
                  l2Config,
                  l1Stats,
                  l2Stats,
                  combinedStats,
                  amat,
                  score,
                  totalSize,
                });
              }
            }
          }
        }
      }
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

// Single Level Optimization with all replacement policies
export function runSingleLevelOptimization(
  trace: TraceEntry[],
  sizesKB: number[] = [1, 2, 4, 8, 16, 32, 64],
  associativities: number[] = [1, 2, 4, 8],
  blockSizes: number[] = [16, 32, 64],
  replacementPolicies: ReplacementPolicy[] = ['LRU', 'LFU', 'FIFO', 'RANDOM']
): OptimizationResult[] {
  const results: OptimizationResult[] = [];
  
  for (const sizeKB of sizesKB) {
    for (const assoc of associativities) {
      for (const blockSize of blockSizes) {
        for (const policy of replacementPolicies) {
          const cacheSize = sizeKB * 1024;
          
          // Skip invalid configurations
          if (cacheSize / blockSize < assoc) continue;
          
          const config: CacheConfig = {
            cacheSize,
            blockSize,
            associativity: assoc,
            replacementPolicy: policy,
            writePolicy: 'write-back',
          };
          
          const sim = new CacheSimulator(config);
          
          for (const entry of trace) {
            sim.access(entry.address, entry.isWrite);
          }
          
          const stats = sim.getStats();
          const amat = sim.calculateAMAT();
          
          // Score: lower is better (penalize size for cost)
          const costFactor = Math.log2(sizeKB) * 0.1;
          const score = (1 / amat) * (1 / (1 + costFactor));
          
          results.push({ config, stats, amat, score });
        }
      }
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}
