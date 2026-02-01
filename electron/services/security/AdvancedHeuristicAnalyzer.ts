import { promises as fs } from 'fs';
import { extname, basename, dirname } from 'path';
import {
  HeuristicMatch,
  ThreatLevel,
  FileCategory,
  AdvancedHeuristicResult,
  StringAnalysis
} from '../../../shared/virushunt-types';
import { peAnalyzer } from './PEAnalyzer';
import { entropyCalculator } from './EntropyCalculator';
import { signatureVerifier } from './SignatureVerifier';
import { yaraEngine, YaraMatch } from './YaraEngine';
import { importTableAnalyzer, ImportAnalysisResult, ApiBehavior } from './ImportTableAnalyzer';
import { fileUnpacker, PackerDetectionResult } from './FileUnpacker';
import { stringSignatureAnalyzer, StringAnalysisResult, StringCategory } from './StringSignatureAnalyzer';

/**
 * Deep analysis result combining all modules
 */
export interface DeepAnalysisResult extends AdvancedHeuristicResult {
  yaraMatches: YaraMatch[];
  importAnalysis: ImportAnalysisResult | null;
  packerDetection: PackerDetectionResult | null;
  stringSignatures: StringAnalysisResult | null;
  deepRiskScore: number;
  deepAssessment: string;
}

/**
 * Advanced Heuristic Analyzer with smart crack/keygen detection
 */
export class HeuristicAnalyzer {
  private readonly MAX_READ_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_STRING_ANALYSIS = 5 * 1024 * 1024; // 5MB for string analysis

  // Crack/Keygen indicators (NOT malicious)
  private readonly CRACK_KEYWORDS = [
    'crack', 'keygen', 'patch', 'activator', 'loader', 'unlocker',
    'serial', 'license', 'activation', 'registration', 'trial', 'bypass'
  ];

  // Known legitimate crack release groups
  private readonly KNOWN_CRACK_GROUPS = [
    'CORE', 'DVT', 'EMBRACE', 'BEAN', 'BRD', 'DI', 'SSG', 'ROGUE',
    'CRD', 'ViRiLiTY', 'PANTHEON', 'AMPED', 'CYGiSO', 'RedT'
  ];

  // Mining pool domains
  private readonly MINING_POOLS = [
    'nicehash.com', 'minergate.com', 'pool.ntp.org', 'xmr-pool.net',
    'moneropool.com', 'miningpoolhub.com', 'ethermine.org', 'f2pool.com',
    'btc.com', 'slushpool.com', 'antpool.com'
  ];

  // C&C / suspicious domains patterns
  private readonly C2_PATTERNS = [
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/, // IP:Port
    /\.onion/, // Tor
    /\.tk$/, /\.ml$/, /\.ga$/, /\.cf$/, // Free TLDs
    /dyndns\./i, /no-ip\./i, /ddns\./i // Dynamic DNS
  ];

