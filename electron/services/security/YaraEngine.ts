/**
 * YARA Rules Engine
 * Native JavaScript implementation of YARA-like pattern matching
 * for malware detection without external dependencies
 */

import { promises as fs } from 'fs';
import { ThreatLevel } from '../../../shared/virushunt-types';

/**
 * YARA rule condition operators
 */
type ConditionOperator = 'and' | 'or' | 'not' | 'any' | 'all' | 'count' | 'at' | 'in';

/**
 * A single YARA string pattern
 */
interface YaraString {
  id: string;
  type: 'text' | 'hex' | 'regex';
  value: string | Buffer | RegExp;
  modifiers: {
    nocase?: boolean;
    wide?: boolean;
    ascii?: boolean;
    fullword?: boolean;
  };
}

/**
 * YARA rule definition
 */
export interface YaraRule {
  name: string;
  meta: {
    description?: string;
    author?: string;
    severity?: ThreatLevel;
    reference?: string;
    category?: string;
    confidence?: number;
    [key: string]: any;
  };
  strings: YaraString[];
  condition: string;
  tags?: string[];
}

/**
 * YARA match result
 */
export interface YaraMatch {
  rule: string;
  description: string;
  severity: ThreatLevel;
  confidence: number;
  category: string;
  matchedStrings: {
    id: string;
    offset: number;
    length: number;
    data: string;
  }[];
  tags: string[];
}

/**
 * Built-in YARA rules for malware detection
 */
