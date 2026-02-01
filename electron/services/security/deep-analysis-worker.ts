/**
 * Worker thread for deep analysis
 * Runs heavy file analysis operations in a separate thread to avoid blocking the main process
 */

import { parentPort, workerData } from 'worker_threads';
import { promises as fs } from 'fs';
import { extname } from 'path';
import type { DeepAnalysisResult, YaraMatch } from '../../../shared/virushunt-types';

// Import analyzers
import { YaraEngine } from './YaraEngine';
import { ImportTableAnalyzer } from './ImportTableAnalyzer';
import { FileUnpacker } from './FileUnpacker';
import { StringSignatureAnalyzer } from './StringSignatureAnalyzer';

interface WorkerInput {
  filePath: string;
  baseResult: any;
}

interface WorkerOutput {
  success: boolean;
  result?: any;
  error?: string;
  progress?: number;
}

async function performDeepAnalysis(input: WorkerInput): Promise<DeepAnalysisResult> {
  const { filePath, baseResult } = input;

  // Send progress update
  parentPort?.postMessage({ progress: 10, message: 'Reading file...' });

  const ext = extname(filePath).toLowerCase();
  const isPE = ['.exe', '.dll', '.scr', '.com', '.sys'].includes(ext);

  // Initialize analyzers
  const yaraEngine = new YaraEngine();
  const importTableAnalyzer = new ImportTableAnalyzer();
  const fileUnpacker = new FileUnpacker();
  const stringSignatureAnalyzer = new StringSignatureAnalyzer();

  parentPort?.postMessage({ progress: 20, message: 'File loaded, starting analysis...' });

  // For large files, read only first 100MB (most signatures are at the beginning)
  const stats = await fs.stat(filePath);
  const MAX_ANALYSIS_SIZE = 100 * 1024 * 1024; // 100MB
  const readSize = Math.min(stats.size, MAX_ANALYSIS_SIZE);
  
  let buffer: Buffer;
  
  if (stats.size > MAX_ANALYSIS_SIZE) {
    // Read only first 100MB for large files
    parentPort?.postMessage({ 
      progress: 25, 
      message: `Large file detected (${(stats.size / 1024 / 1024).toFixed(1)}MB), analyzing first 100MB...` 
    });
    
    const fileHandle = await fs.open(filePath, 'r');
    buffer = Buffer.allocUnsafe(readSize);
    await fileHandle.read(buffer, 0, readSize, 0);
    await fileHandle.close();
  } else {
    // Read entire file for small/medium files
    buffer = await fs.readFile(filePath);
  }

  parentPort?.postMessage({ progress: 30, message: 'Running YARA scan...' });

  // YARA scan
  const yaraMatches = await yaraEngine.scanBuffer(buffer);

  parentPort?.postMessage({ progress: 50, message: 'Analyzing strings...' });

  // String signature analysis
  const stringSignatures = await stringSignatureAnalyzer.analyzeBuffer(buffer);

  parentPort?.postMessage({ progress: 70, message: 'Analyzing imports and packers...' });

  // PE-specific analyses
  let importAnalysis = null;
  let packerDetection = null;
  
  if (isPE) {
    importAnalysis = await importTableAnalyzer.analyzeBuffer(buffer);
    packerDetection = await fileUnpacker.analyzeBuffer(buffer);
  }

  parentPort?.postMessage({ progress: 90, message: 'Finalizing results...' });

  // Combine all results
  const deepResult: DeepAnalysisResult = {
    ...baseResult,
    yaraMatches,
    importAnalysis,
    packerDetection,
    stringSignatures,
    // Add metadata about partial analysis for large files
    ...(stats.size > MAX_ANALYSIS_SIZE && {
      analysisNote: `⚠️ Large file (${(stats.size / 1024 / 1024).toFixed(1)}MB): analyzed first 100MB only. Most malware signatures are located at file beginning.`
    })
  };

  parentPort?.postMessage({ progress: 100, message: 'Complete!' });

  return deepResult;
}

// Main worker execution
(async () => {
  try {
    const result = await performDeepAnalysis(workerData as WorkerInput);
    parentPort?.postMessage({ success: true, result });
  } catch (error) {
    parentPort?.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Worker analysis failed'
    });
  }
})();
