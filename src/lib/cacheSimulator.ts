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

// Pattern generators
export function generateSequentialTrace(startAddress: number, count: number, stride: number = 4): TraceEntry[] {
  const entries: TraceEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      isWrite: i % 4 === 0,
      address: startAddress + (i * stride),
    });
  }
  return entries;
}

export function generateRandomTrace(baseAddress: number, range: number, count: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  // Use a much larger address range to ensure cache pressure
  const actualRange = Math.max(range, 0x100000); // At least 1MB range
  for (let i = 0; i < count; i++) {
    entries.push({
      isWrite: Math.random() > 0.7,
      address: baseAddress + Math.floor(Math.random() * actualRange),
    });
  }
  return entries;
}

export function generateStridedTrace(startAddress: number, count: number, stride: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      isWrite: false,
      address: startAddress + (i * stride),
    });
  }
  return entries;
}

export function generateTemporalLocalityTrace(baseAddress: number, hotCount: number, coldCount: number, iterations: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  // Increase working set sizes to stress cache
  const actualHotCount = Math.max(hotCount, 50); // More hot addresses
  const actualColdCount = Math.max(coldCount, 500); // More cold addresses
  const hotAddresses = Array.from({ length: actualHotCount }, (_, i) => baseAddress + i * 64);
  const coldAddresses = Array.from({ length: actualColdCount }, (_, i) => baseAddress + 0x100000 + i * 64);
  
  for (let iter = 0; iter < iterations; iter++) {
    // Access hot addresses with varying frequency (creates LFU differentiation)
    for (let rep = 0; rep < 3; rep++) {
      for (let j = 0; j < hotAddresses.length; j++) {
        // Higher index = more frequent access (LFU will prefer these)
        const repeatCount = 1 + Math.floor(j / 10);
        for (let r = 0; r < repeatCount; r++) {
          entries.push({ isWrite: false, address: hotAddresses[j] });
        }
      }
    }
    // Cold addresses cause evictions
    for (const addr of coldAddresses) {
      entries.push({ isWrite: false, address: addr });
    }
  }
  
  return entries;
}

// NEW: Working Set Scan - cycles through a working set, stressing capacity
export function generateWorkingSetTrace(baseAddress: number, workingSetKB: number, count: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  const workingSetSize = workingSetKB * 1024;
  const blockSize = 64; // Assume typical block size
  const numBlocks = Math.floor(workingSetSize / blockSize);
  
  for (let i = 0; i < count; i++) {
    const blockIndex = i % numBlocks;
    entries.push({
      isWrite: i % 8 === 0,
      address: baseAddress + blockIndex * blockSize,
    });
  }
  return entries;
}

// NEW: Thrashing pattern - deliberately causes cache thrashing
export function generateThrashingTrace(baseAddress: number, cacheKB: number, count: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  // Access pattern larger than cache to force constant evictions
  const thrashSize = cacheKB * 1024 * 2; // 2x cache size
  const blockSize = 64;
  const numBlocks = Math.floor(thrashSize / blockSize);
  
  for (let i = 0; i < count; i++) {
    // Cycle through addresses that exceed cache capacity
    const blockIndex = i % numBlocks;
    entries.push({
      isWrite: false,
      address: baseAddress + blockIndex * blockSize,
    });
  }
  return entries;
}

// NEW: LRU killer - specifically designed to show LRU weaknesses
export function generateLRUKillerTrace(baseAddress: number, setCount: number, count: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  const blockSize = 64;
  
  // This pattern accesses N+1 addresses that all map to the same set
  // where N is the associativity. LRU will thrash, but other policies might not.
  for (let i = 0; i < count; i++) {
    // Create addresses that map to same cache set (stride by large power of 2)
    const setStride = 4096; // Addresses setStride apart often map to same set
    const blockInSet = i % (setCount + 1);
    entries.push({
      isWrite: false,
      address: baseAddress + blockInSet * setStride,
    });
  }
  return entries;
}

// NEW: Zipfian distribution - models real-world access patterns
export function generateZipfianTrace(baseAddress: number, numItems: number, count: number, skew: number = 1.0): TraceEntry[] {
  const entries: TraceEntry[] = [];
  const blockSize = 64;
  
  // Pre-compute Zipfian probabilities
  const probs: number[] = [];
  let sum = 0;
  for (let i = 1; i <= numItems; i++) {
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
      isWrite: Math.random() > 0.8,
      address: baseAddress + itemIndex * blockSize,
    });
  }
  return entries;
}

// NEW: Scan with reuse - shows benefit of larger associativity
export function generateScanWithReuseTrace(baseAddress: number, arraySize: number, reuseDistance: number, count: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  const blockSize = 64;
  
  for (let i = 0; i < count; i++) {
    const phase = i % (arraySize + reuseDistance);
    let address: number;
    
    if (phase < arraySize) {
      // Forward scan
      address = baseAddress + phase * blockSize;
    } else {
      // Reuse: access recently used data
      const reuseIndex = arraySize - 1 - (phase - arraySize);
      address = baseAddress + Math.max(0, reuseIndex) * blockSize;
    }
    
    entries.push({ isWrite: false, address });
  }
  return entries;
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
