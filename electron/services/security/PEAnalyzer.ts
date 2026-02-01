import { promises as fs } from 'fs';
import { PEAnalysisResult } from '../../../shared/virushunt-types';

/**
 * PE file analyzer for Windows executables
 * Analyzes PE structure, imports, exports, sections
 */
export class PEAnalyzer {
  // Suspicious WinAPI functions
  private readonly SUSPICIOUS_IMPORTS = new Set([
    // Process manipulation
    'CreateRemoteThread',
    'WriteProcessMemory',
    'ReadProcessMemory',
    'VirtualAllocEx',
    'OpenProcess',
    'NtCreateThreadEx',
    'RtlCreateUserThread',
    'QueueUserAPC',
    
    // Keylogging
    'GetAsyncKeyState',
    'GetKeyState',
    'SetWindowsHookEx',
    'GetKeyboardState',
    'RegisterHotKey',
    'RegisterRawInputDevices',
    
    // System manipulation
    'SetWindowsHookExA',
    'SetWindowsHookExW',
    'CreateToolhelp32Snapshot',
    'Process32First',
    'Process32Next',
    'Module32First',
    'Module32Next',
    
    // Network
    'InternetOpenA',
    'InternetOpenW',
    'InternetOpenUrlA',
    'InternetOpenUrlW',
    'HttpSendRequestA',
    'HttpSendRequestW',
    'URLDownloadToFileA',
    'URLDownloadToFileW',
    
    // Crypto
    'CryptEncrypt',
    'CryptDecrypt',
    'CryptAcquireContextA',
    'CryptAcquireContextW',
    
    // Registry
    'RegSetValueExA',
    'RegSetValueExW',
    'RegCreateKeyExA',
    'RegCreateKeyExW',
    'RegDeleteKeyA',
    'RegDeleteKeyW',
    
    // Anti-debug
    'IsDebuggerPresent',
    'CheckRemoteDebuggerPresent',
    'NtQueryInformationProcess',
    'OutputDebugStringA',
    'OutputDebugStringW'
  ]);

  /**
   * Analyze PE file structure
   * @param filePath Path to PE file
   * @returns PE analysis result
   */
  async analyzePE(filePath: string): Promise<PEAnalysisResult> {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Check DOS header
      if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5A4D) {
        return { isValidPE: false };
      }

      // Get PE header offset
      const peOffset = buffer.readUInt32LE(60);
      
      if (peOffset + 4 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) {
        return { isValidPE: false };
      }

      // Parse COFF header
      const coffHeaderOffset = peOffset + 4;
      const machine = buffer.readUInt16LE(coffHeaderOffset);
      const numberOfSections = buffer.readUInt16LE(coffHeaderOffset + 2);
      const timestamp = buffer.readUInt32LE(coffHeaderOffset + 4);
      const sizeOfOptionalHeader = buffer.readUInt16LE(coffHeaderOffset + 16);

      // Determine architecture
      const architecture = machine === 0x014c ? 'x86' : machine === 0x8664 ? 'x64' : undefined;

      // Parse Optional Header
      const optionalHeaderOffset = coffHeaderOffset + 20;
      const magic = buffer.readUInt16LE(optionalHeaderOffset);
      const is64Bit = magic === 0x020b;

      // Entry point
      const entryPoint = buffer.readUInt32LE(optionalHeaderOffset + 16);

      // Parse sections
      const sectionTableOffset = optionalHeaderOffset + sizeOfOptionalHeader;
      const sections = this.parseSections(buffer, sectionTableOffset, numberOfSections);

      // Parse imports
      const imports = await this.parseImports(buffer, optionalHeaderOffset, is64Bit, sections);

      // Detect suspicious imports
      const suspiciousImports = this.detectSuspiciousImports(imports);

      // Parse exports
      const exports = this.parseExports(buffer, optionalHeaderOffset, is64Bit, sections);

