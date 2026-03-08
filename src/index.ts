/**
 * Harmony Engine public API.
 */

// Core score types
export type {
  Score, Measure, MusicEvent, Note, Rest, Pitch,
  KeySignature, TimeSignature, ChordSymbol,
  NoteLetter, Accidental, DurationType, ChordQuality, Mode,
} from './core/types.js';

// Extended harmony IR
export type {
  DifficultyLevel,
  SupportedMode,
  HarmonyFunction,
  CandidateSource,
  TimeSpan,
  ChordCandidate,
} from './core/harmony-types.js';
export { HarmonyAnnotation, CandidateLattice } from './core/harmony-types.js';

// Music/time utilities
export {
  total_duration,
  measure_start_time,
  flatten_timed_events,
  flatten_timed_notes,
  flatten_timed_rests,
  notes_in_span,
  rests_in_span,
  is_downbeat,
} from './core/music-time.js';

// Constants
export {
  NOTE_TO_SEMITONE, ACCIDENTAL_OFFSET, NOTE_LETTERS,
  FIFTHS_TO_MAJOR_KEY, MAJOR_SCALE_INTERVALS, MINOR_SCALE_INTERVALS,
  CHORD_TEMPLATES, DURATION_TO_QUARTERS,
} from './core/constants.js';

// Parser
export { parseMusicXML } from './parser/musicxml-parser.js';
export { mergeMusicXMLPages } from './parser/musicxml-merge.js';
export { EnhancedMusicXMLParser } from './parser/enhanced-musicxml-parser.js';
export type { EnhancedParseOptions, EnhancedParseResult, MelodySelectionStrategy } from './parser/enhanced-musicxml-parser.js';

// Analyzers
export { analyzeKey, formatKey, analyzeKeySegmented, getEffectiveKey } from './analyzer/key-analyzer.js';
export type { KeyAnalysisResult, SegmentedKeyResult, ModulationPoint } from './analyzer/key-analyzer.js';
export { NoteSalienceAnalyzer } from './analyzer/note-salience-analyzer.js';
export { HarmonicRhythmPredictor } from './analyzer/harmonic-rhythm-predictor.js';
export { PhraseSegmentationModule } from './analyzer/phrase-segmentation-module.js';
export { KeySequenceAnalyzer } from './analyzer/key-sequence-analyzer.js';
export type { KeyInfo } from './analyzer/key-sequence-analyzer.js';

// Existing harmonizer stack
export { extractMelodyFeatures, featuresToSearchQueries } from './harmonizer/melody-features.js';
export type { MelodyFeatures } from './harmonizer/melody-features.js';
export { RAGRetriever } from './harmonizer/rag-retriever.js';
export { LLMHarmonizer } from './harmonizer/llm-harmonizer.js';
export { HarmonizePipeline } from './harmonizer/harmonize-pipeline.js';
export type { PipelineConfig, PipelineResult, ValidationAnomaly } from './harmonizer/harmonize-pipeline.js';

// New architecture modules
export { DifficultyController, difficulty_constraints } from './harmonizer/difficulty-controller.js';
export { FunctionalStateTracker } from './harmonizer/functional-state-tracker.js';
export type { FunctionalState, FunctionalStateContext } from './harmonizer/functional-state-tracker.js';
export { HybridRetrievalStrategy } from './harmonizer/hybrid-retrieval-strategy.js';
export type { HybridSegment, HybridQuery, HybridSearchResult } from './harmonizer/hybrid-retrieval-strategy.js';
export { ExplanationModule } from './harmonizer/explanation-module.js';
export type { Explanation, ExplanationLLMProvider, ExplanationGenerateInput } from './harmonizer/explanation-module.js';
export { MultiVersionGenerator } from './harmonizer/multi-version-generator.js';
export type { HarmonyVersion, MultiVersionInput } from './harmonizer/multi-version-generator.js';
export { RepeatPhraseAnalyzer } from './harmonizer/repeat-phrase-analyzer.js';
export type { RepeatGroup } from './harmonizer/repeat-phrase-analyzer.js';
export { InteractiveEditAPI } from './harmonizer/interactive-edit-api.js';
export type { EditResult } from './harmonizer/interactive-edit-api.js';
export { HarmonyEnginePipeline } from './harmonizer/harmony-engine-pipeline.js';
export type {
  HarmonyEngineInput,
  HarmonyEnginePipelineConfig,
  HarmonyEnginePipelineResult,
  HarmonyEnginePipelineRuntimeConfig,
  StageTiming,
  PipelineMonitoring,
  HarmonyEnginePipelineMetadata,
} from './harmonizer/harmony-engine-pipeline.js';
export { ModeUnificationConfig } from './harmonizer/mode-unification-config.js';
export { StyleControlSystem } from './harmonizer/style-control-system.js';
export type { StyleProfile } from './harmonizer/style-control-system.js';
export { UserCorrectionLoop } from './harmonizer/user-correction-loop.js';
export type { UserRole, CorrectionEventType, CorrectionEvent, CorrectionAnalysis, PreferenceProfile } from './harmonizer/user-correction-loop.js';
export { ConfidenceCalibrator } from './harmonizer/confidence-calibrator.js';
export type {
  ConfidenceDecomposition,
  ChordConfidenceOutput,
  MeasureConfidenceOutput,
  ConfidenceOutput,
} from './harmonizer/confidence-calibrator.js';

