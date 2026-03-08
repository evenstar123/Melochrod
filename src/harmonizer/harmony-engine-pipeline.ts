import type { ChordSymbol, Score } from '../core/types.js';
import type { ChordCandidate, DifficultyLevel, SupportedMode, TimeSpan } from '../core/harmony-types.js';
import { CandidateLattice } from '../core/harmony-types.js';
import { NoteSalienceAnalyzer } from '../analyzer/note-salience-analyzer.js';
import { PhraseSegmentationModule } from '../analyzer/phrase-segmentation-module.js';
import { KeySequenceAnalyzer } from '../analyzer/key-sequence-analyzer.js';
import { HarmonicRhythmPredictor } from '../analyzer/harmonic-rhythm-predictor.js';
import { FunctionalStateTracker } from './functional-state-tracker.js';
import { CandidateLatticeGenerator } from '../candidate/candidate-lattice-generator.js';
import { GlobalDecoder } from '../decoder/global-decoder.js';
import { ThreeLayerRepairer } from '../repair/three-layer-repairer.js';
import { measure_start_time } from '../core/music-time.js';
import { RepeatPhraseAnalyzer } from './repeat-phrase-analyzer.js';
import { HarmonyCache, type HarmonyCacheConfig } from '../perf/harmony-cache.js';
import { ConfidenceCalibrator, type ConfidenceOutput } from './confidence-calibrator.js';
import { ModeUnificationConfig } from './mode-unification-config.js';
import { UserCorrectionLoop, type PreferenceProfile } from './user-correction-loop.js';
import { DegradationStrategy } from '../perf/degradation-strategy.js';
import { MusicXMLOutputModule } from '../converter/musicxml-output-module.js';
import { EnhancedMusicXMLParser } from '../parser/enhanced-musicxml-parser.js';
import { OMRInterface, type OMRConfidenceReport } from '../omr/omr-interface.js';
import { ExplanationModule, type Explanation } from './explanation-module.js';

export type HarmonyEngineInput =
  | {
    type: 'score';
    score: Score;
    original_musicxml?: string;
  }
  | {
    type: 'musicxml';
    content: string;
  }
  | {
    type: 'pdf' | 'image';
    preprocessed_musicxml?: string;
    preview?: string;
  };

export interface HarmonyEnginePipelineConfig {
  difficulty: DifficultyLevel;
  style: string;
  mode?: string;
  omr_confidence?: number;
  omr_confidence_report?: OMRConfidenceReport;
  user_profile?: PreferenceProfile;
  institution_profile?: PreferenceProfile;
  user_previous_chord?: string;
  generate_explanations?: boolean;

  // Internal optional fields for integration entrypoints.
  input_type?: HarmonyEngineInput['type'];
  original_musicxml?: string;
}

export interface StageTiming {
  note_salience_ms: number;
  phrase_segmentation_ms: number;
  key_sequence_ms: number;
  rhythm_ms: number;
  state_tracking_ms: number;
  lattice_ms: number;
  decode_ms: number;
  repair_ms: number;
  explanation_ms: number;
  output_ms: number;
}

export interface PipelineMonitoring {
  execution_ms: number;
  stage_timing: StageTiming;
  cache_hit_rates: Record<string, number>;
  confidence_score: number;
  error_count: number;
  warning_count: number;
}

export interface HarmonyEnginePipelineMetadata {
  input_type: HarmonyEngineInput['type'];
  difficulty: DifficultyLevel;
  style: string;
  mode?: SupportedMode;
  degraded: boolean;
  warnings: string[];
  errors: string[];
  omr_report?: OMRConfidenceReport;
}

export interface HarmonyEnginePipelineRuntimeConfig {
  cache?: HarmonyCache;
  cache_config?: HarmonyCacheConfig;
  log_cache_stats?: boolean;
  log_monitoring?: boolean;
  confidence_calibrator?: ConfidenceCalibrator;
  preference_loop?: UserCorrectionLoop;
  degradation_strategy?: DegradationStrategy;
  output_module?: MusicXMLOutputModule;
  parser?: EnhancedMusicXMLParser;
  omr_interface?: OMRInterface;
  explanation_module?: ExplanationModule;
}