const BUILTIN_RULES: YaraRule[] = [
  // === RANSOMWARE DETECTION ===
  {
    name: 'Ransomware_Generic',
    meta: {
      description: 'Generic ransomware indicators',
      severity: ThreatLevel.CRITICAL,
      category: 'ransomware',
      confidence: 85
    },
    strings: [
      { id: '$ransom1', type: 'text', value: 'Your files have been encrypted', modifiers: { nocase: true } },
      { id: '$ransom2', type: 'text', value: 'send bitcoin', modifiers: { nocase: true } },
      { id: '$ransom3', type: 'text', value: 'decrypt your files', modifiers: { nocase: true } },
      { id: '$ransom4', type: 'text', value: 'pay ransom', modifiers: { nocase: true } },
      { id: '$ransom5', type: 'text', value: '.onion', modifiers: { nocase: true } },
      { id: '$ransom6', type: 'text', value: 'bitcoin wallet', modifiers: { nocase: true } },
      { id: '$ransom7', type: 'text', value: 'encrypted successfully', modifiers: { nocase: true } },
      { id: '$ransom8', type: 'text', value: 'cryptolocker', modifiers: { nocase: true } },
      { id: '$ransom9', type: 'text', value: 'wannacry', modifiers: { nocase: true } },
      { id: '$ransom10', type: 'regex', value: /Your personal (ID|key|code):/i, modifiers: {} }
    ],
    condition: 'any of ($ransom*)',
    tags: ['ransomware', 'crypto']
  },

  // === TROJAN/RAT DETECTION ===
  {
    name: 'RAT_Generic',
    meta: {
      description: 'Remote Access Trojan indicators',
      severity: ThreatLevel.CRITICAL,
      category: 'trojan',
      confidence: 80
    },
    strings: [
      { id: '$rat1', type: 'text', value: 'keylogger', modifiers: { nocase: true } },
      { id: '$rat2', type: 'text', value: 'screenshot', modifiers: { nocase: true } },
      { id: '$rat3', type: 'text', value: 'webcam', modifiers: { nocase: true } },
      { id: '$rat4', type: 'text', value: 'reverse shell', modifiers: { nocase: true } },
      { id: '$rat5', type: 'text', value: 'backdoor', modifiers: { nocase: true } },
      { id: '$rat6', type: 'text', value: 'remote desktop', modifiers: { nocase: true } },
      { id: '$rat7', type: 'text', value: 'njrat', modifiers: { nocase: true } },
      { id: '$rat8', type: 'text', value: 'darkcomet', modifiers: { nocase: true } },
      { id: '$rat9', type: 'text', value: 'poison ivy', modifiers: { nocase: true } },
      { id: '$rat10', type: 'text', value: 'async rat', modifiers: { nocase: true } }
    ],
    condition: '2 of ($rat*)',
    tags: ['rat', 'trojan', 'remote-access']
  },

  // === CRYPTOMINER DETECTION ===
  {
    name: 'Cryptominer_Generic',
    meta: {
      description: 'Cryptocurrency miner indicators',
      severity: ThreatLevel.DANGEROUS,
      category: 'miner',
      confidence: 90
    },
    strings: [
      { id: '$mine1', type: 'text', value: 'stratum+tcp://', modifiers: { nocase: true } },
      { id: '$mine2', type: 'text', value: 'stratum+ssl://', modifiers: { nocase: true } },
      { id: '$mine3', type: 'text', value: 'xmrig', modifiers: { nocase: true } },
      { id: '$mine4', type: 'text', value: 'cryptonight', modifiers: { nocase: true } },
      { id: '$mine5', type: 'text', value: 'monero', modifiers: { nocase: true } },
      { id: '$mine6', type: 'text', value: 'hashrate', modifiers: { nocase: true } },
      { id: '$mine7', type: 'text', value: 'pool.minergate', modifiers: { nocase: true } },
      { id: '$mine8', type: 'text', value: 'coinhive', modifiers: { nocase: true } },
      { id: '$mine9', type: 'regex', value: /\-\-donate\-level/i, modifiers: {} },
      { id: '$mine10', type: 'regex', value: /wallet.*[0-9a-zA-Z]{95}/i, modifiers: {} }
    ],
    condition: 'any of ($mine*)',
    tags: ['miner', 'cryptominer']
  },

  // === PASSWORD STEALER ===
  {
    name: 'Stealer_Credentials',
    meta: {
      description: 'Password and credential stealer',
      severity: ThreatLevel.CRITICAL,
      category: 'stealer',
      confidence: 85
    },
    strings: [
      { id: '$steal1', type: 'text', value: 'Login Data', modifiers: {} },
      { id: '$steal2', type: 'text', value: 'Web Data', modifiers: {} },
      { id: '$steal3', type: 'text', value: 'Cookies', modifiers: {} },
      { id: '$steal4', type: 'text', value: 'Chrome\\User Data', modifiers: {} },
      { id: '$steal5', type: 'text', value: 'Firefox\\Profiles', modifiers: {} },
      { id: '$steal6', type: 'text', value: 'passwords.txt', modifiers: { nocase: true } },
      { id: '$steal7', type: 'text', value: 'wallet.dat', modifiers: { nocase: true } },
      { id: '$steal8', type: 'text', value: 'electrum', modifiers: { nocase: true } },
      { id: '$steal9', type: 'text', value: 'exodus', modifiers: { nocase: true } },
      { id: '$steal10', type: 'regex', value: /discord.*token/i, modifiers: {} },
      { id: '$steal11', type: 'text', value: 'telegram', modifiers: { nocase: true } },
      { id: '$steal12', type: 'text', value: 'steam\\config', modifiers: { nocase: true } }
    ],
    condition: '3 of ($steal*)',
    tags: ['stealer', 'password', 'credentials']
  },

  // === SHELLCODE / INJECTOR ===
  {
    name: 'Shellcode_Injector',
    meta: {
      description: 'Shellcode injection patterns',
      severity: ThreatLevel.CRITICAL,
      category: 'injector',
      confidence: 90
    },
    strings: [
      // Common shellcode prologs
      { id: '$shell1', type: 'hex', value: Buffer.from('fce8', 'hex'), modifiers: {} }, // CLD; CALL
      { id: '$shell2', type: 'hex', value: Buffer.from('eb0e5b', 'hex'), modifiers: {} }, // JMP; POP EBX
      { id: '$shell3', type: 'hex', value: Buffer.from('6a60', 'hex'), modifiers: {} }, // PUSH 60h
      { id: '$shell4', type: 'hex', value: Buffer.from('558bec', 'hex'), modifiers: {} }, // PUSH EBP; MOV EBP,ESP
      { id: '$shell5', type: 'hex', value: Buffer.from('4831c0', 'hex'), modifiers: {} }, // XOR RAX,RAX (x64)
      { id: '$shell6', type: 'hex', value: Buffer.from('31c050', 'hex'), modifiers: {} }, // XOR EAX,EAX; PUSH EAX
      { id: '$shell7', type: 'hex', value: Buffer.from('9090909090', 'hex'), modifiers: {} }, // NOP sled
      // Metasploit patterns
      { id: '$msf1', type: 'text', value: 'meterpreter', modifiers: { nocase: true } },
      { id: '$msf2', type: 'text', value: 'msf', modifiers: {} },
      { id: '$msf3', type: 'text', value: 'payload', modifiers: {} }
    ],
    condition: '2 of ($shell*) or any of ($msf*)',
    tags: ['shellcode', 'injector', 'exploit']
  },

  // === PERSISTENCE MECHANISMS ===
  {
    name: 'Persistence_Registry',
    meta: {
      description: 'Registry-based persistence',
      severity: ThreatLevel.SUSPICIOUS,
      category: 'persistence',
      confidence: 70
    },
    strings: [
      { id: '$reg1', type: 'text', value: 'CurrentVersion\\Run', modifiers: { nocase: true } },
      { id: '$reg2', type: 'text', value: 'CurrentVersion\\RunOnce', modifiers: { nocase: true } },
      { id: '$reg3', type: 'text', value: 'CurrentVersion\\RunServices', modifiers: { nocase: true } },
      { id: '$reg4', type: 'text', value: 'Winlogon\\Shell', modifiers: { nocase: true } },
      { id: '$reg5', type: 'text', value: 'Winlogon\\Userinit', modifiers: { nocase: true } },
      { id: '$reg6', type: 'text', value: 'CurrentVersion\\Explorer\\Shell Folders', modifiers: { nocase: true } },
      { id: '$reg7', type: 'text', value: 'Policies\\Explorer\\Run', modifiers: { nocase: true } },
      { id: '$reg8', type: 'text', value: 'Active Setup\\Installed Components', modifiers: { nocase: true } }
    ],
    condition: 'any of ($reg*)',
    tags: ['persistence', 'registry']
  },

  // === ANTI-ANALYSIS ===
  {
    name: 'AntiAnalysis_Detection',
    meta: {
      description: 'Anti-debugging and anti-VM techniques',
      severity: ThreatLevel.SUSPICIOUS,
      category: 'evasion',
      confidence: 75
    },
    strings: [
      { id: '$anti1', type: 'text', value: 'IsDebuggerPresent', modifiers: {} },
      { id: '$anti2', type: 'text', value: 'CheckRemoteDebuggerPresent', modifiers: {} },
      { id: '$anti3', type: 'text', value: 'NtQueryInformationProcess', modifiers: {} },
      { id: '$anti4', type: 'text', value: 'VMware', modifiers: { nocase: true } },
      { id: '$anti5', type: 'text', value: 'VirtualBox', modifiers: { nocase: true } },
      { id: '$anti6', type: 'text', value: 'QEMU', modifiers: { nocase: true } },
      { id: '$anti7', type: 'text', value: 'Sandboxie', modifiers: { nocase: true } },
      { id: '$anti8', type: 'text', value: 'wine_get_unix_file_name', modifiers: {} },
      { id: '$anti9', type: 'text', value: 'SbieDll.dll', modifiers: { nocase: true } },
      { id: '$anti10', type: 'regex', value: /\\\\\.\\\\(SICE|NTICE|SOFTICE)/i, modifiers: {} }
    ],
    condition: '3 of ($anti*)',
    tags: ['evasion', 'anti-analysis', 'anti-debug', 'anti-vm']
  },

  // === PACKED/OBFUSCATED ===
  {
    name: 'Packer_Generic',
    meta: {
      description: 'Common packer signatures',
      severity: ThreatLevel.SUSPICIOUS,
      category: 'packer',
      confidence: 65
    },
    strings: [
      { id: '$pack1', type: 'text', value: 'UPX0', modifiers: {} },
      { id: '$pack2', type: 'text', value: 'UPX1', modifiers: {} },
      { id: '$pack3', type: 'text', value: 'UPX2', modifiers: {} },
      { id: '$pack4', type: 'text', value: '.aspack', modifiers: {} },
      { id: '$pack5', type: 'text', value: 'ASPack', modifiers: {} },
      { id: '$pack6', type: 'text', value: 'PECompact', modifiers: {} },
      { id: '$pack7', type: 'text', value: '.themida', modifiers: {} },
      { id: '$pack8', type: 'text', value: 'Themida', modifiers: {} },
      { id: '$pack9', type: 'text', value: 'VMProtect', modifiers: {} },
      { id: '$pack10', type: 'text', value: '.vmp0', modifiers: {} },
      { id: '$pack11', type: 'text', value: '.vmp1', modifiers: {} },
      { id: '$pack12', type: 'text', value: 'Enigma', modifiers: {} },
      { id: '$pack13', type: 'text', value: 'ConfuserEx', modifiers: { nocase: true } },
      { id: '$pack14', type: 'text', value: '.netshrink', modifiers: {} }
    ],
    condition: 'any of ($pack*)',
    tags: ['packer', 'obfuscation']
  },

  // === DOWNLOADER/DROPPER ===
  {
    name: 'Downloader_Generic',
    meta: {
      description: 'Malware downloader indicators',
      severity: ThreatLevel.DANGEROUS,
      category: 'downloader',
      confidence: 75
    },
    strings: [
      { id: '$dl1', type: 'text', value: 'URLDownloadToFile', modifiers: {} },
      { id: '$dl2', type: 'text', value: 'UrlDownloadToFileA', modifiers: {} },
      { id: '$dl3', type: 'text', value: 'UrlDownloadToFileW', modifiers: {} },
      { id: '$dl4', type: 'text', value: 'WinHttpOpen', modifiers: {} },
      { id: '$dl5', type: 'text', value: 'InternetOpenUrl', modifiers: {} },
      { id: '$dl6', type: 'text', value: 'powershell', modifiers: { nocase: true } },
      { id: '$dl7', type: 'text', value: 'downloadstring', modifiers: { nocase: true } },
      { id: '$dl8', type: 'text', value: 'downloadfile', modifiers: { nocase: true } },
      { id: '$dl9', type: 'text', value: 'wget', modifiers: { nocase: true } },
      { id: '$dl10', type: 'text', value: 'curl', modifiers: { nocase: true } },
      { id: '$exec1', type: 'text', value: 'cmd.exe /c', modifiers: { nocase: true } },
      { id: '$exec2', type: 'text', value: 'ShellExecute', modifiers: {} },
      { id: '$exec3', type: 'text', value: 'WScript.Shell', modifiers: { nocase: true } }
    ],
    condition: '2 of ($dl*) or any of ($exec*)',
    tags: ['downloader', 'dropper']
  },

  // === PRIVILEGE ESCALATION ===
  {
    name: 'PrivEsc_Indicators',
    meta: {
      description: 'Privilege escalation attempts',
      severity: ThreatLevel.DANGEROUS,
      category: 'privesc',
      confidence: 80
    },
    strings: [
      { id: '$priv1', type: 'text', value: 'SeDebugPrivilege', modifiers: {} },
      { id: '$priv2', type: 'text', value: 'SeTcbPrivilege', modifiers: {} },
      { id: '$priv3', type: 'text', value: 'SeBackupPrivilege', modifiers: {} },
      { id: '$priv4', type: 'text', value: 'AdjustTokenPrivileges', modifiers: {} },
      { id: '$priv5', type: 'text', value: 'OpenProcessToken', modifiers: {} },
      { id: '$priv6', type: 'text', value: 'ImpersonateLoggedOnUser', modifiers: {} },
      { id: '$priv7', type: 'text', value: 'runas', modifiers: { nocase: true } },
      { id: '$priv8', type: 'regex', value: /net\s+user\s+/i, modifiers: {} },
      { id: '$priv9', type: 'regex', value: /net\s+localgroup\s+administrators/i, modifiers: {} }
    ],
    condition: '2 of ($priv*)',
    tags: ['privilege-escalation', 'privesc']
  },

  // === LATERAL MOVEMENT ===
  {
    name: 'LateralMovement_Indicators',
    meta: {
      description: 'Lateral movement techniques',
      severity: ThreatLevel.DANGEROUS,
      category: 'lateral-movement',
      confidence: 80
    },
    strings: [
      { id: '$lat1', type: 'text', value: 'psexec', modifiers: { nocase: true } },
      { id: '$lat2', type: 'text', value: 'wmic', modifiers: { nocase: true } },
      { id: '$lat3', type: 'text', value: 'winrm', modifiers: { nocase: true } },
      { id: '$lat4', type: 'text', value: 'schtasks', modifiers: { nocase: true } },
      { id: '$lat5', type: 'regex', value: /net\s+use\s+\\\\[^\\]+/i, modifiers: {} },
      { id: '$lat6', type: 'regex', value: /copy\s+.*\\\\[^\\]+\\[^\\]+\$/i, modifiers: {} },
      { id: '$lat7', type: 'text', value: 'Enter-PSSession', modifiers: { nocase: true } },
      { id: '$lat8', type: 'text', value: 'Invoke-Command', modifiers: { nocase: true } }
    ],
    condition: '2 of ($lat*)',
    tags: ['lateral-movement', 'network']
  },

  // === DATA EXFILTRATION ===
  {
    name: 'DataExfil_Indicators',
    meta: {
      description: 'Data exfiltration patterns',
      severity: ThreatLevel.DANGEROUS,
      category: 'exfiltration',
      confidence: 75
    },
    strings: [
      { id: '$exf1', type: 'text', value: 'ftp.exe', modifiers: { nocase: true } },
      { id: '$exf2', type: 'regex', value: /ftp:\/\/[^:]+:[^@]+@/i, modifiers: {} },
      { id: '$exf3', type: 'text', value: 'pastebin.com', modifiers: { nocase: true } },
      { id: '$exf4', type: 'text', value: 'discord.com/api/webhooks', modifiers: { nocase: true } },
      { id: '$exf5', type: 'text', value: 'telegram.org/bot', modifiers: { nocase: true } },
      { id: '$exf6', type: 'regex', value: /smtp:\/\/|:25\b|:587\b|:465\b/i, modifiers: {} },
      { id: '$exf7', type: 'text', value: 'Base64', modifiers: {} },
      { id: '$exf8', type: 'text', value: 'compress', modifiers: { nocase: true } },
      { id: '$exf9', type: 'text', value: 'archive', modifiers: { nocase: true } }
    ],
    condition: '2 of ($exf*)',
    tags: ['exfiltration', 'data-theft']
  },

  // === CRYPTO WALLET THEFT ===
  {
    name: 'CryptoWallet_Theft',
    meta: {
      description: 'Cryptocurrency wallet theft',
      severity: ThreatLevel.CRITICAL,
      category: 'stealer',
      confidence: 90
    },
    strings: [
      // Bitcoin patterns
      { id: '$btc1', type: 'regex', value: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/, modifiers: {} },
      { id: '$btc2', type: 'regex', value: /\bbc1[a-zA-HJ-NP-Z0-9]{39,59}\b/, modifiers: {} },
      // Ethereum
      { id: '$eth1', type: 'regex', value: /\b0x[a-fA-F0-9]{40}\b/, modifiers: {} },
      // Monero
      { id: '$xmr1', type: 'regex', value: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/, modifiers: {} },
      // Wallet files
      { id: '$wal1', type: 'text', value: 'wallet.dat', modifiers: { nocase: true } },
      { id: '$wal2', type: 'text', value: 'electrum', modifiers: { nocase: true } },
      { id: '$wal3', type: 'text', value: 'exodus', modifiers: { nocase: true } },
      { id: '$wal4', type: 'text', value: 'metamask', modifiers: { nocase: true } },
      { id: '$wal5', type: 'text', value: 'atomic wallet', modifiers: { nocase: true } },
      { id: '$wal6', type: 'text', value: 'coinbase', modifiers: { nocase: true } }
    ],
    condition: '2 of ($btc*, $eth*, $xmr*) and any of ($wal*)',
    tags: ['crypto', 'wallet', 'stealer']
  }
];

