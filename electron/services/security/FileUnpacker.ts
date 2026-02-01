/**
 * File Unpacker Service
 * Detects and unpacks common packers (UPX, ASPack, etc.)
 * for deeper analysis of protected executables
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { join, dirname, basename, extname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { ThreatLevel } from '../../../shared/virushunt-types';

/**
 * Detected packer information
 */
export interface PackerInfo {
  name: string;
  version?: string;
  confidence: number;
  canUnpack: boolean;
}

/**
 * Packer detection result
 */
export interface PackerDetectionResult {
  isPacked: boolean;
  packers: PackerInfo[];
  signatures: {
    name: string;
    offset: number;
    matched: string;
  }[];
  entropy: number;
  entropyAssessment: string;
}

/**
 * Unpack result
 */
export interface UnpackResult {
  success: boolean;
  originalPath: string;
  unpackedPath?: string;
  packerName?: string;
  error?: string;
  sizeRatio?: number;
}

/**
 * Packer signature patterns
 */
interface PackerSignature {
  name: string;
  patterns: {
    offset: number | 'any';
    bytes: Buffer;
  }[];
  version?: string;
  canUnpack: boolean;
  unpackMethod?: 'upx' | 'manual' | 'none';
}

/**
 * Known packer signatures
 */
const PACKER_SIGNATURES: PackerSignature[] = [
  // === UPX ===
  {
    name: 'UPX',
    patterns: [
      { offset: 'any', bytes: Buffer.from('UPX0') },
      { offset: 'any', bytes: Buffer.from('UPX1') },
      { offset: 'any', bytes: Buffer.from('UPX2') },
      { offset: 'any', bytes: Buffer.from('UPX!') }
    ],
    canUnpack: true,
    unpackMethod: 'upx'
  },
  {
    name: 'UPX (modified)',
    patterns: [
      { offset: 'any', bytes: Buffer.from([0x60, 0xBE, 0x00, 0x00, 0x00, 0x00, 0x8D, 0xBE]) },
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === ASPack ===
  {
    name: 'ASPack',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.aspack') },
      { offset: 'any', bytes: Buffer.from('ASPack') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },
  {
    name: 'ASPack 2.x',
    patterns: [
      { offset: 'any', bytes: Buffer.from([0x60, 0xE8, 0x03, 0x00, 0x00, 0x00, 0xE9, 0xEB]) }
    ],
    version: '2.x',
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === PECompact ===
  {
    name: 'PECompact',
    patterns: [
      { offset: 'any', bytes: Buffer.from('PEC2') },
      { offset: 'any', bytes: Buffer.from('PECompact') },
      { offset: 'any', bytes: Buffer.from('pec1') },
      { offset: 'any', bytes: Buffer.from('pec2') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Themida/WinLicense ===
  {
    name: 'Themida',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.themida') },
      { offset: 'any', bytes: Buffer.from('Themida') },
      { offset: 'any', bytes: Buffer.from('.winlice') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === VMProtect ===
  {
    name: 'VMProtect',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.vmp0') },
      { offset: 'any', bytes: Buffer.from('.vmp1') },
      { offset: 'any', bytes: Buffer.from('.vmp2') },
      { offset: 'any', bytes: Buffer.from('VMProtect') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Enigma Protector ===
  {
    name: 'Enigma Protector',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.enigma1') },
      { offset: 'any', bytes: Buffer.from('.enigma2') },
      { offset: 'any', bytes: Buffer.from('ENIGMA') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === MPRESS ===
  {
    name: 'MPRESS',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.MPRESS1') },
      { offset: 'any', bytes: Buffer.from('.MPRESS2') },
      { offset: 'any', bytes: Buffer.from('MPRESS') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === NSPack ===
  {
    name: 'NSPack',
    patterns: [
      { offset: 'any', bytes: Buffer.from('nsp0') },
      { offset: 'any', bytes: Buffer.from('nsp1') },
      { offset: 'any', bytes: Buffer.from('nsp2') },
      { offset: 'any', bytes: Buffer.from('.nsp0') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === PEtite ===
  {
    name: 'PEtite',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.petite') },
      { offset: 'any', bytes: Buffer.from('petite') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Armadillo ===
  {
    name: 'Armadillo',
    patterns: [
      { offset: 'any', bytes: Buffer.from('PADATA') },
      { offset: 'any', bytes: Buffer.from('.arma') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === ExeStealth ===
  {
    name: 'ExeStealth',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.stelth') },
      { offset: 'any', bytes: Buffer.from('ExeStealth') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === FSG (Fast Small Good) ===
  {
    name: 'FSG',
    patterns: [
      { offset: 'any', bytes: Buffer.from([0x87, 0x25, 0x00, 0x00, 0x00, 0x00, 0x61, 0x94]) }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === MEW ===
  {
    name: 'MEW',
    patterns: [
      { offset: 'any', bytes: Buffer.from('MEW') },
      { offset: 'any', bytes: Buffer.from([0xE9, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02]) }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === ConfuserEx (.NET) ===
  {
    name: 'ConfuserEx',
    patterns: [
      { offset: 'any', bytes: Buffer.from('ConfuserEx') },
      { offset: 'any', bytes: Buffer.from('Confuser.Core') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === .NET Reactor ===
  {
    name: '.NET Reactor',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.netreact') },
      { offset: 'any', bytes: Buffer.from('_CorExeMain') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Obsidium ===
  {
    name: 'Obsidium',
    patterns: [
      { offset: 'any', bytes: Buffer.from('Obsidium') },
      { offset: 'any', bytes: Buffer.from('.obsidium') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Smart Assembly (.NET) ===
  {
    name: 'SmartAssembly',
    patterns: [
      { offset: 'any', bytes: Buffer.from('SmartAssembly.Attributes') },
      { offset: 'any', bytes: Buffer.from('PoweredByAttribute') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Dotfuscator (.NET) ===
  {
    name: 'Dotfuscator',
    patterns: [
      { offset: 'any', bytes: Buffer.from('DotfuscatorAttribute') },
      { offset: 'any', bytes: Buffer.from('Dotfuscated') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  },

  // === Packed/Encrypted Generic Indicators ===
  {
    name: 'Generic Packed',
    patterns: [
      { offset: 'any', bytes: Buffer.from('.packed') },
      { offset: 'any', bytes: Buffer.from('.crypted') }
    ],
    canUnpack: false,
    unpackMethod: 'none'
  }
];

/**
 * Section name anomalies that indicate packing
 */
const ANOMALOUS_SECTIONS = [
  '.upx', 'upx0', 'upx1', 'upx2',
  '.aspack', '.adata',
  '.vmp0', '.vmp1', '.vmp2',
  '.themida', '.winlic',
  '.enigma', '.packed',
  '.nsp0', '.nsp1',
  '.mpress', '.text1',
  'petite', 'pec1', 'pec2',
  '.sforce', '.spack',
  '.code', '.code1'
];

/**
 * File Unpacker Service
 */
export class FileUnpacker {
  private upxPath: string | null = null;
  private tempDir: string;

  constructor() {
    this.tempDir = join(tmpdir(), 'virushunt-unpacker');
    this.initializeTempDir();
  }

  /**
   * Initialize temp directory
   */
  private async initializeTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Set UPX executable path
   */
  setUpxPath(path: string): void {
    this.upxPath = path;
  }

  /**
   * Detect packers in a file
   */
  async detectPackers(filePath: string): Promise<PackerDetectionResult> {
    try {
      const buffer = await fs.readFile(filePath);
      return this.analyzeBuffer(buffer);
    } catch (error) {
      console.error('Packer detection error:', error);
      return {
        isPacked: false,
        packers: [],
        signatures: [],
        entropy: 0,
        entropyAssessment: 'Error analyzing file'
      };
    }
  }

  /**
   * Analyze buffer for packer signatures
   */
  analyzeBuffer(buffer: Buffer): PackerDetectionResult {
    const detectedPackers: PackerInfo[] = [];
    const matchedSignatures: PackerDetectionResult['signatures'] = [];
    const seenPackers = new Set<string>();

    // Check PE validity first
    if (!this.isValidPE(buffer)) {
      return {
        isPacked: false,
        packers: [],
        signatures: [],
        entropy: 0,
        entropyAssessment: 'Not a valid PE file'
      };
    }

    // Scan for packer signatures
    for (const packer of PACKER_SIGNATURES) {
      for (const pattern of packer.patterns) {
        const matches = this.findPattern(buffer, pattern.bytes, pattern.offset);
        
        for (const offset of matches) {
          matchedSignatures.push({
            name: packer.name,
            offset,
            matched: pattern.bytes.toString('utf-8').replace(/[^\x20-\x7E]/g, '.')
          });

          if (!seenPackers.has(packer.name)) {
            seenPackers.add(packer.name);
            detectedPackers.push({
              name: packer.name,
              version: packer.version,
              confidence: 90,
              canUnpack: packer.canUnpack
            });
          }
        }
      }
    }

    // Check section names for anomalies
    const sections = this.getPESections(buffer);
    for (const section of sections) {
      const sectionName = section.name.toLowerCase();
      for (const anomaly of ANOMALOUS_SECTIONS) {
        if (sectionName.includes(anomaly) && !seenPackers.has(sectionName)) {
          detectedPackers.push({
            name: `Anomalous section: ${section.name}`,
            confidence: 60,
            canUnpack: false
          });
          break;
        }
      }
    }

    // Calculate entropy
    const entropy = this.calculateEntropy(buffer);
    const entropyAssessment = this.assessEntropy(entropy);

    // High entropy without known packer might indicate unknown packer
    if (entropy > 7.2 && detectedPackers.length === 0) {
      detectedPackers.push({
        name: 'Unknown Packer/Crypter',
        confidence: 70,
        canUnpack: false
      });
    }

    return {
      isPacked: detectedPackers.length > 0 || entropy > 7.0,
      packers: detectedPackers,
      signatures: matchedSignatures,
      entropy,
      entropyAssessment
    };
  }

  /**
   * Check if buffer is valid PE
   */
  private isValidPE(buffer: Buffer): boolean {
    if (buffer.length < 64) return false;
    if (buffer.readUInt16LE(0) !== 0x5A4D) return false; // MZ
    
    const peOffset = buffer.readUInt32LE(60);
    if (peOffset + 4 > buffer.length) return false;
    if (buffer.readUInt32LE(peOffset) !== 0x00004550) return false; // PE\0\0
    
    return true;
  }

  /**
   * Find pattern in buffer
   */
  private findPattern(buffer: Buffer, pattern: Buffer, offset: number | 'any'): number[] {
    const matches: number[] = [];

    if (offset === 'any') {
      let pos = 0;
      while ((pos = buffer.indexOf(pattern, pos)) !== -1) {
        matches.push(pos);
        pos++;
        if (matches.length >= 10) break; // Limit matches
      }
    } else {
      if (offset + pattern.length <= buffer.length) {
        const slice = buffer.slice(offset, offset + pattern.length);
        if (slice.equals(pattern)) {
          matches.push(offset);
        }
      }
    }

    return matches;
  }

  /**
   * Get PE sections
   */
  private getPESections(buffer: Buffer): { name: string; virtualSize: number; rawSize: number; entropy: number }[] {
    const sections: { name: string; virtualSize: number; rawSize: number; entropy: number }[] = [];

    try {
      const peOffset = buffer.readUInt32LE(60);
      const coffHeaderOffset = peOffset + 4;
      const numberOfSections = buffer.readUInt16LE(coffHeaderOffset + 2);
      const sizeOfOptionalHeader = buffer.readUInt16LE(coffHeaderOffset + 16);
      const sectionTableOffset = coffHeaderOffset + 20 + sizeOfOptionalHeader;

      for (let i = 0; i < numberOfSections; i++) {
        const sectionOffset = sectionTableOffset + i * 40;
        if (sectionOffset + 40 > buffer.length) break;

        // Read section name
        let name = '';
        for (let j = 0; j < 8; j++) {
          const char = buffer.readUInt8(sectionOffset + j);
          if (char === 0) break;
          name += String.fromCharCode(char);
        }

        const virtualSize = buffer.readUInt32LE(sectionOffset + 8);
        const rawSize = buffer.readUInt32LE(sectionOffset + 16);
        const rawOffset = buffer.readUInt32LE(sectionOffset + 20);

        // Calculate section entropy
        let sectionEntropy = 0;
        if (rawSize > 0 && rawOffset + rawSize <= buffer.length) {
          const sectionData = buffer.slice(rawOffset, rawOffset + rawSize);
          sectionEntropy = this.calculateEntropy(sectionData);
        }

        sections.push({
          name,
          virtualSize,
          rawSize,
          entropy: sectionEntropy
        });
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return sections;
  }

  /**
   * Calculate Shannon entropy
   */
  private calculateEntropy(buffer: Buffer): number {
    if (buffer.length === 0) return 0;

    const freq = new Array(256).fill(0);
    for (let i = 0; i < buffer.length; i++) {
      freq[buffer[i]]++;
    }

    let entropy = 0;
    const len = buffer.length;
    for (let i = 0; i < 256; i++) {
      if (freq[i] > 0) {
        const p = freq[i] / len;
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  /**
   * Assess entropy level
   */
  private assessEntropy(entropy: number): string {
    if (entropy > 7.5) return 'Very high (likely encrypted/compressed)';
    if (entropy > 7.0) return 'High (likely packed)';
    if (entropy > 6.0) return 'Moderate (possibly packed)';
    if (entropy > 4.0) return 'Normal (typical executable)';
    return 'Low (sparse data)';
  }

  /**
   * Attempt to unpack a file
   */
  async unpack(filePath: string): Promise<UnpackResult> {
    // First detect what packer is used
    const detection = await this.detectPackers(filePath);

    if (!detection.isPacked) {
      return {
        success: false,
        originalPath: filePath,
        error: 'File does not appear to be packed'
      };
    }

    // Find unpackable packer
    const unpackablePacker = detection.packers.find(p => p.canUnpack);
    
    if (!unpackablePacker) {
      return {
        success: false,
        originalPath: filePath,
        packerName: detection.packers[0]?.name,
        error: `Cannot unpack ${detection.packers[0]?.name || 'unknown packer'}`
      };
    }

    // Handle UPX
    if (unpackablePacker.name === 'UPX') {
      return this.unpackUPX(filePath);
    }

    return {
      success: false,
      originalPath: filePath,
      packerName: unpackablePacker.name,
      error: 'Unpacking not implemented for this packer'
    };
  }

  /**
   * Unpack UPX-packed file
   */
  private async unpackUPX(filePath: string): Promise<UnpackResult> {
    // Generate temp output path
    const tempName = `unpacked_${randomBytes(8).toString('hex')}${extname(filePath)}`;
    const outputPath = join(this.tempDir, tempName);

    try {
      // Copy file to temp location first
      await fs.copyFile(filePath, outputPath);

      // Get original file size
      const originalStats = await fs.stat(filePath);

      // Try to unpack using UPX
      await this.runUpx(outputPath);

      // Get unpacked file size
      const unpackedStats = await fs.stat(outputPath);
      const sizeRatio = unpackedStats.size / originalStats.size;

      return {
        success: true,
        originalPath: filePath,
        unpackedPath: outputPath,
        packerName: 'UPX',
        sizeRatio
      };

    } catch (error) {
      // Try to clean up on error
      try {
        await fs.unlink(outputPath);
      } catch { }

      return {
        success: false,
        originalPath: filePath,
        packerName: 'UPX',
        error: error instanceof Error ? error.message : 'UPX unpacking failed'
      };
    }
  }

  /**
   * Run UPX to decompress file
   */
  private runUpx(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use bundled UPX or system UPX
      const upxCommand = this.upxPath || 'upx';

      const child = spawn(upxCommand, ['-d', '-q', filePath], {
        windowsHide: true
      });

      let stderr = '';

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `UPX exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to run UPX: ${error.message}`));
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('UPX timeout'));
      }, 30000);
    });
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(join(this.tempDir, file));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Get severity level for packer detection
   */
  getPackerSeverity(detection: PackerDetectionResult): ThreatLevel {
    if (!detection.isPacked) return ThreatLevel.SAFE;

    // Known commercial protectors are suspicious but not necessarily dangerous
    const dangerousPackers = ['Unknown Packer/Crypter'];
    const suspiciousPackers = ['VMProtect', 'Themida', 'Enigma Protector', 'Obsidium'];

    for (const packer of detection.packers) {
      if (dangerousPackers.includes(packer.name)) {
        return ThreatLevel.DANGEROUS;
      }
      if (suspiciousPackers.includes(packer.name)) {
        return ThreatLevel.SUSPICIOUS;
      }
    }

    // High entropy with common packers
    if (detection.entropy > 7.5) {
      return ThreatLevel.SUSPICIOUS;
    }

    return ThreatLevel.SUSPICIOUS;
  }
}

// Export singleton
export const fileUnpacker = new FileUnpacker();
