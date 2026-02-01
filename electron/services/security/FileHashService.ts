import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { stat } from 'fs/promises';
import { basename } from 'path';

/**
 * Service for computing file hashes
 */
export class FileHashService {
  /**
   * Compute SHA256 hash of a file
   * @param filePath Absolute path to the file
   * @param signal Optional abort signal for cancellation
   * @returns Promise resolving to hex-encoded SHA256 hash
   */
  async computeFileHash(filePath: string, signal?: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // Check if already aborted
      if (signal?.aborted) {
        reject(new Error('Hash computation cancelled'));
        return;
      }

      const hash = createHash('sha256');
      const stream = createReadStream(filePath, {
        highWaterMark: 64 * 1024 // 64KB chunks for optimal performance
      });

      // Handle abort signal
      const abortHandler = () => {
        stream.destroy();
        reject(new Error('Hash computation cancelled'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      stream.on('error', (error) => {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        reject(new Error(`Failed to read file: ${error.message}`));
      });

      stream.on('data', (chunk) => {
        // Check for cancellation during processing
        if (signal?.aborted) {
          stream.destroy();
          return;
        }
        hash.update(chunk);
      });

      stream.on('end', () => {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        
        if (signal?.aborted) {
          reject(new Error('Hash computation cancelled'));
          return;
        }
        
        resolve(hash.digest('hex'));
      });
    });
  }

  /**
   * Compute SHA256 hashes for multiple files
   * @param filePaths Array of absolute file paths
   * @param signal Optional abort signal for cancellation
   * @param onProgress Optional progress callback
   * @returns Promise resolving to map of file paths to hashes
   */
  async computeMultipleHashes(
    filePaths: string[],
    signal?: AbortSignal,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    let completed = 0;

    for (const filePath of filePaths) {
      if (signal?.aborted) {
        throw new Error('Hash computation cancelled');
      }

      try {
        const hash = await this.computeFileHash(filePath, signal);
        results.set(filePath, hash);
        completed++;
        
        if (onProgress) {
          onProgress(completed, filePaths.length);
        }
      } catch (error) {
        // If cancelled, propagate the error
        if (signal?.aborted) {
          throw error;
        }
        // Otherwise, log error and continue with other files
        console.error(`Failed to hash file ${filePath}:`, error);
      }
    }

    return results;
  }

  /**
   * Compute hash of a buffer or string
   * @param data Buffer or string to hash
   * @returns SHA256 hash in hex format
   */
  computeBufferHash(data: Buffer | string): string {
    const hash = createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Compute partial hash (first N bytes) for quick comparison
   * Useful for large files where full hash would be too slow
   * @param filePath Absolute path to the file
   * @param bytes Number of bytes to read from start of file
   * @param signal Optional abort signal for cancellation
   * @returns Promise resolving to hex-encoded SHA256 hash of first N bytes
   */
  async computePartialHash(
    filePath: string,
    bytes: number = 1024 * 1024, // Default 1MB
    signal?: AbortSignal
  ): Promise<string> {
    if (signal?.aborted) {
      throw new Error('Hash computation cancelled');
    }

    const buffer = Buffer.alloc(bytes);
    let fileHandle;

    try {
      fileHandle = await fs.open(filePath, 'r');
      const { bytesRead } = await fileHandle.read(buffer, 0, bytes, 0);
      
      if (signal?.aborted) {
        throw new Error('Hash computation cancelled');
      }

      const hash = createHash('sha256');
      hash.update(buffer.slice(0, bytesRead));
      return hash.digest('hex');
    } finally {
      await fileHandle?.close();
    }
  }

  /**
   * Get file information along with hash
   * @param filePath Absolute path to the file
   * @param signal Optional abort signal for cancellation
   * @returns Promise resolving to object with file info and hash
   */
  async getFileInfoWithHash(
    filePath: string,
    signal?: AbortSignal
  ): Promise<{
    path: string;
    name: string;
    size: number;
    hash: string;
  }> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    const stats = await stat(filePath);
    const hash = await this.computeFileHash(filePath, signal);

    return {
      path: filePath,
      name: basename(filePath),
      size: stats.size,
      hash
    };
  }

  /**
   * Verify if file hash matches expected hash
   * @param filePath Absolute path to the file
   * @param expectedHash Expected SHA256 hash in hex format
   * @param signal Optional abort signal for cancellation
   * @returns Promise resolving to true if hashes match
   */
  async verifyFileHash(
    filePath: string,
    expectedHash: string,
    signal?: AbortSignal
  ): Promise<boolean> {
    const actualHash = await this.computeFileHash(filePath, signal);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Compute MD5 hash of a file (for legacy compatibility)
   * @param filePath Absolute path to the file
   * @param signal Optional abort signal for cancellation
   * @returns Promise resolving to hex-encoded MD5 hash
   */
  async computeMD5Hash(filePath: string, signal?: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Hash computation cancelled'));
        return;
      }

      const hash = createHash('md5');
      const stream = createReadStream(filePath, {
        highWaterMark: 64 * 1024
      });

      const abortHandler = () => {
        stream.destroy();
        reject(new Error('Hash computation cancelled'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      stream.on('error', (error) => {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        reject(new Error(`Failed to read file: ${error.message}`));
      });

      stream.on('data', (chunk) => {
        if (signal?.aborted) {
          stream.destroy();
          return;
        }
        hash.update(chunk);
      });

      stream.on('end', () => {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        
        if (signal?.aborted) {
          reject(new Error('Hash computation cancelled'));
          return;
        }
        
        resolve(hash.digest('hex'));
      });
    });
  }
}

// Export singleton instance
export const fileHashService = new FileHashService();
