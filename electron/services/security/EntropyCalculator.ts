import { promises as fs } from 'fs';
import { EntropyAnalysis } from '../../../shared/virushunt-types';

/**
 * Entropy calculator for detecting packed/encrypted files
 * Uses Shannon entropy formula
 */
export class EntropyCalculator {
  // Entropy threshold for packed files
  private readonly PACKED_THRESHOLD = 7.0;
  private readonly SUSPICIOUS_THRESHOLD = 6.5;

  /**
   * Calculate Shannon entropy of data
   * @param data Buffer to analyze
   * @returns Entropy value (0-8)
   */
  calculateEntropy(data: Buffer): number {
    if (data.length === 0) return 0;

    // Count byte frequencies
    const frequencies = new Map<number, number>();
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
    }

    // Calculate entropy
    let entropy = 0;
    const length = data.length;

    for (const count of frequencies.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Analyze file entropy
   * @param filePath Path to file
   * @returns Entropy analysis result
   */
  async analyzeFile(filePath: string): Promise<EntropyAnalysis> {
    try {
      const buffer = await fs.readFile(filePath);
      const fileEntropy = this.calculateEntropy(buffer);
      const isPacked = fileEntropy >= this.PACKED_THRESHOLD;

      return {
        fileEntropy,
        isPacked,
        sections: []
      };

    } catch (error) {
      console.error('Entropy analysis error:', error);
      return {
        fileEntropy: 0,
        isPacked: false
      };
    }
  }

  /**
   * Analyze entropy of PE sections
   * @param buffer File buffer
   * @param sections PE sections info
   * @returns Entropy analysis with section details
   */
  async analyzePESections(
    buffer: Buffer,
    sections: Array<{
      name: string;
      virtualAddress?: number;
      virtualSize: number;
      pointerToRawData?: number;
      rawSize: number;
    }>
  ): Promise<EntropyAnalysis> {
    const fileEntropy = this.calculateEntropy(buffer);
    const sectionEntropies: Array<{
      name: string;
      entropy: number;
      suspicious: boolean;
    }> = [];

    for (const section of sections) {
      try {
        const offset = section.pointerToRawData || 0;
        const size = Math.min(section.rawSize, buffer.length - offset);

        if (size > 0 && offset + size <= buffer.length) {
          const sectionData = buffer.slice(offset, offset + size);
          const entropy = this.calculateEntropy(sectionData);

          sectionEntropies.push({
            name: section.name,
            entropy,
            suspicious: entropy >= this.SUSPICIOUS_THRESHOLD
          });
        }
      } catch (error) {
        console.error(`Error analyzing section ${section.name}:`, error);
      }
    }

    // Check if any section has high entropy
    const hasHighEntropySections = sectionEntropies.some(s => s.entropy >= this.PACKED_THRESHOLD);

    return {
      fileEntropy,
      isPacked: fileEntropy >= this.PACKED_THRESHOLD || hasHighEntropySections,
      sections: sectionEntropies
    };
  }

  /**
   * Analyze entropy of specific data chunk
   * @param buffer File buffer
   * @param offset Start offset
   * @param size Chunk size
   * @returns Entropy value
   */
  analyzeChunk(buffer: Buffer, offset: number, size: number): number {
    if (offset + size > buffer.length) {
      size = buffer.length - offset;
    }

    if (size <= 0) return 0;

    const chunk = buffer.slice(offset, offset + size);
    return this.calculateEntropy(chunk);
  }

  /**
   * Check if entropy indicates packing/encryption
   * @param entropy Entropy value
   * @returns True if suspicious
   */
  isSuspiciousEntropy(entropy: number): boolean {
    return entropy >= this.SUSPICIOUS_THRESHOLD;
  }

  /**
   * Check if entropy indicates strong packing
   * @param entropy Entropy value
   * @returns True if packed
   */
  isPacked(entropy: number): boolean {
    return entropy >= this.PACKED_THRESHOLD;
  }

  /**
   * Calculate entropy variance across file
   * High variance may indicate selective packing
   * @param filePath Path to file
   * @param chunkSize Size of chunks to analyze
   * @returns Variance value
   */
  async calculateEntropyVariance(filePath: string, chunkSize: number = 4096): Promise<number> {
    try {
      const buffer = await fs.readFile(filePath);
      const entropies: number[] = [];

      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const size = Math.min(chunkSize, buffer.length - offset);
        const entropy = this.analyzeChunk(buffer, offset, size);
        entropies.push(entropy);
      }

      if (entropies.length === 0) return 0;

      // Calculate mean
      const mean = entropies.reduce((sum, e) => sum + e, 0) / entropies.length;

      // Calculate variance
      const variance = entropies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / entropies.length;

      return variance;

    } catch (error) {
      console.error('Entropy variance calculation error:', error);
      return 0;
    }
  }

  /**
   * Get entropy assessment
   * @param entropy Entropy value
   * @returns Human-readable assessment
   */
  getEntropyAssessment(entropy: number): string {
    if (entropy >= 7.8) {
      return 'Very high entropy - likely encrypted or compressed';
    } else if (entropy >= 7.0) {
      return 'High entropy - possibly packed';
    } else if (entropy >= 6.5) {
      return 'Moderately high entropy - suspicious';
    } else if (entropy >= 5.0) {
      return 'Normal entropy for executable';
    } else {
      return 'Low entropy - typical for data/text';
    }
  }
}

// Export singleton
export const entropyCalculator = new EntropyCalculator();
