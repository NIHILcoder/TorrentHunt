/**
 * Advanced String Signature Analyzer
 * Deep string analysis for malware detection:
 * - URLs, IPs, domains
 * - Cryptocurrency addresses
 * - Shell commands
 * - Suspicious paths
 * - Encoded/obfuscated strings
 * - Credential patterns
 */

import { ThreatLevel } from '../../../shared/virushunt-types';

/**
 * String finding with context
 */
export interface StringFinding {
  category: StringCategory;
  value: string;
  offset: number;
  severity: ThreatLevel;
  description: string;
  context?: string;
}

/**
 * String categories
 */
export enum StringCategory {
  URL = 'url',
  IP_ADDRESS = 'ip_address',
  DOMAIN = 'domain',
  EMAIL = 'email',
  FILE_PATH = 'file_path',
  REGISTRY_KEY = 'registry_key',
  CRYPTO_WALLET = 'crypto_wallet',
  SHELL_COMMAND = 'shell_command',
  CREDENTIAL = 'credential',
  BASE64 = 'base64',
  ENCODED = 'encoded',
  C2_INDICATOR = 'c2_indicator',
  MINING_POOL = 'mining_pool',
  SUSPICIOUS_STRING = 'suspicious_string',
  PII = 'pii'
}

/**
 * String analysis result
 */
export interface StringAnalysisResult {
  totalStrings: number;
  findings: StringFinding[];
  summary: {
    [key in StringCategory]?: number;
  };
  riskScore: number;
  riskAssessment: string;
  highlights: string[];
}

/**
 * Pattern definitions for string matching
 */
interface StringPattern {
  category: StringCategory;
  pattern: RegExp;
  severity: ThreatLevel;
  description: string;
  validator?: (match: string) => boolean;
}

/**
 * Comprehensive string patterns
 */
