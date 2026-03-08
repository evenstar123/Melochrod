import type { ChordQuality, Mode, NoteLetter, Accidental } from './types.js';

export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced';
export type SupportedMode = Mode | 'mixolydian' | 'lydian' | 'phrygian' | 'dorian';
export type HarmonyFunction =
  | 'tonic'
  | 'subdominant'
  | 'dominant'
  | 'cadence_preparation'
  | 'cadence_resolution'
  | 'modal_mixture'
  | 'transition';

export type CandidateSource = 'rule' | 'retrieval' | 'model';
export type TimeSpan = readonly [number, number];

export interface HarmonyAnnotationInit {
  local_key: string;
  mode: SupportedMode;
  roman_numeral: string;
  function: HarmonyFunction;
  root: NoteLetter;
  root_accidental?: Accidental;
  quality: ChordQuality;
  inversion?: string;
  bass?: string;
  extensions?: string[];
  alterations?: string[];
  start_time: number;
  end_time: number;
  confidence?: number;
  difficulty?: DifficultyLevel;
  cadence_role?: 'none' | 'half' | 'authentic' | 'deceptive';
  explanation?: string;
}

/**
 * Dual-layer harmony annotation: functional + surface representation.
 */
export class HarmonyAnnotation {
  local_key: string;
  mode: SupportedMode;
  roman_numeral: string;
  function: HarmonyFunction;

  root: NoteLetter;
  root_accidental: Accidental;
  quality: ChordQuality;
  inversion: string;
  bass?: string;
  extensions: string[];
  alterations: string[];

  start_time: number;
  end_time: number;

  confidence: number;
  difficulty: DifficultyLevel;
  cadence_role: 'none' | 'half' | 'authentic' | 'deceptive';
  explanation: string;

  constructor(init: HarmonyAnnotationInit) {
    this.local_key = init.local_key;
    this.mode = init.mode;
    this.roman_numeral = init.roman_numeral;
    this.function = init.function;

    this.root = init.root;
    this.root_accidental = init.root_accidental ?? 'none';
    this.quality = init.quality;
    this.inversion = init.inversion ?? 'root';
    this.bass = init.bass;
    this.extensions = init.extensions ?? [];
    this.alterations = init.alterations ?? [];

    this.start_time = init.start_time;
    this.end_time = init.end_time;

    this.confidence = init.confidence ?? 0.5;
    this.difficulty = init.difficulty ?? 'intermediate';
    this.cadence_role = init.cadence_role ?? 'none';
    this.explanation = init.explanation ?? '';
  }

  to_chord_symbol(): string {
    const accidental =
      this.root_accidental === 'sharp' ? '#' :
      this.root_accidental === 'flat' ? 'b' :
      this.root_accidental === 'double-sharp' ? '##' :
      this.root_accidental === 'double-flat' ? 'bb' :
      '';

    const qualitySuffix: Record<ChordQuality, string> = {
      major: '',
      minor: 'm',
      diminished: 'dim',
      augmented: 'aug',
      dominant7: '7',
      major7: 'maj7',
      minor7: 'm7',
      diminished7: 'dim7',
      'half-dim7': 'm7b5',
      sus2: 'sus2',
      sus4: 'sus4',
    };

    const ext = this.extensions.length > 0 ? `(${this.extensions.join(',')})` : '';
    const alt = this.alterations.length > 0 ? `(${this.alterations.join(',')})` : '';
    const slash = this.bass ? `/${this.bass}` : '';

    return `${this.root}${accidental}${qualitySuffix[this.quality]}${ext}${alt}${slash}`;
  }

  to_roman_numeral_symbol(): string {
    const inv = this.inversion === 'root' ? '' : `/${this.inversion}`;
    return `${this.roman_numeral}${inv}`;
  }
}

export interface ChordCandidate {
  local_key: string;
  mode: SupportedMode;
  roman_numeral: string;
  function: HarmonyFunction;

  root: NoteLetter;
  root_accidental: Accidental;
  quality: ChordQuality;
  inversion: string;
  bass?: string;
  extensions: string[];
  alterations: string[];

  confidence: number;
  difficulty: DifficultyLevel;
  source: CandidateSource;
  explanation: string;

  melody_coverage: number;
  beat_alignment: number;
  function_fit: number;
  style_fit: number;
}

export interface CandidateLatticeTransitionQuery {
  from_span_index: number;
  from_candidate_index: number;
  to_span_index: number;
  to_candidate_index: number;
}

export class CandidateLattice {
  readonly time_spans: TimeSpan[];
  readonly candidates: ChordCandidate[][];
  private readonly transition_scores: Record<string, number>;

  constructor(
    timeSpans: TimeSpan[],
    candidates: ChordCandidate[][],
    transitionScores: Record<string, number> = {},
  ) {
    if (timeSpans.length !== candidates.length) {
      throw new Error('time_spans length must match candidates length');
    }
    this.time_spans = timeSpans;
    this.candidates = candidates;
    this.transition_scores = { ...transitionScores };
  }

  get_candidates(spanIndex: number): ChordCandidate[] {
    return this.candidates[spanIndex] ?? [];
  }

  set_transition_score(query: CandidateLatticeTransitionQuery, score: number): void {
    this.transition_scores[this.key_of(query)] = score;
  }

  get_transition_score(query: CandidateLatticeTransitionQuery): number {
    return this.transition_scores[this.key_of(query)] ?? 0;
  }

  to_transition_score_map(): Record<string, number> {
    return { ...this.transition_scores };
  }

  private key_of(query: CandidateLatticeTransitionQuery): string {
    return `${query.from_span_index}:${query.from_candidate_index}->${query.to_span_index}:${query.to_candidate_index}`;
  }
}