      return {
        isValidPE: true,
        architecture,
        entryPoint,
        imports,
        exports,
        sections,
        suspiciousImports,
        timestamp,
        linkerVersion: `${buffer.readUInt8(optionalHeaderOffset + 2)}.${buffer.readUInt8(optionalHeaderOffset + 3)}`
      };

    } catch (error) {
      console.error('PE analysis error:', error);
      return { isValidPE: false };
    }
  }

  /**
   * Parse PE sections
   */
  private parseSections(buffer: Buffer, offset: number, count: number): any[] {
    const sections = [];

    for (let i = 0; i < count; i++) {
      const sectionOffset = offset + i * 40;
      
      if (sectionOffset + 40 > buffer.length) break;

      // Read section name (8 bytes)
      let name = '';
      for (let j = 0; j < 8; j++) {
        const char = buffer.readUInt8(sectionOffset + j);
        if (char === 0) break;
        name += String.fromCharCode(char);
      }

      const virtualSize = buffer.readUInt32LE(sectionOffset + 8);
      const rawSize = buffer.readUInt32LE(sectionOffset + 16);
      const characteristics = buffer.readUInt32LE(sectionOffset + 36);

      // Check characteristics
      const isExecutable = (characteristics & 0x20000000) !== 0;
      const isWritable = (characteristics & 0x80000000) !== 0;

      sections.push({
        name,
        virtualSize,
        rawSize,
        entropy: 0, // Will be calculated by EntropyCalculator
        isExecutable,
        isWritable
      });
    }

    return sections;
  }

  /**
   * Parse import table
   */
  private async parseImports(
    buffer: Buffer,
    optionalHeaderOffset: number,
    is64Bit: boolean,
    sections: any[]
  ): Promise<{ dll: string; functions: string[] }[]> {
    try {
      // Get import directory RVA
      const importDirOffset = optionalHeaderOffset + (is64Bit ? 112 : 96);
      
      if (importDirOffset + 8 > buffer.length) return [];

      const importRVA = buffer.readUInt32LE(importDirOffset);
      const importSize = buffer.readUInt32LE(importDirOffset + 4);

      if (importRVA === 0 || importSize === 0) return [];

      // Convert RVA to file offset
      const importOffset = this.rvaToOffset(importRVA, sections, buffer);
      if (importOffset === null) return [];

      const imports: { dll: string; functions: string[] }[] = [];
      let currentOffset = importOffset;

      // Parse import descriptors
      while (currentOffset + 20 <= buffer.length) {
        const nameRVA = buffer.readUInt32LE(currentOffset + 12);
        
        if (nameRVA === 0) break;

        const nameOffset = this.rvaToOffset(nameRVA, sections, buffer);
        if (nameOffset === null) break;

        // Read DLL name
        let dllName = '';
        let namePos = nameOffset;
        while (namePos < buffer.length) {
          const char = buffer.readUInt8(namePos++);
          if (char === 0) break;
          dllName += String.fromCharCode(char);
        }

        // Parse import names
        const functions: string[] = [];
        const iltRVA = buffer.readUInt32LE(currentOffset);
        
        if (iltRVA !== 0) {
          const iltOffset = this.rvaToOffset(iltRVA, sections, buffer);
          
          if (iltOffset !== null) {
            let thunkOffset = iltOffset;
            const thunkSize = is64Bit ? 8 : 4;

            while (thunkOffset + thunkSize <= buffer.length) {
              const thunk = is64Bit 
                ? Number(buffer.readBigUInt64LE(thunkOffset))
                : buffer.readUInt32LE(thunkOffset);

              if (thunk === 0) break;

              // Check if import by name (not ordinal)
              if ((is64Bit && !(thunk & 0x8000000000000000)) || (!is64Bit && !(thunk & 0x80000000))) {
                const hintRVA = is64Bit ? thunk : thunk;
                const hintOffset = this.rvaToOffset(hintRVA, sections, buffer);

                if (hintOffset !== null && hintOffset + 2 < buffer.length) {
                  // Skip hint (2 bytes)
                  let funcName = '';
                  let funcPos = hintOffset + 2;

                  while (funcPos < buffer.length && funcPos < hintOffset + 256) {
                    const char = buffer.readUInt8(funcPos++);
                    if (char === 0) break;
                    funcName += String.fromCharCode(char);
                  }

                  if (funcName) {
                    functions.push(funcName);
                  }
                }
              }

              thunkOffset += thunkSize;
            }
          }
        }

        imports.push({ dll: dllName, functions });
        currentOffset += 20;
      }

      return imports;

    } catch (error) {
      console.error('Import parsing error:', error);
      return [];
    }
  }

  /**
   * Parse export table
   */
  private parseExports(
    buffer: Buffer,
    optionalHeaderOffset: number,
    is64Bit: boolean,
    sections: any[]
  ): string[] {
    try {
      // Get export directory RVA
      const exportDirOffset = optionalHeaderOffset + (is64Bit ? 104 : 88);
      
      if (exportDirOffset + 8 > buffer.length) return [];

      const exportRVA = buffer.readUInt32LE(exportDirOffset);
      const exportSize = buffer.readUInt32LE(exportDirOffset + 4);

      if (exportRVA === 0 || exportSize === 0) return [];

      const exportOffset = this.rvaToOffset(exportRVA, sections, buffer);
      if (exportOffset === null) return [];

      const numberOfNames = buffer.readUInt32LE(exportOffset + 24);
      const addressOfNamesRVA = buffer.readUInt32LE(exportOffset + 32);

      const namesOffset = this.rvaToOffset(addressOfNamesRVA, sections, buffer);
      if (namesOffset === null) return [];

      const exports: string[] = [];

      for (let i = 0; i < numberOfNames && i < 1000; i++) {
        const nameRVA = buffer.readUInt32LE(namesOffset + i * 4);
        const nameOffset = this.rvaToOffset(nameRVA, sections, buffer);

        if (nameOffset !== null) {
          let name = '';
          let pos = nameOffset;

          while (pos < buffer.length && pos < nameOffset + 256) {
            const char = buffer.readUInt8(pos++);
            if (char === 0) break;
            name += String.fromCharCode(char);
          }

          if (name) {
            exports.push(name);
          }
        }
      }

      return exports;

    } catch (error) {
      console.error('Export parsing error:', error);
      return [];
    }
  }

  /**
   * Convert RVA to file offset
   */
  private rvaToOffset(rva: number, sections: any[], buffer: Buffer): number | null {
    // Try to find containing section
    for (const section of sections) {
      const sectionStart = section.virtualAddress || 0;
      const sectionEnd = sectionStart + section.virtualSize;

      if (rva >= sectionStart && rva < sectionEnd) {
        const offset = rva - sectionStart + (section.pointerToRawData || 0);
        if (offset < buffer.length) {
          return offset;
        }
      }
    }

    // Fallback: try RVA as direct offset
    if (rva < buffer.length) {
      return rva;
    }

    return null;
  }

  /**
   * Detect suspicious imports
   */
  private detectSuspiciousImports(imports: { dll: string; functions: string[] }[]): string[] {
    const suspicious: string[] = [];

    for (const imp of imports) {
      for (const func of imp.functions) {
        if (this.SUSPICIOUS_IMPORTS.has(func)) {
          suspicious.push(`${imp.dll}!${func}`);
        }
      }
    }

    return suspicious;
  }

  /**
   * Check if file is PE executable
   */
  async isPEFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath, { flag: 'r' });
      
      if (buffer.length < 64) return false;
      
      // Check DOS signature
      return buffer.readUInt16LE(0) === 0x5A4D;
      
    } catch (error) {
      return false;
    }
  }
}

// Export singleton
export const peAnalyzer = new PEAnalyzer();
