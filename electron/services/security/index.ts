/**
 * VirusHunt Security Module
 * Main export file for all security services
 */

// Export services
export { FileHashService, fileHashService } from './FileHashService';
export { ReputationDatabase, reputationDatabase } from './ReputationDatabase';
export { HeuristicAnalyzer, heuristicAnalyzer } from './AdvancedHeuristicAnalyzer';
export type { DeepAnalysisResult } from './AdvancedHeuristicAnalyzer';
export { VirusHuntSettings, virusHuntSettings } from './VirusHuntSettings';
export { VirusHuntService, virusHuntService } from './VirusHuntService';

// Export advanced analyzers
export { PEAnalyzer, peAnalyzer } from './PEAnalyzer';
export { EntropyCalculator, entropyCalculator } from './EntropyCalculator';
export { SignatureVerifier, signatureVerifier } from './SignatureVerifier';

// Export new deep analysis modules
export { YaraEngine, yaraEngine } from './YaraEngine';
export type { YaraRule, YaraMatch } from './YaraEngine';
export { ImportTableAnalyzer, importTableAnalyzer, ApiBehavior } from './ImportTableAnalyzer';
export type { ImportAnalysisResult } from './ImportTableAnalyzer';
export { FileUnpacker, fileUnpacker } from './FileUnpacker';
export type { PackerDetectionResult, UnpackResult, PackerInfo } from './FileUnpacker';
export { StringSignatureAnalyzer, stringSignatureAnalyzer, StringCategory } from './StringSignatureAnalyzer';
export type { StringAnalysisResult, StringFinding } from './StringSignatureAnalyzer';

// Re-export types from shared
export * from '../../../shared/virushunt-types';