// Candidate lattice generation
export { RuleRouter } from './candidate/rule-router.js';
export { RetrievalRouter } from './candidate/retrieval-router.js';
export { ModelRouter } from './candidate/model-router.js';
export { CandidateLatticeGenerator } from './candidate/candidate-lattice-generator.js';
export type {
  KeyContext,
  CandidateRouterContext,
  RetrievalHit,
  RetrievalProvider,
  SymbolicModel,
  LLMProvider,
} from './candidate/types.js';

// Decoder and repair
export { GlobalDecoder } from './decoder/global-decoder.js';
export type { DecodeContext, DecodeResult, DecoderKeyContext, GlobalDecoderConfig } from './decoder/global-decoder.js';
export { ErrorAwareDecodingStrategy } from './decoder/error-aware-decoding-strategy.js';
export type { DecodedAlternative } from './decoder/error-aware-decoding-strategy.js';
export { ThreeLayerRepairer } from './repair/three-layer-repairer.js';
export type { RepairOperation, RepairResult } from './repair/three-layer-repairer.js';

// RAG semantic features
export { HarmonicSemanticFeatureExtractor } from './rag/harmonic-semantic-feature-extractor.js';
export type { HarmonicSemanticFeatures } from './rag/harmonic-semantic-feature-extractor.js';

// Performance and reliability
export { HarmonyCache } from './perf/harmony-cache.js';
export type { HarmonyCacheConfig, CacheStats } from './perf/harmony-cache.js';
export { DegradationStrategy } from './perf/degradation-strategy.js';
export type {
  EmbeddingFallbackInput,
  EmbeddingFallbackResult,
  LLMFallbackInput,
  LLMFallbackResult,
  OMRFallbackInput,
  OMRFallbackResult,
  RenderingFallbackInput,
  RenderingFallbackResult,
} from './perf/degradation-strategy.js';
export { ModelDistillationModule } from './perf/model-distillation-module.js';
export type {
  DistillationMode,
  UserCorrectionRecord,
  LLMOutputRecord,
  DistillationTrainingSample,
  DistillationValidationSample,
  DistillationEvaluationResult,
  DistillationPrediction,
  ModeSelectionResult,
} from './perf/model-distillation-module.js';
export { EvaluationMetrics } from './perf/evaluation-metrics.js';
export type { CadenceMetrics, UserAcceptanceMetrics, UserAcceptanceRecord } from './perf/evaluation-metrics.js';

// Converters
export { injectChordsToMusicXML, accidentalToAlter, QUALITY_TO_KIND } from './converter/ir-to-musicxml.js';
export { MusicXMLOutputModule } from './converter/musicxml-output-module.js';
export type { OutputHarmony } from './converter/musicxml-output-module.js';
export { scoreToABC, keyToABCField, noteToABC, chordToABC } from './converter/ir-to-abc.js';

// OMR
export { recognizeScore, recognizeBuffer } from './omr/audiveris-omr.js';
export type { OMRResult, OMRConfig } from './omr/audiveris-omr.js';
export { OMRInterface } from './omr/omr-interface.js';
export type { OMRConfidenceReport, OMRRiskRegion } from './omr/omr-interface.js';

// Rendering
export { musicxmlToSVG, musicxmlToSVGPages, musicxmlToPNG, musicxmlToPDF } from './converter/score-to-render.js';
export type { RenderOptions } from './converter/score-to-render.js';
