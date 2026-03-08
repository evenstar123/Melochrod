import type { ChordCandidate } from '../core/harmony-types.js';

export interface StyleProfile {
  name: string;
  description: string;
  common_progressions: string[][];
  preferred_chords: string[];
  allow_extensions: boolean;
  secondary_dominants_weight: number;
  transition_matrix: Record<string, Record<string, number>>;
}

function make_matrix(common_progressions: string[][], base = 0.3): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};

  for (const progression of common_progressions) {
    for (let i = 1; i < progression.length; i++) {
      const from = progression[i - 1];
      const to = progression[i];
      if (!matrix[from]) {
        matrix[from] = {};
      }
      matrix[from][to] = Math.max(matrix[from][to] ?? 0, 0.9);
    }
  }

  const allRomans = new Set(common_progressions.flat());
  for (const from of allRomans) {
    matrix[from] = matrix[from] ?? {};
    for (const to of allRomans) {
      matrix[from][to] = matrix[from][to] ?? base;
    }
  }

  return matrix;
}

const STYLE_PROFILES: Record<string, StyleProfile> = {
  pop: {
    name: 'pop',
    description: 'Pop profile emphasizing loopable progressions.',
    common_progressions: [
      ['I', 'V', 'vi', 'IV'],
      ['vi', 'IV', 'I', 'V'],
      ['ii', 'V', 'I'],
    ],
    preferred_chords: ['I', 'V', 'vi', 'IV', 'ii'],
    allow_extensions: false,
    secondary_dominants_weight: 0.2,
    transition_matrix: make_matrix([
      ['I', 'V', 'vi', 'IV'],
      ['vi', 'IV', 'I', 'V'],
      ['ii', 'V', 'I'],
    ], 0.35),
  },
  hymn: {
    name: 'hymn',
    description: 'Traditional four-part harmony profile with strong cadence behavior.',
    common_progressions: [
      ['I', 'IV', 'V', 'I'],
      ['I', 'ii', 'V', 'I'],
      ['I', 'vi', 'ii', 'V', 'I'],
    ],
    preferred_chords: ['I', 'IV', 'V', 'ii', 'vi'],
    allow_extensions: false,
    secondary_dominants_weight: 0.15,
    transition_matrix: make_matrix([
      ['I', 'IV', 'V', 'I'],
      ['I', 'ii', 'V', 'I'],
      ['I', 'vi', 'ii', 'V', 'I'],
    ], 0.3),
  },
  'classical-lite': {
    name: 'classical-lite',
    description: 'Functional-harmony-forward profile with voice-leading-friendly movement.',
    common_progressions: [
      ['I', 'IV', 'V', 'I'],
      ['I', 'ii', 'V', 'I'],
      ['I', 'vi', 'ii', 'V', 'I'],
    ],
    preferred_chords: ['I', 'ii', 'IV', 'V', 'vi', 'viio'],
    allow_extensions: true,
    secondary_dominants_weight: 0.35,
    transition_matrix: make_matrix([
      ['I', 'ii', 'V', 'I'],
      ['I', 'IV', 'V', 'I'],
      ['ii', 'V', 'I'],
      ['V', 'vi'],
    ], 0.32),
  },
  'jazz-lite': {
    name: 'jazz-lite',
    description: 'Extended and substitutive harmony profile with richer color tones.',
    common_progressions: [
      ['ii7', 'V7', 'Imaj7'],
      ['Imaj7', 'vi7', 'ii7', 'V7'],
      ['I', 'bVII', 'IV'],
    ],
    preferred_chords: ['ii7', 'V7', 'Imaj7', 'vi7', 'IVmaj7', 'I'],
    allow_extensions: true,
    secondary_dominants_weight: 0.5,
    transition_matrix: make_matrix([
      ['ii7', 'V7', 'Imaj7'],
      ['Imaj7', 'vi7', 'ii7', 'V7'],
      ['I', 'bVII', 'IV'],
    ], 0.36),
  },
};

export class StyleControlSystem {
  get_profile(style: string): StyleProfile {
    return STYLE_PROFILES[style] ?? STYLE_PROFILES.pop;
  }

  get_transition_matrix(style: string): Record<string, Record<string, number>> {
    return this.get_profile(style).transition_matrix;
  }

  get_transition_probability(style: string, from_roman: string, to_roman: string): number | undefined {
    return this.get_profile(style).transition_matrix[from_roman]?.[to_roman];
  }

  apply_style_weighting(style: string, candidates: ChordCandidate[]): ChordCandidate[] {
    const profile = this.get_profile(style);

    return candidates.map((candidate) => {
      let styleFit = candidate.style_fit;
      let confidence = candidate.confidence;

      if (profile.preferred_chords.includes(candidate.roman_numeral)) {
        styleFit = Math.min(1, styleFit + 0.2);
        confidence = Math.min(1, confidence + 0.08);
      }

      const hasExtension = candidate.extensions.length > 0 || candidate.alterations.length > 0;
      if (hasExtension && !profile.allow_extensions) {
        styleFit = Math.max(0, styleFit - 0.25);
        confidence = Math.max(0, confidence - 0.1);
      }
      if (hasExtension && profile.allow_extensions) {
        styleFit = Math.min(1, styleFit + 0.15);
        confidence = Math.min(1, confidence + 0.06);
      }

      if (/V\//.test(candidate.roman_numeral)) {
        confidence = Math.min(1, confidence + profile.secondary_dominants_weight * 0.1);
      }

      return {
        ...candidate,
        style_fit: styleFit,
        confidence,
      };
    });
  }
}

