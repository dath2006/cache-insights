// Cache Simulation Engine for CacheLab-Pro

export type ReplacementPolicy = 'LRU' | 'FIFO' | 'LFU';
export type WritePolicy = 'write-back' | 'write-through';

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
    
    if (this.config.replacementPolicy === 'LRU') {
      let minTime = Infinity;
      for (let i = 0; i < set.blocks.length; i++) {
        if (set.blocks[i].lastAccessTime < minTime) {
          minTime = set.blocks[i].lastAccessTime;
          victimIndex = i;
        }
      }
    } else if (this.config.replacementPolicy === 'LFU') {
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
    } else {
      // FIFO
      let minInsertTime = Infinity;
      for (let i = 0; i < set.blocks.length; i++) {
        if (set.blocks[i].insertionTime < minInsertTime) {
          minInsertTime = set.blocks[i].insertionTime;
          victimIndex = i;
        }
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

// Multi-Level Cache Simulator (L1 + L2)
export class MultiLevelCacheSimulator {
  private l1: CacheSimulator | null = null;
  private l2: CacheSimulator | null = null;
  private config: MultiLevelCacheConfig;
  private combinedStats: CacheStats;

  constructor(config: MultiLevelCacheConfig) {
    this.config = config;
    
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

  access(address: number, isWrite: boolean): { l1Result?: AccessResult; l2Result?: AccessResult } {
    this.combinedStats.totalAccesses++;
    
    let l1Result: AccessResult | undefined;
    let l2Result: AccessResult | undefined;
    
    // Try L1 first
    if (this.l1) {
      l1Result = this.l1.access(address, isWrite);
      l1Result.level = 'L1';
      
      if (l1Result.hit) {
        this.combinedStats.hits++;
        this.combinedStats.hitRate = this.combinedStats.hits / this.combinedStats.totalAccesses;
        return { l1Result };
      }
    }
    
    // L1 miss or disabled, try L2
    if (this.l2) {
      l2Result = this.l2.access(address, isWrite);
      l2Result.level = 'L2';
      
      if (l2Result.hit) {
        this.combinedStats.hits++;
        this.combinedStats.hitRate = this.combinedStats.hits / this.combinedStats.totalAccesses;
        return { l1Result, l2Result };
      }
    }
    
    // Both missed
    this.combinedStats.misses++;
    this.combinedStats.hitRate = this.combinedStats.hits / this.combinedStats.totalAccesses;
    
    return { l1Result, l2Result };
  }

  getL1(): CacheSimulator | null {
    return this.l1;
  }

  getL2(): CacheSimulator | null {
    return this.l2;
  }

  getL1Stats(): CacheStats | null {
    return this.l1?.getStats() ?? null;
  }

  getL2Stats(): CacheStats | null {
    return this.l2?.getStats() ?? null;
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
    this.combinedStats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAccesses: 0,
      writebacks: 0,
    };
  }

  // Calculate combined AMAT for multi-level cache
  calculateAMAT(
    l1HitTime: number = 1,
    l2HitTime: number = 10,
    memoryPenalty: number = 100
  ): number {
    const l1Stats = this.l1?.getStats();
    const l2Stats = this.l2?.getStats();
    
    if (!this.config.enabled.l1 && !this.config.enabled.l2) {
      return memoryPenalty;
    }
    
    if (!this.config.enabled.l2) {
      // Only L1
      const l1MissRate = l1Stats ? 1 - l1Stats.hitRate : 1;
      return l1HitTime + l1MissRate * memoryPenalty;
    }
    
    if (!this.config.enabled.l1) {
      // Only L2
      const l2MissRate = l2Stats ? 1 - l2Stats.hitRate : 1;
      return l2HitTime + l2MissRate * memoryPenalty;
    }
    
    // Both L1 and L2
    const l1MissRate = l1Stats ? 1 - l1Stats.hitRate : 1;
    const l2MissRate = l2Stats ? 1 - l2Stats.hitRate : 1;
    
    // AMAT = L1 hit time + L1 miss rate * (L2 hit time + L2 miss rate * Memory penalty)
    return l1HitTime + l1MissRate * (l2HitTime + l2MissRate * memoryPenalty);
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
      isWrite: i % 4 === 0, // Mix of reads and writes
      address: startAddress + (i * stride),
    });
  }
  return entries;
}

export function generateRandomTrace(baseAddress: number, range: number, count: number): TraceEntry[] {
  const entries: TraceEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      isWrite: Math.random() > 0.7,
      address: baseAddress + Math.floor(Math.random() * range),
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
  const hotAddresses = Array.from({ length: hotCount }, (_, i) => baseAddress + i * 4);
  const coldAddresses = Array.from({ length: coldCount }, (_, i) => baseAddress + 0x10000 + i * 4);
  
  for (let iter = 0; iter < iterations; iter++) {
    // Access hot addresses multiple times
    for (let rep = 0; rep < 5; rep++) {
      for (const addr of hotAddresses) {
        entries.push({ isWrite: false, address: addr });
      }
    }
    // Occasionally access cold addresses
    for (const addr of coldAddresses) {
      entries.push({ isWrite: false, address: addr });
    }
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
  replacementPolicies: ReplacementPolicy[] = ['LRU', 'LFU', 'FIFO']
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
  replacementPolicies: ReplacementPolicy[] = ['LRU', 'LFU', 'FIFO']
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
