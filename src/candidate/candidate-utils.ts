import type { ChordQuality, NoteLetter, Accidental } from '../core/types.js';
import type {
  ChordCandidate,
  DifficultyLevel,
  HarmonyFunction,
  SupportedMode,
} from '../core/harmony-types.js';
import { ACCIDENTAL_OFFSET, NOTE_TO_SEMITONE } from '../core/constants.js';

const SHARP_NAMES: Array<{ step: NoteLetter; accidental: Accidental }> = [
  { step: 'C', accidental: 'none' },
  { step: 'C', accidental: 'sharp' },
  { step: 'D', accidental: 'none' },
  { step: 'D', accidental: 'sharp' },
  { step: 'E', accidental: 'none' },
  { step: 'F', accidental: 'none' },
  { step: 'F', accidental: 'sharp' },
  { step: 'G', accidental: 'none' },
  { step: 'G', accidental: 'sharp' },
  { step: 'A', accidental: 'none' },
  { step: 'A', accidental: 'sharp' },
  { step: 'B', accidental: 'none' },
];

const FLAT_NAMES: Array<{ step: NoteLetter; accidental: Accidental }> = [
  { step: 'C', accidental: 'none' },
  { step: 'D', accidental: 'flat' },
  { step: 'D', accidental: 'none' },
  { step: 'E', accidental: 'flat' },
  { step: 'E', accidental: 'none' },
  { step: 'F', accidental: 'none' },
  { step: 'G', accidental: 'flat' },
  { step: 'G', accidental: 'none' },
  { step: 'A', accidental: 'flat' },
  { step: 'A', accidental: 'none' },
  { step: 'B', accidental: 'flat' },
  { step: 'B', accidental: 'none' },
];

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function normalize_pc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

export function key_string(step: NoteLetter, accidental: Accidental, mode: SupportedMode): string {
  const acc = accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : '';
  return `${step}${acc} ${mode}`;
}

export function key_tonic_pc(
  tonic: NoteLetter,
  accidental: Accidental,
): number {
  return normalize_pc(NOTE_TO_SEMITONE[tonic] + ACCIDENTAL_OFFSET[accidental]);
}

export function note_name_from_pc(pc: number, preferSharps: boolean): { step: NoteLetter; accidental: Accidental } {
  const index = normalize_pc(pc);
  return (preferSharps ? SHARP_NAMES : FLAT_NAMES)[index];
}

export function roman_to_degree(romanNumeral: string): number | null {
  const normalized = romanNumeral
    .replace(/^[b#]+/, '')
    .replace(/[0-9]+/g, '')
    .replace(/o|ø|\+/gi, '')
    .replace(/\/.+$/, '');

  const upper = normalized.toUpperCase();
  if (upper === 'I') return 1;
  if (upper === 'II') return 2;
  if (upper === 'III') return 3;
  if (upper === 'IV') return 4;
  if (upper === 'V') return 5;
  if (upper === 'VI') return 6;
  if (upper === 'VII') return 7;
  return null;
}

export function roman_to_quality(romanNumeral: string): ChordQuality {
  if (/ø/.test(romanNumeral)) return 'half-dim7';
  if (/o|dim/i.test(romanNumeral)) return 'diminished';
  if (/maj7/i.test(romanNumeral)) return 'major7';
  if (/7/.test(romanNumeral)) {
    if (/^[iv]+7$/.test(romanNumeral)) {
      return 'minor7';
    }
    return 'dominant7';
  }

  const diatonicPart = romanNumeral.replace(/^[b#]+/, '').replace(/[0-9øo+]/gi, '');
  return diatonicPart === diatonicPart.toLowerCase() ? 'minor' : 'major';
}

export function function_from_roman(romanNumeral: string): HarmonyFunction {
  const degree = roman_to_degree(romanNumeral);
  if (degree === 1 || degree === 3 || degree === 6) {
    return 'tonic';
  }
  if (degree === 2 || degree === 4) {
    return 'subdominant';
  }
  if (degree === 5 || degree === 7) {
    return 'dominant';
  }
  return 'transition';
}

export function candidate_from_roman(params: {
  roman_numeral: string;
  tonic: NoteLetter;
  tonic_accidental: Accidental;
  mode: SupportedMode;
  difficulty: DifficultyLevel;
  source: 'rule' | 'retrieval' | 'model';
  confidence?: number;
  explanation?: string;
  melody_coverage?: number;
  beat_alignment?: number;
  function_fit?: number;
  style_fit?: number;
}): ChordCandidate | null {
  const degree = roman_to_degree(params.roman_numeral);
  if (!degree) {
    return null;
  }

  const scale = params.mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const tonicPc = key_tonic_pc(params.tonic, params.tonic_accidental);
  const pc = tonicPc + scale[degree - 1];

  const preferSharps = params.tonic_accidental !== 'flat';
  const noteName = note_name_from_pc(pc, preferSharps);
  const quality = roman_to_quality(params.roman_numeral);

  return {
    local_key: key_string(params.tonic, params.tonic_accidental, params.mode),
    mode: params.mode,
    roman_numeral: params.roman_numeral,
    function: function_from_roman(params.roman_numeral),
    root: noteName.step,
    root_accidental: noteName.accidental,
    quality,
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence: params.confidence ?? 0.6,
    difficulty: params.difficulty,
    source: params.source,
    explanation: params.explanation ?? '',
    melody_coverage: params.melody_coverage ?? 0.5,
    beat_alignment: params.beat_alignment ?? 0.5,
    function_fit: params.function_fit ?? 0.5,
    style_fit: params.style_fit ?? 0.5,
  };
}

export function candidate_id(candidate: ChordCandidate): string {
  return [
    candidate.local_key,
    candidate.roman_numeral,
    candidate.root,
    candidate.root_accidental,
    candidate.quality,
    candidate.inversion,
    candidate.extensions.join('.'),
    candidate.alterations.join('.'),
  ].join('|');
}
