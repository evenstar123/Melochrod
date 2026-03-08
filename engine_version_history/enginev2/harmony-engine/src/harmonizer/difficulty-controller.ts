import type { ChordCandidate, DifficultyLevel } from '../core/harmony-types.js';

export interface DifficultyConstraint {
  allowed_roman_numerals: string[] | 'all';
  allowed_qualities: string[] | 'all';
  max_extension: number;
  allow_inversions: boolean;
  allow_secondary_dominants: boolean;
  allow_modal_mixture: boolean;
  rhythm_density: number;
}

export const difficulty_constraints: Record<DifficultyLevel, DifficultyConstraint> = {
  basic: {
    allowed_roman_numerals: ['I', 'IV', 'V', 'vi', 'i', 'iv', 'v', 'VI'],
    allowed_qualities: ['major', 'minor'],
    max_extension: 0,
    allow_inversions: false,
    allow_secondary_dominants: false,
    allow_modal_mixture: false,
    rhythm_density: 1.0,
  },
  intermediate: {
    allowed_roman_numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio', 'i', 'iio', 'III', 'iv', 'v', 'VI', 'VII'],
    allowed_qualities: ['major', 'minor', 'dominant7', 'major7', 'minor7', 'diminished'],
    max_extension: 7,
    allow_inversions: true,
    allow_secondary_dominants: false,
    allow_modal_mixture: false,
    rhythm_density: 2.0,
  },
  advanced: {
    allowed_roman_numerals: 'all',
    allowed_qualities: 'all',
    max_extension: 13,
    allow_inversions: true,
    allow_secondary_dominants: true,
    allow_modal_mixture: true,
    rhythm_density: 4.0,
  },
};

function max_extension_degree(extensions: string[]): number {
  if (extensions.length === 0) {
    return 0;
  }

  let maxDegree = 0;
  for (const extension of extensions) {
    const match = extension.match(/(\d+)/);
    if (!match) {
      continue;
    }
    maxDegree = Math.max(maxDegree, Number(match[1]));
  }

  return maxDegree;
}

function is_secondary_dominant(romanNumeral: string): boolean {
  return /^V\/.+/i.test(romanNumeral);
}

function is_modal_mixture(romanNumeral: string): boolean {
  return /^[b#]/.test(romanNumeral);
}

export class DifficultyController {
  filter(candidates: ChordCandidate[], difficulty: DifficultyLevel): ChordCandidate[] {
    const constraints = difficulty_constraints[difficulty];

    return candidates.filter((candidate) => {
      if (
        constraints.allowed_roman_numerals !== 'all' &&
        !constraints.allowed_roman_numerals.includes(candidate.roman_numeral)
      ) {
        return false;
      }

      if (
        constraints.allowed_qualities !== 'all' &&
        !constraints.allowed_qualities.includes(candidate.quality)
      ) {
        return false;
      }

      if (max_extension_degree(candidate.extensions) > constraints.max_extension) {
        return false;
      }

      if (!constraints.allow_inversions && candidate.inversion !== 'root') {
        return false;
      }

      if (!constraints.allow_secondary_dominants && is_secondary_dominant(candidate.roman_numeral)) {
        return false;
      }

      if (!constraints.allow_modal_mixture && is_modal_mixture(candidate.roman_numeral)) {
        return false;
      }

      return true;
    });
  }

  adjust_weights(difficulty: DifficultyLevel): Record<string, number> {
    if (difficulty === 'basic') {
      return {
        melody_coverage: 0.5,
        key_match: 0.2,
        beat_alignment: 0.2,
        function_fit: 0.3,
        style_fit: 0.0,
        complexity_penalty: 0.0,
      };
    }

    if (difficulty === 'advanced') {
      return {
        melody_coverage: 0.25,
        key_match: 0.15,
        beat_alignment: 0.1,
        function_fit: 0.2,
        style_fit: 0.3,
        complexity_penalty: 0.3,
      };
    }

    return {
      melody_coverage: 0.35,
      key_match: 0.2,
      beat_alignment: 0.15,
      function_fit: 0.2,
      style_fit: 0.1,
      complexity_penalty: 0.1,
    };
  }
}