const STRING_PATTERNS: StringPattern[] = [
  // === URLs ===
  {
    category: StringCategory.URL,
    pattern: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'HTTP/HTTPS URL found',
    validator: (url) => {
      // Filter out common legitimate domains
      const legitimate = ['microsoft.com', 'windows.com', 'google.com', 'github.com', 'mozilla.org'];
      return !legitimate.some(d => url.toLowerCase().includes(d));
    }
  },
  {
    category: StringCategory.URL,
    pattern: /ftp:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'FTP URL found'
  },

  // === IP Addresses ===
  {
    category: StringCategory.IP_ADDRESS,
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'IPv4 address found',
    validator: (ip) => {
      // Filter localhost and private ranges
      if (ip.startsWith('127.') || ip.startsWith('0.') || ip.startsWith('255.')) return false;
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) return false;
      return true;
    }
  },
  {
    category: StringCategory.IP_ADDRESS,
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'IP:Port combination found'
  },

  // === Domains (suspicious TLDs) ===
  {
    category: StringCategory.DOMAIN,
    pattern: /\b[\w-]+\.(?:onion|bit|i2p)\b/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Dark web domain found'
  },
  {
    category: StringCategory.DOMAIN,
    pattern: /\b[\w-]+\.(?:tk|ml|ga|cf|gq)\b/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Free TLD domain found'
  },
  {
    category: StringCategory.DOMAIN,
    pattern: /\b(?:dyn|no-ip|ddns|hopto|zapto|sytes|serveftp|servegame)\.[\w.]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Dynamic DNS domain found'
  },

  // === Cryptocurrency Addresses ===
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'Bitcoin address (Legacy) found',
    validator: (addr) => addr.length >= 26 && addr.length <= 35
  },
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\bbc1[a-zA-HJ-NP-Z0-9]{39,59}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'Bitcoin address (Bech32) found'
  },
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\b0x[a-fA-F0-9]{40}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'Ethereum address found'
  },
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'Monero address found'
  },
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\bL[a-km-zA-HJ-NP-Z1-9]{26,33}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'Litecoin address found'
  },
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\bD{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}\b/g,
    severity: ThreatLevel.DANGEROUS,
    description: 'Dogecoin address found'
  },
  {
    category: StringCategory.CRYPTO_WALLET,
    pattern: /\br[0-9a-zA-Z]{24,34}\b/g,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Ripple address found'
  },

  // === Shell Commands ===
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /cmd(?:\.exe)?(?:\s+\/[cCkK])?\s+["']?(?:del|rd|rmdir|format|taskkill|shutdown|net\s+(?:user|stop|start)|reg\s+(?:add|delete)|sc\s+(?:create|delete|stop|start)|schtasks|wmic|powershell)[^"'\n]*/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Windows shell command found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /powershell(?:\.exe)?\s+(?:-[eEnNcCoOdDeEmMaA]+\s+)?(?:-[wW]\s+[hH]idden\s+)?(?:-[eExX]\s+)?[^\n]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'PowerShell command found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /(?:bash|sh|zsh)\s+-c\s+["'][^"']+["']/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Unix shell command found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /\bwscript(?:\.exe)?\s+[^\n]+\.(?:vbs|js|jse|wsf)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'WScript execution found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /\bcscript(?:\.exe)?\s+[^\n]+\.(?:vbs|js|jse|wsf)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'CScript execution found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /\bmshta(?:\.exe)?\s+[^\n]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'MSHTA execution found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /\bregsvr32(?:\.exe)?\s+(?:\/[sSnN]\s+)?[^\n]+/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Regsvr32 execution found'
  },
  {
    category: StringCategory.SHELL_COMMAND,
    pattern: /\brundll32(?:\.exe)?\s+[^\n]+/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Rundll32 execution found'
  },

  // === Registry Keys ===
  {
    category: StringCategory.REGISTRY_KEY,
    pattern: /HKEY_(?:LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS)\\[^\s<>"]+/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Registry key path found'
  },
  {
    category: StringCategory.REGISTRY_KEY,
    pattern: /Software\\Microsoft\\Windows\\CurrentVersion\\(?:Run|RunOnce|RunServices)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Autorun registry key found'
  },
  {
    category: StringCategory.REGISTRY_KEY,
    pattern: /Software\\Microsoft\\Windows NT\\CurrentVersion\\(?:Winlogon|Image File Execution)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Critical registry key found'
  },

  // === Suspicious File Paths ===
  {
    category: StringCategory.FILE_PATH,
    pattern: /[A-Z]:\\(?:Windows|WINDOWS)\\(?:System32|SysWOW64|Temp)\\[^\s<>"]+\.(?:exe|dll|bat|cmd|ps1|vbs)/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'System directory executable path'
  },
  {
    category: StringCategory.FILE_PATH,
    pattern: /[A-Z]:\\Users\\[^\\]+\\AppData\\(?:Local|Roaming)\\[^\s<>"]+\.(?:exe|dll)/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'AppData executable path'
  },
  {
    category: StringCategory.FILE_PATH,
    pattern: /%(?:TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE)%\\[^\s<>"]+\.(?:exe|dll|bat|ps1)/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Environment variable path to executable'
  },

  // === Credential/Sensitive Paths ===
  {
    category: StringCategory.CREDENTIAL,
    pattern: /\\Login Data\\?|\\Cookies\\?|\\Web Data\\?/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Browser credential path found'
  },
  {
    category: StringCategory.CREDENTIAL,
    pattern: /Chrome\\User Data|Firefox\\Profiles|\.mozilla\\firefox/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Browser profile path found'
  },
  {
    category: StringCategory.CREDENTIAL,
    pattern: /wallet\.dat|electrum|exodus|atomic|metamask/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Crypto wallet reference found'
  },
  {
    category: StringCategory.CREDENTIAL,
    pattern: /password(?:s)?\.(?:txt|csv|xlsx?|docx?)|credentials?\./gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Password file reference found'
  },

  // === Email Addresses ===
  {
    category: StringCategory.EMAIL,
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Email address found',
    validator: (email) => {
      // Filter common internal/test emails
      const skip = ['@example.', '@localhost', '@test.', '@domain.'];
      return !skip.some(s => email.toLowerCase().includes(s));
    }
  },

  // === Mining Pool Indicators ===
  {
    category: StringCategory.MINING_POOL,
    pattern: /stratum\+(?:tcp|ssl):\/\/[^\s]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Mining stratum protocol found'
  },
  {
    category: StringCategory.MINING_POOL,
    pattern: /(?:nicehash|minergate|nanopool|f2pool|ethermine|2miners|hiveon|slushpool|antpool)\.(?:com|org|net)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Known mining pool domain found'
  },
  {
    category: StringCategory.MINING_POOL,
    pattern: /xmr-?pool|moneropool|cryptonight|hashrate/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Mining-related keyword found'
  },

  // === C2/Exfil Indicators ===
  {
    category: StringCategory.C2_INDICATOR,
    pattern: /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Discord webhook found'
  },
  {
    category: StringCategory.C2_INDICATOR,
    pattern: /api\.telegram\.org\/bot[\w:]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Telegram bot API found'
  },
  {
    category: StringCategory.C2_INDICATOR,
    pattern: /pastebin\.com\/raw\/[\w]+/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Pastebin raw URL found'
  },
  {
    category: StringCategory.C2_INDICATOR,
    pattern: /hastebin\.com\/raw\/[\w]+/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Hastebin URL found'
  },

  // === Base64 Encoded Strings ===
  {
    category: StringCategory.BASE64,
    pattern: /(?:[A-Za-z0-9+\/]{4}){10,}(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?/g,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Possible Base64 encoded data',
    validator: (b64) => {
      if (b64.length < 44) return false;
      // Check if it decodes to something interesting
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        // Check if decoded has printable characters
        const printable = decoded.replace(/[^\x20-\x7E]/g, '').length;
        return printable / decoded.length > 0.6;
      } catch {
        return false;
      }
    }
  },

  // === Hex Encoded Strings ===
  {
    category: StringCategory.ENCODED,
    pattern: /(?:0x)?(?:[0-9a-fA-F]{2}){16,}/g,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Long hex string found',
    validator: (hex) => hex.length >= 64
  },

  // === Suspicious Keywords ===
  {
    category: StringCategory.SUSPICIOUS_STRING,
    pattern: /(?:keylogger|screen\s*grab|webcam\s*capture|remote\s*desktop|reverse\s*shell|backdoor)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Suspicious keyword found'
  },
  {
    category: StringCategory.SUSPICIOUS_STRING,
    pattern: /(?:inject(?:or|ion)?|shellcode|exploit|payload|dropper|crypter)/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Malware-related keyword found'
  },
  {
    category: StringCategory.SUSPICIOUS_STRING,
    pattern: /(?:anti[-_]?vm|anti[-_]?debug|sandbox[-_]?detect|vmware|virtualbox|qemu)/gi,
    severity: ThreatLevel.SUSPICIOUS,
    description: 'Anti-analysis keyword found'
  },
  {
    category: StringCategory.SUSPICIOUS_STRING,
    pattern: /(?:disable[-_]?(?:av|antivirus|defender|firewall))/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Security bypass keyword found'
  },

  // === Personal Identifiable Info Patterns ===
  {
    category: StringCategory.PII,
    pattern: /\b(?:SSN|Social Security)[\s:]+\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'SSN pattern found'
  },
  {
    category: StringCategory.PII,
    pattern: /\b(?:credit\s*card|card\s*number)[\s:]+\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi,
    severity: ThreatLevel.DANGEROUS,
    description: 'Credit card pattern found'
  }
];

/**
 * String Signature Analyzer
 */
export class StringSignatureAnalyzer {
  private readonly MIN_STRING_LENGTH = 4;
  private readonly MAX_STRINGS = 50000;
  private readonly MAX_FINDINGS = 500;

  /**
   * Analyze file for suspicious strings
   */
  async analyzeFile(filePath: string): Promise<StringAnalysisResult> {
    const { promises: fs } = await import('fs');
    const buffer = await fs.readFile(filePath);
    return this.analyzeBuffer(buffer);
  }

  /**
   * Analyze buffer for suspicious strings
   */
  analyzeBuffer(buffer: Buffer): StringAnalysisResult {
    const content = this.extractStrings(buffer);
    return this.analyzeStrings(content, buffer);
  }

  /**
   * Extract printable strings from buffer
   */
  private extractStrings(buffer: Buffer): string {
    // Extract ASCII strings
    const asciiStrings: string[] = [];
    let currentString = '';
    
    for (let i = 0; i < buffer.length && asciiStrings.length < this.MAX_STRINGS; i++) {
      const byte = buffer[i];
      
      if (byte >= 0x20 && byte < 0x7F) {
        currentString += String.fromCharCode(byte);
      } else {
        if (currentString.length >= this.MIN_STRING_LENGTH) {
          asciiStrings.push(currentString);
        }
        currentString = '';
      }
    }
    
    if (currentString.length >= this.MIN_STRING_LENGTH) {
      asciiStrings.push(currentString);
    }

    // Extract Unicode (UTF-16LE) strings
    const unicodeStrings: string[] = [];
    currentString = '';
    
    for (let i = 0; i < buffer.length - 1 && unicodeStrings.length < this.MAX_STRINGS; i += 2) {
      const code = buffer.readUInt16LE(i);
      
      if (code >= 0x20 && code < 0x7F) {
        currentString += String.fromCharCode(code);
      } else {
        if (currentString.length >= this.MIN_STRING_LENGTH) {
          unicodeStrings.push(currentString);
        }
        currentString = '';
      }
    }
    
    if (currentString.length >= this.MIN_STRING_LENGTH) {
      unicodeStrings.push(currentString);
    }

    // Combine and return as single content for pattern matching
    return [...asciiStrings, ...unicodeStrings].join('\n');
  }

  /**
   * Analyze extracted strings
   */
  private analyzeStrings(content: string, buffer: Buffer): StringAnalysisResult {
    const findings: StringFinding[] = [];
    const summary: { [key in StringCategory]?: number } = {};
    const highlights: string[] = [];
    const seenValues = new Set<string>();

    // Apply all patterns
    for (const pattern of STRING_PATTERNS) {
      if (findings.length >= this.MAX_FINDINGS) break;

      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        if (findings.length >= this.MAX_FINDINGS) break;

        const value = match[0];
        
        // Skip duplicates
        if (seenValues.has(value)) continue;
        
        // Apply validator if exists
        if (pattern.validator && !pattern.validator(value)) continue;
        
        seenValues.add(value);

        // Find offset in original buffer
        const offset = buffer.indexOf(value);

        findings.push({
          category: pattern.category,
          value: value.length > 200 ? value.substring(0, 200) + '...' : value,
          offset,
          severity: pattern.severity,
          description: pattern.description,
          context: this.getContext(content, match.index, 50)
        });

        // Update summary
        summary[pattern.category] = (summary[pattern.category] || 0) + 1;

        // Add to highlights for important findings
        if (pattern.severity === ThreatLevel.DANGEROUS || pattern.severity === ThreatLevel.CRITICAL) {
          if (highlights.length < 10) {
            highlights.push(`${pattern.description}: ${value.substring(0, 60)}${value.length > 60 ? '...' : ''}`);
          }
        }
      }
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(findings);
    const riskAssessment = this.generateAssessment(findings, riskScore);

    return {
      totalStrings: content.split('\n').length,
      findings,
      summary,
      riskScore,
      riskAssessment,
      highlights
    };
  }

  /**
   * Get context around a match
   */
  private getContext(content: string, index: number, size: number): string {
    const start = Math.max(0, index - size);
    const end = Math.min(content.length, index + size);
    return content.substring(start, end).replace(/[\n\r]/g, ' ');
  }

  /**
   * Calculate risk score from findings
   */
  private calculateRiskScore(findings: StringFinding[]): number {
    let score = 0;

    for (const finding of findings) {
      switch (finding.severity) {
        case ThreatLevel.CRITICAL: score += 20; break;
        case ThreatLevel.DANGEROUS: score += 10; break;
        case ThreatLevel.SUSPICIOUS: score += 3; break;
      }
    }

    // Bonus for dangerous combinations
    const categories = new Set(findings.map(f => f.category));
    
    // Crypto wallet + network = likely stealer
    if (categories.has(StringCategory.CRYPTO_WALLET) && 
        (categories.has(StringCategory.URL) || categories.has(StringCategory.C2_INDICATOR))) {
      score += 25;
    }

    // Credential paths + network = likely stealer
    if (categories.has(StringCategory.CREDENTIAL) && 
        (categories.has(StringCategory.URL) || categories.has(StringCategory.C2_INDICATOR))) {
      score += 25;
    }

    // Mining pool + shell commands = cryptojacker
    if (categories.has(StringCategory.MINING_POOL) && categories.has(StringCategory.SHELL_COMMAND)) {
      score += 30;
    }

    return Math.min(100, score);
  }

  /**
   * Generate risk assessment
   */
  private generateAssessment(findings: StringFinding[], riskScore: number): string {
    if (riskScore >= 80) {
      return 'CRITICAL: Multiple high-severity indicators found. Strong evidence of malicious intent.';
    }
    if (riskScore >= 60) {
      return 'DANGEROUS: Significant suspicious patterns detected. File likely malicious.';
    }
    if (riskScore >= 40) {
      return 'SUSPICIOUS: Several concerning strings found. Manual review recommended.';
    }
    if (riskScore >= 20) {
      return 'LOW RISK: Some suspicious strings present. Verify file source.';
    }
    return 'CLEAN: No significant suspicious strings detected.';
  }

  /**
   * Analyze specific string patterns
   */
  analyzeSpecificPatterns(buffer: Buffer, categories: StringCategory[]): StringFinding[] {
    const content = this.extractStrings(buffer);
    const findings: StringFinding[] = [];
    const seenValues = new Set<string>();

    const relevantPatterns = STRING_PATTERNS.filter(p => categories.includes(p.category));

    for (const pattern of relevantPatterns) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        const value = match[0];
        if (seenValues.has(value)) continue;
        if (pattern.validator && !pattern.validator(value)) continue;
        
        seenValues.add(value);
        findings.push({
          category: pattern.category,
          value,
          offset: buffer.indexOf(value),
          severity: pattern.severity,
          description: pattern.description
        });
      }
    }

    return findings;
  }

  /**
   * Quick check for specific dangerous patterns
   */
  hasDANGEROUSPatterns(buffer: Buffer): boolean {
    const content = this.extractStrings(buffer);
    
    const dangerousPatterns = STRING_PATTERNS.filter(p => 
      p.severity === ThreatLevel.DANGEROUS || p.severity === ThreatLevel.CRITICAL
    );

    for (const pattern of dangerousPatterns) {
      if (pattern.pattern.test(content)) {
        return true;
      }
    }

    return false;
  }
}

// Export singleton
export const stringSignatureAnalyzer = new StringSignatureAnalyzer();
