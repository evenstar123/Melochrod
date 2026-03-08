/**
 * Harmony Engine public API.
 */

export type {
  Score,
  Measure,
  MusicEvent,
  Note,
  Rest,
  Pitch,
  KeySignature,
  TimeSignature,
  ChordSymbol,
  NoteLetter,
  Accidental,
  DurationType,
  ChordQuality,
  Mode,
} from './core/types.js';

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

export {
  NOTE_TO_SEMITONE,
  ACCIDENTAL_OFFSET,
  NOTE_LETTERS,
  FIFTHS_TO_MAJOR_KEY,
  MAJOR_SCALE_INTERVALS,
  MINOR_SCALE_INTERVALS,
  CHORD_TEMPLATES,
  DURATION_TO_QUARTERS,
} from './core/constants.js';

export { parseMusicXML } from './parser/musicxml-parser.js';
export { mergeMusicXMLPages } from './parser/musicxml-merge.js';
export { EnhancedMusicXMLParser } from './parser/enhanced-musicxml-parser.js';
export type {
  EnhancedParseOptions,
  EnhancedParseResult,
  MelodySelectionStrategy,
} from './parser/enhanced-musicxml-parser.js';

export {
  analyzeKey,
  formatKey,
  analyzeKeySegmented,
  getEffectiveKey,
} from './analyzer/key-analyzer.js';
export type {
  KeyAnalysisResult,
  SegmentedKeyResult,
  ModulationPoint,
} from './analyzer/key-analyzer.js';

export { extractMelodyFeatures, featuresToSearchQueries } from './harmonizer/melody-features.js';
export type { MelodyFeatures } from './harmonizer/melody-features.js';
export { RAGRetriever } from './harmonizer/rag-retriever.js';
export { LLMHarmonizer } from './harmonizer/llm-harmonizer.js';
export { HarmonizePipeline } from './harmonizer/harmonize-pipeline.js';
export type {
  PipelineConfig,
  PipelineResult,
  ValidationAnomaly,
} from './harmonizer/harmonize-pipeline.js';
export { ModeUnificationConfig } from './harmonizer/mode-unification-config.js';
export { filterMeasureChords } from './harmonizer/difficulty-filter.js';
export { loadTransitionMatrix, validateHarmonization } from './harmonizer/chord-validator.js';

export { HarmonyCache } from './perf/harmony-cache.js';
export type { HarmonyCacheConfig, CacheStats } from './perf/harmony-cache.js';

export { injectChordsToMusicXML, accidentalToAlter, QUALITY_TO_KIND } from './converter/ir-to-musicxml.js';
export { scoreToABC, keyToABCField, noteToABC, chordToABC } from './converter/ir-to-abc.js';
export { musicxmlToSVG, musicxmlToSVGPages, musicxmlToPNG, musicxmlToPDF } from './converter/score-to-render.js';
export type { RenderOptions } from './converter/score-to-render.js';

export { recognizeScore, recognizeBuffer } from './omr/audiveris-omr.js';
export type { OMRResult, OMRConfig } from './omr/audiveris-omr.js';