  /**
   * Perform advanced heuristic analysis
   * @param filePath File to analyze
   * @param signal Abort signal
   * @returns Advanced analysis result
   */
  async analyzeAdvanced(filePath: string, signal?: AbortSignal): Promise<AdvancedHeuristicResult> {
    const fileName = basename(filePath);
    const ext = extname(filePath).toLowerCase();
    const matches: HeuristicMatch[] = [];
    const reasons: string[] = [];

    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      const buffer = stats.size <= this.MAX_READ_SIZE 
        ? await fs.readFile(filePath)
        : await this.readPartial(filePath, this.MAX_READ_SIZE);

      if (signal?.aborted) throw new Error('Analysis cancelled');

      // Perform PE analysis for executables
      let peAnalysis;
      let entropyAnalysis;
      let signatureVerification;
      let stringAnalysis;

      if (['.exe', '.dll', '.scr', '.com'].includes(ext)) {
        // PE analysis
        peAnalysis = await peAnalyzer.analyzePE(filePath);
        
        if (peAnalysis.isValidPE) {
          // Entropy analysis with PE sections
          if (peAnalysis.sections) {
            entropyAnalysis = await entropyCalculator.analyzePESections(buffer, peAnalysis.sections as any);
          } else {
            entropyAnalysis = await entropyCalculator.analyzeFile(filePath);
          }

          // Signature verification
          signatureVerification = await signatureVerifier.verifySignature(filePath);
        } else {
          entropyAnalysis = await entropyCalculator.analyzeFile(filePath);
        }

        // String analysis
        stringAnalysis = await this.analyzeStrings(buffer);
      } else {
        // For non-PE files, do basic analysis
        entropyAnalysis = await entropyCalculator.analyzeFile(filePath);
        stringAnalysis = await this.analyzeStrings(buffer);
      }

      if (signal?.aborted) throw new Error('Analysis cancelled');

      // Run heuristic rules
      await this.runHeuristicRules(
        filePath,
        fileName,
        ext,
        buffer,
        peAnalysis,
        entropyAnalysis,
        signatureVerification,
        stringAnalysis,
        matches
      );

      // Determine file category and risk score
      const categorization = this.categorizeFile(
        fileName,
        filePath,
        matches,
        peAnalysis,
        entropyAnalysis,
        signatureVerification,
        stringAnalysis
      );

      // Build result
      const result: AdvancedHeuristicResult = {
        category: categorization.category,
        riskScore: categorization.riskScore,
        assessment: categorization.assessment,
        matches,
        reasons: categorization.reasons,
        isLegitCrack: categorization.isLegitCrack,
        releaseGroup: categorization.releaseGroup,
        peAnalysis,
        entropyAnalysis,
        signatureVerification,
        stringAnalysis
      };

      return result;

    } catch (error) {
      if (signal?.aborted) throw error;

      console.error('Advanced heuristic analysis error:', error);
      
      return {
        category: FileCategory.UNKNOWN,
        riskScore: 0,
        assessment: 'Analysis failed',
        matches: [],
        reasons: ['Analysis error: ' + (error instanceof Error ? error.message : 'Unknown error')],
        isLegitCrack: false
      };
    }
  }

  /**
   * Run all heuristic rules
   */
  private async runHeuristicRules(
    filePath: string,
    fileName: string,
    ext: string,
    buffer: Buffer,
    peAnalysis: any,
    entropyAnalysis: any,
    signatureVerification: any,
    stringAnalysis: StringAnalysis,
    matches: HeuristicMatch[]
  ): Promise<void> {
    // Rule: High entropy (packed/encrypted)
    if (entropyAnalysis && entropyAnalysis.isPacked) {
      matches.push({
        ruleId: 'ADV001',
        ruleName: 'High Entropy',
        description: 'File has high entropy indicating packing or encryption',
        severity: ThreatLevel.SUSPICIOUS,
        confidence: 70,
        evidence: [
          `File entropy: ${entropyAnalysis.fileEntropy.toFixed(2)}`,
          entropyCalculator.getEntropyAssessment(entropyAnalysis.fileEntropy)
        ]
      });
    }

    // Rule: Unsigned executable
    if (peAnalysis?.isValidPE && signatureVerification && !signatureVerification.isSigned) {
      matches.push({
        ruleId: 'ADV002',
        ruleName: 'Unsigned Executable',
        description: 'PE executable lacks digital signature',
        severity: ThreatLevel.SUSPICIOUS,
        confidence: 50,
        evidence: ['No digital signature present']
      });
    }

    // Rule: Invalid signature
    if (signatureVerification?.isSigned && !signatureVerification.isValid) {
      matches.push({
        ruleId: 'ADV003',
        ruleName: 'Invalid Signature',
        description: 'Digital signature is present but invalid',
        severity: ThreatLevel.DANGEROUS,
        confidence: 85,
        evidence: [signatureVerification.error || 'Signature verification failed']
      });
    }

    // Rule: Suspicious WinAPI imports
    if (peAnalysis?.suspiciousImports && peAnalysis.suspiciousImports.length > 0) {
      const severity = this.assessImportSeverity(peAnalysis.suspiciousImports);
      
      matches.push({
        ruleId: 'ADV004',
        ruleName: 'Suspicious WinAPI Imports',
        description: 'Executable imports suspicious Windows API functions',
        severity,
        confidence: 75,
        evidence: peAnalysis.suspiciousImports.slice(0, 10)
      });
    }

    // Rule: Mining pool connections
    if (stringAnalysis.miningPools.length > 0) {
      matches.push({
        ruleId: 'ADV005',
        ruleName: 'Mining Pool References',
        description: 'File contains cryptocurrency mining pool domains',
        severity: ThreatLevel.DANGEROUS,
        confidence: 90,
        evidence: stringAnalysis.miningPools
      });
    }

    // Rule: C&C indicators
    if (stringAnalysis.c2Indicators.length > 0) {
      matches.push({
        ruleId: 'ADV006',
        ruleName: 'C&C Server Indicators',
        description: 'Potential command and control server references found',
        severity: ThreatLevel.DANGEROUS,
        confidence: 80,
        evidence: stringAnalysis.c2Indicators
      });
    }

    // Rule: Double extension
    if (this.hasDoubleExtension(fileName)) {
      matches.push({
        ruleId: 'ADV007',
        ruleName: 'Double Extension',
        description: 'File uses double extension to disguise true type',
        severity: ThreatLevel.SUSPICIOUS,
        confidence: 70,
        matchedPattern: fileName
      });
    }

    // Rule: Mismatched PE architecture
    if (peAnalysis?.isValidPE && ext === '.dll') {
      if (peAnalysis.entryPoint === 0) {
        matches.push({
          ruleId: 'ADV008',
          ruleName: 'Unusual DLL Entry Point',
          description: 'DLL has unusual entry point configuration',
          severity: ThreatLevel.SUSPICIOUS,
          confidence: 60
        });
      }
    }

    // Rule: Writable and executable sections
    if (peAnalysis?.sections) {
      const dangerousSections = peAnalysis.sections.filter((s: any) => s.isExecutable && s.isWritable);
      
      if (dangerousSections.length > 0) {
        matches.push({
          ruleId: 'ADV009',
          ruleName: 'Writable Executable Sections',
          description: 'PE file has sections that are both writable and executable',
          severity: ThreatLevel.SUSPICIOUS,
          confidence: 65,
          evidence: dangerousSections.map((s: any) => s.name)
        });
      }
    }

    // Rule: Suspicious registry keys
    if (stringAnalysis.registryKeys.length > 3) {
      matches.push({
        ruleId: 'ADV010',
        ruleName: 'Extensive Registry Access',
        description: 'File references many registry keys',
        severity: ThreatLevel.SUSPICIOUS,
        confidence: 55,
        evidence: stringAnalysis.registryKeys.slice(0, 5)
      });
    }
  }

  /**
   * Categorize file with smart crack/keygen detection
   */
  private categorizeFile(
    fileName: string,
    filePath: string,
    matches: HeuristicMatch[],
    peAnalysis: any,
    entropyAnalysis: any,
    signatureVerification: any,
    stringAnalysis: StringAnalysis
  ): {
    category: FileCategory;
    riskScore: number;
    assessment: string;
    reasons: string[];
    isLegitCrack: boolean;
    releaseGroup?: string;
  } {
    const fileNameLower = fileName.toLowerCase();
    const pathLower = filePath.toLowerCase();
    const reasons: string[] = [];
    let riskScore = 0;

    // Check for crack/keygen indicators
    const hasCrackKeywords = this.CRACK_KEYWORDS.some(kw => fileNameLower.includes(kw));
    const releaseGroup = this.detectReleaseGroup(fileName, filePath);

    // Check for mining or C&C (immediate danger)
    if (stringAnalysis.miningPools.length > 0) {
      reasons.push('Contains cryptocurrency mining pool references');
      riskScore += 50;
    }

    if (stringAnalysis.c2Indicators.length > 0) {
      reasons.push('Contains potential C&C server indicators');
      riskScore += 40;
    }

    // Check for malicious imports
    const hasDangerousImports = peAnalysis?.suspiciousImports?.some((imp: string) =>
      imp.includes('CreateRemoteThread') ||
      imp.includes('WriteProcessMemory') ||
      imp.includes('GetAsyncKeyState')
    );

    if (hasDangerousImports) {
      reasons.push('Uses potentially malicious WinAPI functions');
      riskScore += 30;
    }

    // Determine if it's a legitimate crack/keygen
    let isLegitCrack = false;

    if (hasCrackKeywords) {
      // Check legitimacy indicators
      const hasKnownGroup = releaseGroup !== undefined;
      const hasReasonableSize = peAnalysis?.isValidPE && 
        (stringAnalysis.suspiciousStrings.length < 10);
      const noMining = stringAnalysis.miningPools.length === 0;
      const noC2 = stringAnalysis.c2Indicators.length === 0;

      if (hasKnownGroup && noMining && noC2) {
        isLegitCrack = true;
        reasons.push(`Appears to be legitimate crack/keygen from ${releaseGroup}`);
        riskScore = Math.max(riskScore, 30); // Cap risk for legitimate cracks
      } else if (hasCrackKeywords && noMining && noC2) {
        reasons.push('File appears to be crack/keygen');
        riskScore += 20;
      }
    }

    // Check signature
    if (signatureVerification?.isSigned) {
      if (signatureVerification.isValid) {
        reasons.push(`Signed by: ${signatureVerification.signer}`);
        riskScore = Math.max(0, riskScore - 30);
        
        if (signatureVerifier.isTrustedSigner(signatureVerification.signer || '')) {
          reasons.push('Trusted publisher');
          riskScore = 0;
        }
      } else {
        reasons.push('Invalid digital signature');
        riskScore += 35;
      }
    } else if (peAnalysis?.isValidPE && !hasCrackKeywords) {
      reasons.push('No digital signature');
      riskScore += 15;
    }

    // Check entropy
    if (entropyAnalysis?.isPacked) {
      reasons.push('High entropy - possibly packed or encrypted');
      riskScore += 15;
    }

    // Determine category
    let category: FileCategory;
    let assessment: string;

    if (riskScore >= 80) {
      category = FileCategory.DANGEROUS;
      assessment = 'Dangerous - High probability of malware';
    } else if (riskScore >= 60) {
      category = FileCategory.SUSPICIOUS;
      assessment = 'Suspicious - Further investigation recommended';
    } else if (isLegitCrack) {
      category = FileCategory.CRACK;
      assessment = 'Legitimate crack/keygen - Use at your own risk';
    } else if (hasCrackKeywords) {
      category = FileCategory.KEYGEN;
      assessment = 'Appears to be crack/keygen - Verify source';
    } else if (riskScore > 0) {
      category = FileCategory.SUSPICIOUS;
      assessment = 'Some suspicious indicators found';
    } else {
      category = FileCategory.SAFE;
      assessment = 'No significant threats detected';
    }

    // Add match-based reasons
    for (const match of matches) {
      if (match.severity === ThreatLevel.DANGEROUS || match.severity === ThreatLevel.CRITICAL) {
        if (!reasons.includes(match.description)) {
          reasons.push(match.description);
        }
      }
    }

    return {
      category,
      riskScore: Math.min(100, Math.max(0, riskScore)),
      assessment,
      reasons,
      isLegitCrack,
      releaseGroup
    };
  }

  /**
   * Analyze strings in binary
   */
  private async analyzeStrings(buffer: Buffer): Promise<StringAnalysis> {
    const analysis: StringAnalysis = {
      suspiciousUrls: [],
      miningPools: [],
      c2Indicators: [],
      ipAddresses: [],
      suspiciousStrings: [],
      registryKeys: []
    };

    try {
      // Limit size for string analysis
      const dataSize = Math.min(buffer.length, this.MAX_STRING_ANALYSIS);
      const content = buffer.toString('utf8', 0, dataSize);

      // Extract URLs
      const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
      const urls = content.match(urlPattern) || [];

      for (const url of urls) {
        const urlLower = url.toLowerCase();
        
        // Check mining pools
        if (this.MINING_POOLS.some(pool => urlLower.includes(pool))) {
          analysis.miningPools.push(url);
        }
        
        // Check C&C patterns
        if (this.C2_PATTERNS.some(pattern => pattern.test(url))) {
          analysis.c2Indicators.push(url);
        }
        
        // Add to suspicious URLs
        analysis.suspiciousUrls.push(url);
      }

      // Extract IP addresses
      const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      analysis.ipAddresses = [...new Set(content.match(ipPattern) || [])];

      // Extract registry keys
      const regPattern = /HKEY_[A-Z_]+\\[^\s"'<>]+/gi;
      analysis.registryKeys = [...new Set(content.match(regPattern) || [])];

      // Look for suspicious strings
      const suspiciousPatterns = [
        /taskkill/gi,
        /powershell.*-enc/gi,
        /cmd\.exe.*\/c/gi,
        /wscript\.exe/gi,
        /certutil.*-decode/gi,
        /invoke-expression/gi
      ];

      for (const pattern of suspiciousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          analysis.suspiciousStrings.push(...matches);
        }
      }

    } catch (error) {
      console.error('String analysis error:', error);
    }

    // Deduplicate
    analysis.suspiciousUrls = [...new Set(analysis.suspiciousUrls)];
    analysis.miningPools = [...new Set(analysis.miningPools)];
    analysis.c2Indicators = [...new Set(analysis.c2Indicators)];
    analysis.suspiciousStrings = [...new Set(analysis.suspiciousStrings)];

    return analysis;
  }

  /**
   * Detect release group from filename or path
   */
  private detectReleaseGroup(fileName: string, filePath: string): string | undefined {
    const combinedText = `${fileName} ${filePath}`.toLowerCase();

    for (const group of this.KNOWN_CRACK_GROUPS) {
      if (combinedText.includes(group.toLowerCase())) {
        return group;
      }
    }

    // Check for pattern like [GROUP] or -GROUP
    const groupPattern = /[\[\-]([A-Z]{2,10})[\]\-]/;
    const match = fileName.match(groupPattern);
    
    if (match) {
      return match[1];
    }

    return undefined;
  }

  /**
   * Check for double extension
   */
  private hasDoubleExtension(fileName: string): boolean {
    const parts = fileName.split('.');
    
    if (parts.length < 3) return false;

    const lastExt = parts[parts.length - 1].toLowerCase();
    const secondLastExt = parts[parts.length - 2].toLowerCase();

    const commonExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'png', 'mp3', 'mp4'];
    const executableExts = ['exe', 'scr', 'bat', 'cmd', 'com', 'pif'];

    return commonExts.includes(secondLastExt) && executableExts.includes(lastExt);
  }

  /**
   * Assess severity of suspicious imports
   */
  private assessImportSeverity(imports: string[]): ThreatLevel {
    const criticalImports = ['CreateRemoteThread', 'WriteProcessMemory', 'NtCreateThreadEx'];
    const dangerousImports = ['GetAsyncKeyState', 'SetWindowsHookEx', 'RegisterHotKey'];

    const hasCritical = imports.some(imp => 
      criticalImports.some(crit => imp.includes(crit))
    );

    const hasDangerous = imports.some(imp =>
      dangerousImports.some(dang => imp.includes(dang))
    );

    if (hasCritical) return ThreatLevel.DANGEROUS;
    if (hasDangerous) return ThreatLevel.SUSPICIOUS;
    return ThreatLevel.SUSPICIOUS;
  }

  /**
   * Read partial file content
   */
  private async readPartial(filePath: string, maxSize: number): Promise<Buffer> {
    const fileHandle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(maxSize);
    
    try {
      const { bytesRead } = await fileHandle.read(buffer, 0, maxSize, 0);
      return buffer.slice(0, bytesRead);
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * Legacy method for compatibility
   */
  async analyzeFile(filePath: string, signal?: AbortSignal): Promise<HeuristicMatch[]> {
    const result = await this.analyzeAdvanced(filePath, signal);
    return result.matches;
  }

  /**
   * Get overall threat level from advanced result
   */
  getOverallThreatLevel(matches: HeuristicMatch[] | AdvancedHeuristicResult): ThreatLevel {
    if (Array.isArray(matches)) {
      // Calculate risk score from matches
      if (matches.length === 0) return ThreatLevel.SAFE;
      
      const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0);
      const avgConfidence = totalConfidence / matches.length;
      const maxSeverity = Math.max(...matches.map(m => this.severityToNumber(m.severity)));
      
      const riskScore = (avgConfidence + maxSeverity * 20) / 2;
      
      if (riskScore >= 80) return ThreatLevel.CRITICAL;
      if (riskScore >= 60) return ThreatLevel.DANGEROUS;
      if (riskScore >= 30) return ThreatLevel.SUSPICIOUS;
      return ThreatLevel.SAFE;
    } else {
      // AdvancedHeuristicResult
      const result = matches;
      if (result.riskScore >= 80) return ThreatLevel.CRITICAL;
      if (result.riskScore >= 60) return ThreatLevel.DANGEROUS;
      if (result.riskScore >= 30) return ThreatLevel.SUSPICIOUS;
      return ThreatLevel.SAFE;
    }
  }

  /**
   * Get confidence score from matches
   */
  getConfidenceScore(matches: HeuristicMatch[]): number {
    if (matches.length === 0) return 0;
    const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0);
    return Math.min(100, totalConfidence / matches.length);
  }

  /**
   * Convert severity to number for calculations
   */
  private severityToNumber(severity: ThreatLevel): number {
    switch (severity) {
      case ThreatLevel.CRITICAL: return 4;
      case ThreatLevel.DANGEROUS: return 3;
      case ThreatLevel.SUSPICIOUS: return 2;
      case ThreatLevel.SAFE: return 0;
      default: return 1;
    }
  }

  /**
   * Perform deep analysis using all available modules
   * Combines YARA, Import Table, Packer Detection, and String Signatures
   */
  async analyzeDeep(filePath: string, signal?: AbortSignal): Promise<DeepAnalysisResult> {
    // First run standard advanced analysis
    const baseResult = await this.analyzeAdvanced(filePath, signal);
    
    if (signal?.aborted) {
      throw new Error('Analysis cancelled');
    }

    const ext = extname(filePath).toLowerCase();
    const isPE = ['.exe', '.dll', '.scr', '.com', '.sys'].includes(ext);

    let yaraMatches: YaraMatch[] = [];
    let importAnalysis: ImportAnalysisResult | null = null;
    let packerDetection: PackerDetectionResult | null = null;
    let stringSignatures: StringAnalysisResult | null = null;

    try {
      // Read file once for all analyses
      // For large files (>100MB), read only first 100MB
      // Most malware signatures are located at the beginning of the file
      const stats = await fs.stat(filePath);
      const MAX_ANALYSIS_SIZE = 100 * 1024 * 1024; // 100MB
      const readSize = Math.min(stats.size, MAX_ANALYSIS_SIZE);
      
      let buffer: Buffer;
      
      if (stats.size > MAX_ANALYSIS_SIZE) {
        // Read only first 100MB for large files to prevent memory issues
        const fileHandle = await fs.open(filePath, 'r');
        buffer = Buffer.allocUnsafe(readSize);
        await fileHandle.read(buffer, 0, readSize, 0);
        await fileHandle.close();
      } else {
        // Use setImmediate to yield to event loop periodically
        buffer = await new Promise<Buffer>((resolve, reject) => {
          setImmediate(async () => {
            try {
              const buf = await fs.readFile(filePath);
              resolve(buf);
            } catch (err) {
              reject(err);
            }
          });
        });
      }

      if (signal?.aborted) throw new Error('Analysis cancelled');

      // Run analyses sequentially with breaks to prevent UI freeze
      // YARA scan
      yaraMatches = await new Promise<YaraMatch[]>((resolve, reject) => {
        setImmediate(async () => {
          try {
            const result = await yaraEngine.scanBuffer(buffer, signal);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      });

      if (signal?.aborted) throw new Error('Analysis cancelled');

      // String signature analysis
      stringSignatures = await new Promise<StringAnalysisResult>((resolve, reject) => {
        setImmediate(async () => {
          try {
            const result = await stringSignatureAnalyzer.analyzeBuffer(buffer);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      });

      if (signal?.aborted) throw new Error('Analysis cancelled');

      // PE-specific analyses
      if (isPE) {
        importAnalysis = await new Promise<ImportAnalysisResult>((resolve, reject) => {
          setImmediate(async () => {
            try {
              const result = await importTableAnalyzer.analyzeBuffer(buffer);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });

        if (signal?.aborted) throw new Error('Analysis cancelled');

        packerDetection = await new Promise<PackerDetectionResult>((resolve, reject) => {
          setImmediate(async () => {
            try {
              const result = await fileUnpacker.analyzeBuffer(buffer);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      }

    } catch (error) {
      if (signal?.aborted) throw error;
      console.error('Deep analysis error:', error);
    }

    // Add YARA matches to heuristic matches
    for (const yara of yaraMatches) {
      baseResult.matches.push({
        ruleId: `YARA_${yara.rule}`,
        ruleName: yara.rule,
        description: yara.description,
        severity: yara.severity,
        confidence: yara.confidence,
        evidence: yara.matchedStrings.map(s => `${s.id}: ${s.data}`)
      });
    }

    // Add import analysis findings
    if (importAnalysis) {
      for (const behavior of importAnalysis.detectedBehaviors) {
        baseResult.matches.push({
          ruleId: `IMP_${behavior.behavior}`,
          ruleName: `Import Pattern: ${behavior.behavior}`,
          description: behavior.description,
          severity: behavior.severity,
          confidence: behavior.confidence,
          evidence: behavior.apis
        });
      }
    }

    // Add packer findings
    if (packerDetection?.isPacked) {
      const severity = fileUnpacker.getPackerSeverity(packerDetection);
      for (const packer of packerDetection.packers) {
        baseResult.matches.push({
          ruleId: `PACK_${packer.name.replace(/\s+/g, '_')}`,
          ruleName: `Packer Detected: ${packer.name}`,
          description: `File is packed with ${packer.name}`,
          severity,
          confidence: packer.confidence,
          evidence: packerDetection.signatures.map(s => s.matched)
        });
      }
    }

    // Add critical string findings
    if (stringSignatures) {
      const criticalCategories = [
        StringCategory.CRYPTO_WALLET,
        StringCategory.C2_INDICATOR,
        StringCategory.MINING_POOL,
        StringCategory.SHELL_COMMAND,
        StringCategory.CREDENTIAL
      ];

      for (const finding of stringSignatures.findings) {
        if (criticalCategories.includes(finding.category)) {
          baseResult.matches.push({
            ruleId: `STR_${finding.category}`,
            ruleName: `String: ${finding.category}`,
            description: finding.description,
            severity: finding.severity,
            confidence: 80,
            evidence: [finding.value]
          });
        }
      }
    }

    // Calculate deep risk score
    const deepRiskScore = this.calculateDeepRiskScore(
      baseResult,
      yaraMatches,
      importAnalysis,
      packerDetection,
      stringSignatures
    );

    // Generate deep assessment
    const deepAssessment = this.generateDeepAssessment(
      deepRiskScore,
      yaraMatches,
      importAnalysis,
      packerDetection,
      stringSignatures
    );

    // Update base result with new risk
    baseResult.riskScore = Math.max(baseResult.riskScore, deepRiskScore);

    // Get file stats to add note about partial analysis
    const stats = await fs.stat(filePath);
    const MAX_ANALYSIS_SIZE = 100 * 1024 * 1024; // 100MB
    
    const result: any = {
      ...baseResult,
      yaraMatches,
      importAnalysis,
      packerDetection,
      stringSignatures,
      deepRiskScore,
      deepAssessment
    };
    
    // Add note for large files
    if (stats.size > MAX_ANALYSIS_SIZE) {
      result.analysisNote = `⚠️ Large file (${(stats.size / 1024 / 1024).toFixed(1)}MB): analyzed first 100MB only. Most malware signatures are located at file beginning.`;
    }

    return result;
  }

  /**
   * Calculate comprehensive deep risk score
   */
  private calculateDeepRiskScore(
    baseResult: AdvancedHeuristicResult,
    yaraMatches: YaraMatch[],
    importAnalysis: ImportAnalysisResult | null,
    packerDetection: PackerDetectionResult | null,
    stringSignatures: StringAnalysisResult | null
  ): number {
    let score = baseResult.riskScore;

    // Add YARA score (weighted heavily)
    for (const yara of yaraMatches) {
      switch (yara.severity) {
        case ThreatLevel.CRITICAL: score += 30; break;
        case ThreatLevel.DANGEROUS: score += 20; break;
        case ThreatLevel.SUSPICIOUS: score += 10; break;
      }
    }

    // Add import analysis score
    if (importAnalysis) {
      score += Math.min(30, importAnalysis.riskScore * 0.3);
    }

    // Add packer score
    if (packerDetection?.isPacked) {
      // Unknown packers are more suspicious
      if (packerDetection.packers.some(p => p.name.includes('Unknown'))) {
        score += 20;
      } else {
        score += 10;
      }
    }

    // Add string signature score
    if (stringSignatures) {
      score += Math.min(25, stringSignatures.riskScore * 0.25);
    }

    // Dangerous combinations bonus
    const hasYaraCritical = yaraMatches.some(y => y.severity === ThreatLevel.CRITICAL);
    const hasInjectionPattern = importAnalysis?.detectedBehaviors.some(
      b => b.behavior === ApiBehavior.PROCESS_INJECTION || b.behavior === ApiBehavior.PROCESS_HOLLOWING
    );
    const hasC2 = stringSignatures?.summary[StringCategory.C2_INDICATOR];

    if (hasYaraCritical && hasInjectionPattern) score += 20;
    if (hasC2 && hasInjectionPattern) score += 15;
    if (hasYaraCritical && hasC2) score += 15;

    return Math.min(100, score);
  }

  /**
   * Generate comprehensive assessment
   */
  private generateDeepAssessment(
    riskScore: number,
    yaraMatches: YaraMatch[],
    importAnalysis: ImportAnalysisResult | null,
    packerDetection: PackerDetectionResult | null,
    stringSignatures: StringAnalysisResult | null
  ): string {
    const findings: string[] = [];

    // YARA findings
    if (yaraMatches.length > 0) {
      const critical = yaraMatches.filter(y => y.severity === ThreatLevel.CRITICAL);
      if (critical.length > 0) {
        findings.push(`YARA: ${critical.map(y => y.rule).join(', ')}`);
      }
    }

    // Import findings
    if (importAnalysis && importAnalysis.detectedBehaviors.length > 0) {
      const behaviors = importAnalysis.detectedBehaviors.map(b => b.behavior);
      findings.push(`API Patterns: ${behaviors.slice(0, 3).join(', ')}`);
    }

    // Packer findings
    if (packerDetection?.isPacked) {
      findings.push(`Packed: ${packerDetection.packers.map(p => p.name).join(', ')}`);
    }

    // String findings
    if (stringSignatures && stringSignatures.highlights.length > 0) {
      findings.push(`Strings: ${stringSignatures.highlights.length} suspicious patterns`);
    }

    if (riskScore >= 90) {
      return `CRITICAL THREAT: Multiple high-confidence indicators. ${findings.join(' | ')}`;
    }
    if (riskScore >= 75) {
      return `HIGH RISK: Strong malware indicators. ${findings.join(' | ')}`;
    }
    if (riskScore >= 50) {
      return `MEDIUM RISK: Significant suspicious patterns. ${findings.join(' | ')}`;
    }
    if (riskScore >= 25) {
      return `LOW RISK: Some concerning indicators. ${findings.join(' | ')}`;
    }
    return 'CLEAN: No significant threats detected by deep analysis.';
  }
}

// Export singleton
export const heuristicAnalyzer = new HeuristicAnalyzer();