/**
 * YARA Engine for pattern matching
 */
export class YaraEngine {
  private rules: YaraRule[] = [];
  private customRulesPath?: string;

  constructor() {
    this.rules = [...BUILTIN_RULES];
  }

  /**
   * Load custom YARA rules from file
   */
  async loadCustomRules(rulesPath: string): Promise<void> {
    try {
      this.customRulesPath = rulesPath;
      const content = await fs.readFile(rulesPath, 'utf-8');
      const parsed = this.parseYaraFile(content);
      this.rules = [...BUILTIN_RULES, ...parsed];
      console.log(`Loaded ${parsed.length} custom YARA rules from ${rulesPath}`);
    } catch (error) {
      console.error('Failed to load custom YARA rules:', error);
    }
  }

  /**
   * Parse YARA file content (simplified parser)
   */
  private parseYaraFile(content: string): YaraRule[] {
    // Simplified YARA parser - real YARA syntax is complex
    // This handles basic rule format:
    // rule RuleName { meta: ... strings: ... condition: ... }
    
    const rules: YaraRule[] = [];
    const ruleRegex = /rule\s+(\w+)\s*(?:\:\s*([\w\s]+))?\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    
    let match;
    while ((match = ruleRegex.exec(content)) !== null) {
      try {
        const [, name, tags, body] = match;
        const rule = this.parseRuleBody(name, tags?.split(/\s+/) || [], body);
        if (rule) rules.push(rule);
      } catch (e) {
        console.warn(`Failed to parse rule: ${match[1]}`);
      }
    }
    
    return rules;
  }