export interface HarmonyEnginePipelineResult {
  score: Score;
  time_spans: TimeSpan[];
  phrase_boundaries: TimeSpan[];
  key_sequence: ReturnType<KeySequenceAnalyzer['analyze']>;
  functional_states: string[];
  total_score: number;
  repair_operations: ReturnType<ThreeLayerRepairer['repair']>['operations'];
  confidence: ConfidenceOutput;

  chord_sequence: ChordCandidate[];
  lattice: CandidateLattice;
  explanations: Explanation[];
  annotated_musicxml?: string;

  monitoring: PipelineMonitoring;
  metadata: HarmonyEnginePipelineMetadata;
}

function empty_score(): Score {
  return {
    title: 'Partial Result',
    composer: 'HarmonyEngine',
    key: { tonic: 'C', tonicAccidental: 'none', mode: 'major', fifths: 0 },
    time: { beats: 4, beatType: 4 },
    tempo: 100,
    measures: [],
  };
}

function to_chord_symbol(candidate: ChordCandidate, beat: number): ChordSymbol {
  return {
    root: candidate.root,
    rootAccidental: candidate.root_accidental,
    quality: candidate.quality,
    beat,
  };
}

function cache_hit_rates(stats: ReturnType<HarmonyCache['get_stats']>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [name, value] of Object.entries(stats)) {
    const total = value.hits + value.misses;
    result[name] = total === 0 ? 0 : value.hits / total;
  }
  return result;
}

