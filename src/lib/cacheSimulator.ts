// Cache Simulation Engine for CacheLab-Pro

export type ReplacementPolicy = 'LRU' | 'FIFO';
export type WritePolicy = 'write-back' | 'write-through';

export interface CacheBlock {
  valid: boolean;
  dirty: boolean;
  tag: number;
  lastAccessTime: number;
  insertionTime: number;
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
      }
    }
  }

  // Calculate Average Memory Access Time (AMAT)
  calculateAMAT(hitTime: number = 1, missPenalty: number = 100): number {
    const missRate = 1 - this.stats.hitRate;
    return hitTime + (missRate * missPenalty);
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