  /**
   * Parse rule body
   */
  private parseRuleBody(name: string, tags: string[], body: string): YaraRule | null {
    const meta: YaraRule['meta'] = { severity: ThreatLevel.SUSPICIOUS, confidence: 50 };
    const strings: YaraString[] = [];
    let condition = 'any of them';

    // Parse meta section
    const metaMatch = body.match(/meta\s*:\s*([\s\S]*?)(?=strings:|condition:|$)/);
    if (metaMatch) {
      const metaLines = metaMatch[1].split('\n');
      for (const line of metaLines) {
        const m = line.match(/(\w+)\s*=\s*"([^"]+)"/);
        if (m) {
          meta[m[1]] = m[2];
          if (m[1] === 'severity') {
            meta.severity = this.parseSeverity(m[2]);
          }
        }
      }
    }

    // Parse strings section
    const stringsMatch = body.match(/strings\s*:\s*([\s\S]*?)(?=condition:|$)/);
    if (stringsMatch) {
      const stringLines = stringsMatch[1].split('\n');
      for (const line of stringLines) {
        const strMatch = line.match(/(\$\w+)\s*=\s*(?:"([^"]+)"|{([^}]+)}|\/([^\/]+)\/)/);
        if (strMatch) {
          const [, id, text, hex, regex] = strMatch;
          const modifiers = this.parseModifiers(line);
          
          if (text) {
            strings.push({ id, type: 'text', value: text, modifiers });
          } else if (hex) {
            strings.push({ id, type: 'hex', value: Buffer.from(hex.replace(/\s/g, ''), 'hex'), modifiers });
          } else if (regex) {
            strings.push({ id, type: 'regex', value: new RegExp(regex, modifiers.nocase ? 'i' : ''), modifiers });
          }
        }
      }
    }

