import { spawn } from 'child_process';
import { SignatureVerification } from '../../../shared/virushunt-types';
import { platform } from 'os';

/**
 * Digital signature verifier for Windows executables
 * Uses PowerShell Get-AuthenticodeSignature on Windows
 * Cross-platform fallback for basic checks
 */
export class SignatureVerifier {
  /**
   * Verify digital signature of file
   * @param filePath Path to file
   * @returns Signature verification result
   */
  async verifySignature(filePath: string): Promise<SignatureVerification> {
    // Only works on Windows
    if (platform() !== 'win32') {
      return {
        isSigned: false,
        isValid: false,
        error: 'Signature verification only available on Windows'
      };
    }

    try {
      const result = await this.verifyWithPowerShell(filePath);
      return result;
    } catch (error) {
      return {
        isSigned: false,
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify signature using PowerShell Get-AuthenticodeSignature
   */
  private async verifyWithPowerShell(filePath: string): Promise<SignatureVerification> {
    return new Promise((resolve, reject) => {
      // Escape path for PowerShell
      const escapedPath = filePath.replace(/'/g, "''");

      // PowerShell command to get signature info
      const command = `
        $sig = Get-AuthenticodeSignature -FilePath '${escapedPath}';
        $result = @{
          Status = $sig.Status.ToString();
          SignerCertificate = if ($sig.SignerCertificate) {
            @{
              Subject = $sig.SignerCertificate.Subject;
              Issuer = $sig.SignerCertificate.Issuer;
              NotBefore = $sig.SignerCertificate.NotBefore.ToString('o');
              NotAfter = $sig.SignerCertificate.NotAfter.ToString('o');
            }
          } else { $null };
          TimeStamperCertificate = if ($sig.TimeStamperCertificate) {
            @{
              NotBefore = $sig.TimeStamperCertificate.NotBefore.ToString('o');
            }
          } else { $null };
        };
        $result | ConvertTo-Json -Compress;
      `;

      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-NoLogo',
        '-Command',
        command
      ]);

      let stdout = '';
      let stderr = '';

      ps.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output
          const result = JSON.parse(stdout.trim());
          
          const status = result.Status;
          const isSigned = status !== 'NotSigned';
          const isValid = status === 'Valid';

          const verification: SignatureVerification = {
            isSigned,
            isValid
          };

          if (result.SignerCertificate) {
            verification.subject = result.SignerCertificate.Subject;
            verification.issuer = result.SignerCertificate.Issuer;
            
            // Extract signer name from subject
            const cnMatch = result.SignerCertificate.Subject.match(/CN=([^,]+)/);
            if (cnMatch) {
              verification.signer = cnMatch[1];
            }
          }

          if (result.TimeStamperCertificate && result.TimeStamperCertificate.NotBefore) {
            verification.timestamp = new Date(result.TimeStamperCertificate.NotBefore).getTime();
          }

          if (!isValid && isSigned) {
            verification.error = `Signature status: ${status}`;
          }

          resolve(verification);

        } catch (parseError) {
          reject(new Error(`Failed to parse PowerShell output: ${parseError}`));
        }
      });

      ps.on('error', (error) => {
        reject(new Error(`Failed to spawn PowerShell: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ps.kill();
        reject(new Error('Signature verification timeout'));
      }, 10000);
    });
  }

  /**
   * Check if file has Authenticode signature (basic check)
   * @param buffer File buffer
   * @returns True if signature table exists
   */
  hasSignatureTable(buffer: Buffer): boolean {
    try {
      // Check DOS signature
      if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5A4D) {
        return false;
      }

      // Get PE offset
      const peOffset = buffer.readUInt32LE(60);
      if (peOffset + 4 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) {
        return false;
      }

      // Get Optional Header
      const coffHeaderOffset = peOffset + 4;
      const sizeOfOptionalHeader = buffer.readUInt16LE(coffHeaderOffset + 16);
      const optionalHeaderOffset = coffHeaderOffset + 20;

      // Check magic number
      const magic = buffer.readUInt16LE(optionalHeaderOffset);
      const is64Bit = magic === 0x020b;

      // Get certificate table offset
      const certTableOffset = optionalHeaderOffset + (is64Bit ? 144 : 128);
      
      if (certTableOffset + 8 > buffer.length) {
        return false;
      }

      // Check if certificate table exists
      const certRVA = buffer.readUInt32LE(certTableOffset);
      const certSize = buffer.readUInt32LE(certTableOffset + 4);

      return certRVA !== 0 && certSize !== 0;

    } catch (error) {
      return false;
    }
  }

  /**
   * Quick check if file appears to be signed
   * @param filePath Path to file
   * @returns True if signature table present
   */
  async quickSignatureCheck(filePath: string): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      const buffer = await fs.readFile(filePath);
      return this.hasSignatureTable(buffer);
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract signer information from subject string
   * @param subject Certificate subject
   * @returns Parsed signer info
   */
  parseSubject(subject: string): { cn?: string; o?: string; ou?: string; l?: string; s?: string; c?: string } {
    const info: any = {};
    
    const patterns = [
      { key: 'cn', pattern: /CN=([^,]+)/ },
      { key: 'o', pattern: /O=([^,]+)/ },
      { key: 'ou', pattern: /OU=([^,]+)/ },
      { key: 'l', pattern: /L=([^,]+)/ },
      { key: 's', pattern: /S=([^,]+)/ },
      { key: 'c', pattern: /C=([^,]+)/ }
    ];

    for (const { key, pattern } of patterns) {
      const match = subject.match(pattern);
      if (match) {
        info[key] = match[1].trim();
      }
    }

    return info;
  }

  /**
   * Check if signer is from known trusted publisher
   * @param signer Signer name
   * @returns True if trusted
   */
  isTrustedSigner(signer: string): boolean {
    const trustedSigners = [
      'Microsoft Corporation',
      'Microsoft Windows',
      'Adobe Systems',
      'Google LLC',
      'Apple Inc.',
      'Mozilla Corporation',
      'NVIDIA Corporation',
      'Intel Corporation',
      'AMD',
      'Valve Corporation'
    ];

    const lowerSigner = signer.toLowerCase();
    
    return trustedSigners.some(trusted => 
      lowerSigner.includes(trusted.toLowerCase())
    );
  }
}

// Export singleton
export const signatureVerifier = new SignatureVerifier();