function parse_key(key: string): { root: ChordCandidate['root']; accidental: ChordCandidate['root_accidental'] } {
  const m = key.trim().match(/^([A-G])([b#]?)/);
  if (!m) {
    return { root: 'C', accidental: 'none' };
  }
  return {
    root: m[1] as ChordCandidate['root'],
    accidental: m[2] === '#' ? 'sharp' : m[2] === 'b' ? 'flat' : 'none',
  };
}

export class HarmonyEnginePipeline {
  private readonly note_salience_analyzer = new NoteSalienceAnalyzer();
  private readonly phrase_segmentation = new PhraseSegmentationModule();
  private readonly key_sequence_analyzer = new KeySequenceAnalyzer();
  private readonly harmonic_rhythm_predictor = new HarmonicRhythmPredictor();
  private readonly functional_state_tracker = new FunctionalStateTracker();
  private readonly lattice_generator = new CandidateLatticeGenerator();
  private readonly decoder = new GlobalDecoder({ algorithm: 'viterbi' });
  private readonly repairer = new ThreeLayerRepairer();
  private readonly repeat_analyzer = new RepeatPhraseAnalyzer();

  private readonly cache: HarmonyCache;
  private readonly log_cache_stats: boolean;
  private readonly log_monitoring: boolean;
  private readonly confidence_calibrator: ConfidenceCalibrator;
  private readonly preference_loop: UserCorrectionLoop;
  private readonly degradation_strategy: DegradationStrategy;
  private readonly output_module: MusicXMLOutputModule;
  private readonly parser: EnhancedMusicXMLParser;
  private readonly omr_interface: OMRInterface;
  private readonly explanation_module: ExplanationModule;
  private readonly mode_config = new ModeUnificationConfig();

  constructor(runtime_config: HarmonyEnginePipelineRuntimeConfig = {}) {
    this.cache = runtime_config.cache ?? new HarmonyCache(runtime_config.cache_config);
    this.log_cache_stats = runtime_config.log_cache_stats ?? false;
    this.log_monitoring = runtime_config.log_monitoring ?? false;
    this.confidence_calibrator = runtime_config.confidence_calibrator ?? new ConfidenceCalibrator();
    this.preference_loop = runtime_config.preference_loop ?? new UserCorrectionLoop();
    this.degradation_strategy = runtime_config.degradation_strategy ?? new DegradationStrategy();
    this.output_module = runtime_config.output_module ?? new MusicXMLOutputModule();
    this.parser = runtime_config.parser ?? new EnhancedMusicXMLParser();
    this.omr_interface = runtime_config.omr_interface ?? new OMRInterface();
    this.explanation_module = runtime_config.explanation_module ?? new ExplanationModule();
  }

  async run_from_input(input: HarmonyEngineInput, config: HarmonyEnginePipelineConfig): Promise<HarmonyEnginePipelineResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      if (input.type === 'score') {
        const result = await this.run(input.score, {
          ...config,
          input_type: 'score',
          original_musicxml: input.original_musicxml,
        });
        return result;
      }

      if (input.type === 'musicxml') {
        const parsed = this.parser.parse(input.content);
        const result = await this.run(parsed.score, {
          ...config,
          input_type: 'musicxml',
          original_musicxml: input.content,
        });
        return result;
      }

      const sourceXml = input.preprocessed_musicxml;
      if (!sourceXml) {
        const fallback = this.degradation_strategy.omr_service_fallback({ preprocessed_preview: input.preview });
        warnings.push(...fallback.warnings);
        errors.push('OMR source is missing for pdf/image input.');

        return this.partial_result({
          input_type: input.type,
          config,
          warnings,
          errors,
          omr_report: undefined,
        });
      }

      const omr = this.omr_interface.process_omr_output(sourceXml);
      const result = await this.run(omr.score, {
        ...config,
        input_type: input.type,
        original_musicxml: sourceXml,
        omr_confidence_report: config.omr_confidence_report ?? omr.report,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          omr_report: omr.report,
        },
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      warnings.push('Pipeline failed before completion; returning partial result.');
      return this.partial_result({
        input_type: input.type,
        config,
        warnings,
        errors,
        omr_report: config.omr_confidence_report,
      });
    }
  }

  async run(score: Score, config: HarmonyEnginePipelineConfig): Promise<HarmonyEnginePipelineResult> {
    const startedAt = Date.now();
    const stageTiming: StageTiming = {
      note_salience_ms: 0,
      phrase_segmentation_ms: 0,
      key_sequence_ms: 0,
      rhythm_ms: 0,
      state_tracking_ms: 0,
      lattice_ms: 0,
      decode_ms: 0,
      repair_ms: 0,
      explanation_ms: 0,
      output_ms: 0,
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    const tSalience = Date.now();
    this.note_salience_analyzer.analyze(score);
    stageTiming.note_salience_ms = Date.now() - tSalience;

    const tPhrase = Date.now();
    const phraseBoundaries = this.phrase_segmentation.segment(score, 0);
    this.note_salience_analyzer.analyze(score, phraseBoundaries);
    stageTiming.phrase_segmentation_ms = Date.now() - tPhrase;

    const scoreFingerprint = this.score_fingerprint(score);

    const tKey = Date.now();
    const keySequenceCacheKey = this.cache.generate_melody_cache_key({
      stage: 'key_sequence',
      score: scoreFingerprint,
    });
    const cachedKeySequence = this.cache.get_melody_result<ReturnType<KeySequenceAnalyzer['analyze']>>(keySequenceCacheKey);
    let keySequence = cachedKeySequence ?? this.key_sequence_analyzer.analyze(score);
    if (!cachedKeySequence) {
      this.cache.set_melody_result(keySequenceCacheKey, keySequence);
    }

    if (config.mode) {
      const normalizedMode = this.mode_config.map_to_supported_mode(config.mode);
      keySequence = keySequence.map((entry) => ({ ...entry, mode: normalizedMode }));
    }
    stageTiming.key_sequence_ms = Date.now() - tKey;

    const tRhythm = Date.now();
    const rhythmCacheKey = this.cache.generate_melody_cache_key({
      stage: 'harmonic_rhythm',
      score: scoreFingerprint,
      difficulty: config.difficulty,
      style: config.style,
      phrase_boundaries: phraseBoundaries,
    });
    const cachedTimeSpans = this.cache.get_melody_result<TimeSpan[]>(rhythmCacheKey);
    const timeSpans = cachedTimeSpans ?? this.harmonic_rhythm_predictor.predict({
      score,
      difficulty: config.difficulty,
      style: config.style,
      phrase_boundaries: phraseBoundaries,
    });
    if (!cachedTimeSpans) {
      this.cache.set_melody_result(rhythmCacheKey, timeSpans);
    }
    stageTiming.rhythm_ms = Date.now() - tRhythm;

    const tState = Date.now();
    const stateContexts = keySequence.map((entry) => ({
      start_time: entry.start_time,
      end_time: entry.end_time,
      key: entry.key,
      mode: entry.mode,
      confidence: entry.confidence,
    }));
    const functionalStates = this.functional_state_tracker.track(score, stateContexts, phraseBoundaries);
    stageTiming.state_tracking_ms = Date.now() - tState;

    const tLattice = Date.now();
    let lattice: CandidateLattice;
    try {
      const latticeCacheKey = this.cache.generate_melody_cache_key({
        stage: 'candidate_lattice',
        score: scoreFingerprint,
        time_spans: timeSpans,
        key_sequence: stateContexts,
        difficulty: config.difficulty,
        style: config.style,
        phrase_boundaries: phraseBoundaries,
        functional_states: functionalStates,
      });
      const cachedLattice = this.cache.get_melody_result<CandidateLattice>(latticeCacheKey);
      lattice = cachedLattice ?? await this.lattice_generator.generate({
        score,
        time_spans: timeSpans,
        key_sequence: stateContexts,
        difficulty: config.difficulty,
        style: config.style,
        phrase_boundaries: phraseBoundaries,
        functional_states: functionalStates,
      });
      if (!cachedLattice) {
        this.cache.set_melody_result(latticeCacheKey, lattice);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      const fallbackCandidates = this.degradation_strategy.embedding_service_fallback({
        rule_candidates: [this.make_tonic_candidate(stateContexts[0], config.difficulty)],
      });
      warnings.push(...fallbackCandidates.warnings);
      lattice = this.build_fallback_lattice(timeSpans, stateContexts, config.difficulty, fallbackCandidates.candidates[0]);
    }
    stageTiming.lattice_ms = Date.now() - tLattice;

    this.apply_preferences(lattice, config.user_profile, config.institution_profile, config.user_previous_chord);

    const tDecode = Date.now();
    const baseContext = {
      key_sequence: keySequence.map((entry) => ({
        key: entry.key,
        start_time: entry.start_time,
        end_time: entry.end_time,
      })),
      difficulty: config.difficulty,
      style: config.style,
      phrase_boundaries: phraseBoundaries,
    };

    let decoded: ReturnType<GlobalDecoder['decode']>;
    try {
      const firstPass = this.decoder.decode(lattice, baseContext);
      const repeatGroups = this.repeat_analyzer.detect_repeats(score, phraseBoundaries, 0.85);
      const repeatExpectations = this.repeat_analyzer.build_repeat_expectations(
        firstPass.chord_sequence,
        timeSpans,
        phraseBoundaries,
        repeatGroups,
      );

      decoded = this.decoder.decode(lattice, {
        ...baseContext,
        repeat_expectations: repeatExpectations,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      const fallback = this.degradation_strategy.llm_service_fallback({
        lattice,
        context: baseContext,
      });
      warnings.push(...fallback.warnings);
      decoded = fallback.decoded;
    }
    stageTiming.decode_ms = Date.now() - tDecode;

    const tRepair = Date.now();
    const repaired = this.repairer.repair(decoded.chord_sequence, lattice, phraseBoundaries);
    this.write_to_score(score, repaired.chord_sequence, timeSpans);
    stageTiming.repair_ms = Date.now() - tRepair;

    const omrConfidence = config.omr_confidence_report?.overall_confidence ?? config.omr_confidence;
    const keyConfidence = keySequence.length === 0
      ? 0.6
      : keySequence.reduce((sum, entry) => sum + entry.confidence, 0) / keySequence.length;
    const confidence = this.confidence_calibrator.compute_confidence_output({
      score,
      chord_sequence: repaired.chord_sequence,
      time_spans: timeSpans,
      key_confidence: keyConfidence,
      omr_confidence: omrConfidence,
    });

    const tExplanation = Date.now();
    const explanations: Explanation[] = [];
    if (config.generate_explanations !== false) {
      for (let spanIndex = 0; spanIndex < repaired.chord_sequence.length; spanIndex++) {
        try {
          const explanation = await this.explanation_module.generate({
            score,
            chord_sequence: repaired.chord_sequence,
            lattice,
            span_index: spanIndex,
            phrase_boundaries: phraseBoundaries,
            key: keySequence[Math.min(spanIndex, keySequence.length - 1)]?.key,
            mode: keySequence[Math.min(spanIndex, keySequence.length - 1)]?.mode,
          });
          explanations.push(explanation);
        } catch (error) {
          warnings.push(`Explanation generation failed at span ${spanIndex}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    stageTiming.explanation_ms = Date.now() - tExplanation;

    const tOutput = Date.now();
    let annotatedMusicXml: string | undefined;
    if (config.original_musicxml) {
      try {
        annotatedMusicXml = this.output_module.output(config.original_musicxml, score);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        const fallback = this.degradation_strategy.rendering_service_fallback({
          musicxml: config.original_musicxml,
          score,
        });
        warnings.push(...fallback.warnings);
        annotatedMusicXml = fallback.musicxml;
      }
    }
    stageTiming.output_ms = Date.now() - tOutput;

    const cacheStats = this.cache.get_stats();
    const monitoring: PipelineMonitoring = {
      execution_ms: Date.now() - startedAt,
      stage_timing: stageTiming,
      cache_hit_rates: cache_hit_rates(cacheStats),
      confidence_score: confidence.overall_confidence,
      error_count: errors.length,
      warning_count: warnings.length,
    };

    if (this.log_cache_stats) {
      console.log(`[HarmonyEnginePipeline] cache: ${JSON.stringify(cacheStats)}`);
    }
    if (this.log_monitoring) {
      console.log(`[HarmonyEnginePipeline] monitoring: ${JSON.stringify(monitoring)}`);
    }

    return {
      score,
      time_spans: timeSpans,
      phrase_boundaries: phraseBoundaries,
      key_sequence: keySequence,
      functional_states: functionalStates,
      total_score: decoded.total_score,
      repair_operations: repaired.operations,
      confidence,
      chord_sequence: repaired.chord_sequence,
      lattice,
      explanations,
      annotated_musicxml: annotatedMusicXml,
      monitoring,
      metadata: {
        input_type: config.input_type ?? 'score',
        difficulty: config.difficulty,
        style: config.style,
        mode: keySequence[0]?.mode,
        degraded: warnings.length > 0,
        warnings,
        errors,
        omr_report: config.omr_confidence_report,
      },
    };
  }

  get_cache_stats(): ReturnType<HarmonyCache['get_stats']> {
    return this.cache.get_stats();
  }

  private apply_preferences(
    lattice: CandidateLattice,
    userProfile?: PreferenceProfile,
    institutionProfile?: PreferenceProfile,
    previousChord?: string,
  ): void {
    if (!userProfile && !institutionProfile) {
      return;
    }

    let previous = previousChord;
    for (let spanIndex = 0; spanIndex < lattice.candidates.length; spanIndex++) {
      const row = lattice.get_candidates(spanIndex);
      if (row.length === 0) continue;

      const reranked = this.preference_loop.rerank_candidates(row, {
        user_profile: userProfile,
        institution_profile: institutionProfile,
        previous_chord: previous,
      });

      row.splice(0, row.length, ...reranked);
      previous = row[0]?.roman_numeral ?? previous;
    }
  }

  private make_tonic_candidate(
    keyContext: { key: string; mode: SupportedMode } | undefined,
    difficulty: DifficultyLevel,
  ): ChordCandidate {
    const { root, accidental } = parse_key(keyContext?.key ?? 'C');
    const mode = keyContext?.mode ?? 'major';
    const roman = mode === 'minor' ? 'i' : 'I';

    return {
      local_key: `${root}${accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : ''} ${mode}`,
      mode,
      roman_numeral: roman,
      function: 'tonic',
      root,
      root_accidental: accidental,
      quality: mode === 'minor' ? 'minor' : 'major',
      inversion: 'root',
      extensions: [],
      alterations: [],
      confidence: 0.5,
      difficulty,
      source: 'rule',
      explanation: 'Fallback tonic candidate generated for degraded mode.',
      melody_coverage: 0.5,
      beat_alignment: 0.5,
      function_fit: 0.8,
      style_fit: 0.5,
    };
  }

  private build_fallback_lattice(
    timeSpans: TimeSpan[],
    keySequence: Array<{ key: string; mode: SupportedMode }>,
    difficulty: DifficultyLevel,
    primaryCandidate: ChordCandidate,
  ): CandidateLattice {
    const rows = timeSpans.map((_span, idx) => {
      const tonic = idx === 0 ? primaryCandidate : this.make_tonic_candidate(keySequence[Math.min(idx, keySequence.length - 1)], difficulty);
      return [tonic];
    });

    const lattice = new CandidateLattice(timeSpans, rows);
    for (let i = 0; i < timeSpans.length - 1; i++) {
      lattice.set_transition_score({
        from_span_index: i,
        from_candidate_index: 0,
        to_span_index: i + 1,
        to_candidate_index: 0,
      }, 0.6);
    }
    return lattice;
  }

  private partial_result(input: {
    input_type: HarmonyEngineInput['type'];
    config: HarmonyEnginePipelineConfig;
    warnings: string[];
    errors: string[];
    omr_report?: OMRConfidenceReport;
  }): HarmonyEnginePipelineResult {
    const score = empty_score();
    const lattice = new CandidateLattice([], []);
    const confidence = this.confidence_calibrator.compute_confidence_output({
      score,
      chord_sequence: [],
      time_spans: [],
      key_confidence: 0,
      omr_confidence: input.omr_report?.overall_confidence ?? input.config.omr_confidence,
    });

    return {
      score,
      time_spans: [],
      phrase_boundaries: [],
      key_sequence: [],
      functional_states: [],
      total_score: 0,
      repair_operations: [],
      confidence,
      chord_sequence: [],
      lattice,
      explanations: [],
      annotated_musicxml: input.config.original_musicxml,
      monitoring: {
        execution_ms: 0,
        stage_timing: {
          note_salience_ms: 0,
          phrase_segmentation_ms: 0,
          key_sequence_ms: 0,
          rhythm_ms: 0,
          state_tracking_ms: 0,
          lattice_ms: 0,
          decode_ms: 0,
          repair_ms: 0,
          explanation_ms: 0,
          output_ms: 0,
        },
        cache_hit_rates: cache_hit_rates(this.cache.get_stats()),
        confidence_score: confidence.overall_confidence,
        error_count: input.errors.length,
        warning_count: input.warnings.length,
      },
      metadata: {
        input_type: input.input_type,
        difficulty: input.config.difficulty,
        style: input.config.style,
        mode: input.config.mode ? this.mode_config.map_to_supported_mode(input.config.mode) : undefined,
        degraded: true,
        warnings: input.warnings,
        errors: input.errors,
        omr_report: input.omr_report,
      },
    };
  }

  private score_fingerprint(score: Score): object {
    return {
      key: score.key,
      time: score.time,
      measures: score.measures.map((measure) => ({
        number: measure.number,
        events: measure.events.map((event) => (
          event.type === 'note'
            ? {
              type: 'note',
              step: event.pitch.step,
              accidental: event.pitch.accidental,
              octave: event.pitch.octave,
              duration: event.duration,
              dots: event.dots,
              beat: event.beat,
            }
            : {
              type: 'rest',
              duration: event.duration,
              dots: event.dots,
              beat: event.beat,
            }
        )),
      })),
    };
  }

  private write_to_score(score: Score, sequence: ChordCandidate[], timeSpans: TimeSpan[]): void {
    for (const measure of score.measures) {
      measure.chords = [];
    }

    for (let i = 0; i < sequence.length; i++) {
      const candidate = sequence[i];
      const span = timeSpans[i];
      const targetMeasure = score.measures.find((measure) => {
        const start = measure_start_time(score, measure.number);
        const end = start + score.time.beats * (4 / score.time.beatType);
        return span[0] >= start && span[0] < end;
      });

      if (!targetMeasure) {
        continue;
      }

      const measureStart = measure_start_time(score, targetMeasure.number);
      const beat = Math.max(0, span[0] - measureStart);
      targetMeasure.chords.push(to_chord_symbol(candidate, beat));
    }
  }
}