    // Parse condition
    const condMatch = body.match(/condition\s*:\s*([\s\S]+?)$/);
    if (condMatch) {
      condition = condMatch[1].trim();
    }

    return {
      name,
      meta,
      strings,
      condition,
      tags
    };
  }

  /**
   * Parse string modifiers
   */
  private parseModifiers(line: string): YaraString['modifiers'] {
    return {
      nocase: /\bnocase\b/i.test(line),
      wide: /\bwide\b/i.test(line),
      ascii: /\bascii\b/i.test(line),
      fullword: /\bfullword\b/i.test(line)
    };
  }

  /**
   * Parse severity string
   */
  private parseSeverity(s: string): ThreatLevel {
    const lower = s.toLowerCase();
    if (lower.includes('critical')) return ThreatLevel.CRITICAL;
    if (lower.includes('dangerous') || lower.includes('high')) return ThreatLevel.DANGEROUS;
    if (lower.includes('suspicious') || lower.includes('medium')) return ThreatLevel.SUSPICIOUS;
    return ThreatLevel.SAFE;
  }

  /**
   * Scan file against all YARA rules
   */
  async scanFile(filePath: string, signal?: AbortSignal): Promise<YaraMatch[]> {
    try {
      const buffer = await fs.readFile(filePath);
      return this.scanBuffer(buffer, signal);
    } catch (error) {
      console.error('YARA scan error:', error);
      return [];
    }
  }

  /**
   * Scan buffer against all YARA rules
   */
  scanBuffer(buffer: Buffer, signal?: AbortSignal): YaraMatch[] {
    const matches: YaraMatch[] = [];
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10 * 1024 * 1024));

    for (const rule of this.rules) {
      if (signal?.aborted) break;

      const result = this.evaluateRule(rule, buffer, content);
      if (result) {
        matches.push(result);
      }
    }

    return matches;
  }

  /**
   * Evaluate a single YARA rule
   */
  private evaluateRule(rule: YaraRule, buffer: Buffer, content: string): YaraMatch | null {
    const stringMatches: Map<string, { offset: number; length: number; data: string }[]> = new Map();

    // Find all string matches
    for (const str of rule.strings) {
      const matches = this.findStringMatches(str, buffer, content);
      if (matches.length > 0) {
        stringMatches.set(str.id, matches);
      }
    }

    // Evaluate condition
    const conditionMet = this.evaluateCondition(rule.condition, stringMatches, rule.strings);

    if (!conditionMet) return null;

    // Build match result
    const matchedStrings: YaraMatch['matchedStrings'] = [];
    for (const [id, offsets] of stringMatches) {
      for (const match of offsets.slice(0, 3)) { // Limit to first 3 matches per string
        matchedStrings.push({ id, ...match });
      }
    }

    return {
      rule: rule.name,
      description: rule.meta.description || '',
      severity: rule.meta.severity || ThreatLevel.SUSPICIOUS,
      confidence: rule.meta.confidence || 50,
      category: rule.meta.category || 'unknown',
      matchedStrings,
      tags: rule.tags || []
    };
  }

  /**
   * Find all matches for a string pattern
   */
  private findStringMatches(
    str: YaraString,
    buffer: Buffer,
    content: string
  ): { offset: number; length: number; data: string }[] {
    const matches: { offset: number; length: number; data: string }[] = [];

    if (str.type === 'text') {
      const pattern = str.value as string;
      const searchContent = str.modifiers.nocase ? content.toLowerCase() : content;
      const searchPattern = str.modifiers.nocase ? pattern.toLowerCase() : pattern;

      let pos = 0;
      while ((pos = searchContent.indexOf(searchPattern, pos)) !== -1) {
        if (!str.modifiers.fullword || this.isFullWord(content, pos, pattern.length)) {
          matches.push({
            offset: pos,
            length: pattern.length,
            data: content.substr(pos, Math.min(pattern.length, 50))
          });
        }
        pos++;
        if (matches.length >= 10) break;
      }
    } else if (str.type === 'hex') {
      const pattern = str.value as Buffer;
      let pos = 0;
      while ((pos = buffer.indexOf(pattern, pos)) !== -1) {
        matches.push({
          offset: pos,
          length: pattern.length,
          data: buffer.slice(pos, pos + Math.min(pattern.length, 20)).toString('hex')
        });
        pos++;
        if (matches.length >= 10) break;
      }
    } else if (str.type === 'regex') {
      const regex = str.value as RegExp;
      const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
      let match;
      while ((match = globalRegex.exec(content)) !== null) {
        matches.push({
          offset: match.index,
          length: match[0].length,
          data: match[0].substring(0, 50)
        });
        if (matches.length >= 10) break;
      }
    }

    return matches;
  }

  /**
   * Check if match is a full word
   */
  private isFullWord(content: string, pos: number, length: number): boolean {
    const before = pos > 0 ? content[pos - 1] : ' ';
    const after = pos + length < content.length ? content[pos + length] : ' ';
    return !/\w/.test(before) && !/\w/.test(after);
  }

  /**
   * Evaluate YARA condition
   */
  private evaluateCondition(
    condition: string,
    stringMatches: Map<string, any[]>,
    strings: YaraString[]
  ): boolean {
    const cond = condition.toLowerCase().trim();
    
    // Handle "any of them" or "any of ($xxx*)"
    if (cond.includes('any of')) {
      const prefixMatch = cond.match(/any of \(\$(\w+)\*\)/);
      if (prefixMatch) {
        const prefix = '$' + prefixMatch[1];
        return strings.some(s => s.id.startsWith(prefix) && stringMatches.has(s.id));
      }
      return stringMatches.size > 0;
    }

    // Handle "all of them" or "all of ($xxx*)"
    if (cond.includes('all of')) {
      const prefixMatch = cond.match(/all of \(\$(\w+)\*\)/);
      if (prefixMatch) {
        const prefix = '$' + prefixMatch[1];
        const prefixStrings = strings.filter(s => s.id.startsWith(prefix));
        return prefixStrings.every(s => stringMatches.has(s.id));
      }
      return strings.every(s => stringMatches.has(s.id));
    }

    // Handle "N of ($xxx*)"
    const countMatch = cond.match(/(\d+)\s+of\s+\(\$(\w+)\*\)/);
    if (countMatch) {
      const count = parseInt(countMatch[1]);
      const prefix = '$' + countMatch[2];
      const matchCount = strings.filter(s => s.id.startsWith(prefix) && stringMatches.has(s.id)).length;
      return matchCount >= count;
    }

    // Handle "N of them"
    const numMatch = cond.match(/(\d+)\s+of\s+them/);
    if (numMatch) {
      return stringMatches.size >= parseInt(numMatch[1]);
    }

    // Handle complex conditions with and/or
    if (cond.includes(' and ') || cond.includes(' or ')) {
      return this.evaluateComplexCondition(cond, stringMatches, strings);
    }

    // Default: any match
    return stringMatches.size > 0;
  }

  /**
   * Evaluate complex condition with and/or
   */
  private evaluateComplexCondition(
    condition: string,
    stringMatches: Map<string, any[]>,
    strings: YaraString[]
  ): boolean {
    // Split by 'or' first (lower precedence)
    if (condition.includes(' or ')) {
      const parts = condition.split(' or ');
      return parts.some(part => this.evaluateComplexCondition(part.trim(), stringMatches, strings));
    }

    // Split by 'and'
    if (condition.includes(' and ')) {
      const parts = condition.split(' and ');
      return parts.every(part => this.evaluateComplexCondition(part.trim(), stringMatches, strings));
    }

    // Evaluate single condition
    return this.evaluateCondition(condition, stringMatches, strings);
  }

  /**
   * Get all loaded rules
   */
  getRules(): YaraRule[] {
    return this.rules;
  }

  /**
   * Add a custom rule programmatically
   */
  addRule(rule: YaraRule): void {
    this.rules.push(rule);
  }

  /**
   * Get rule count
   */
  getRuleCount(): number {
    return this.rules.length;
  }
}

// Export singleton instance
export const yaraEngine = new YaraEngine();
