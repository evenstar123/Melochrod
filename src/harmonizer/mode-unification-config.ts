import type { SupportedMode } from '../core/harmony-types.js';

function normalize_pc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

const SUPPORTED_MODES: SupportedMode[] = ['major', 'minor', 'mixolydian', 'lydian', 'phrygian', 'dorian'];

const MODE_INTERVALS: Record<SupportedMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const CHARACTERISTIC_DEGREES: Record<SupportedMode, number[]> = {
  major: [4, 11],
  minor: [3, 8],
  mixolydian: [10],
  lydian: [6],
  phrygian: [1],
  dorian: [9],
};

const MODE_ALIASES: Record<string, SupportedMode> = {
  ionian: 'major',
  aeolian: 'minor',
  melodic_minor: 'minor',
  harmonic_minor: 'minor',
  locrian: 'phrygian',
};

export class ModeUnificationConfig {
  readonly supported_modes: SupportedMode[] = [...SUPPORTED_MODES];
  readonly mode_intervals: Record<SupportedMode, number[]> = MODE_INTERVALS;
  readonly characteristic_scale_degrees: Record<SupportedMode, number[]> = CHARACTERISTIC_DEGREES;

  map_to_supported_mode(mode: string | SupportedMode): SupportedMode {
    const normalized = mode.trim().toLowerCase().replace(/\s+/g, '_');
    if (this.supported_modes.includes(normalized as SupportedMode)) {
      return normalized as SupportedMode;
    }
    return MODE_ALIASES[normalized] ?? 'major';
  }

  mode_characteristic_bonus(
    mode: SupportedMode,
    tonic_pc: number,
    pitch_class_distribution: number[],
  ): number {
    const characteristicPcs = this.characteristic_scale_degrees[mode].map((degree) => normalize_pc(tonic_pc + degree));
    const score = characteristicPcs.reduce((sum, pc) => sum + (pitch_class_distribution[pc] ?? 0), 0);
    return Math.max(0, Math.min(1, score));
  }

  closest_supported_mode_from_scale(scale_pcs: number[]): SupportedMode {
    if (scale_pcs.length === 0) {
      return 'major';
    }
    const normalized = new Set(scale_pcs.map(normalize_pc));

    let bestMode: SupportedMode = 'major';
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const mode of this.supported_modes) {
      const template = new Set(this.mode_intervals[mode].map(normalize_pc));
      const intersection = [...normalized].filter((pc) => template.has(pc)).length;
      const union = new Set([...normalized, ...template]).size;
      const score = union === 0 ? 0 : intersection / union;
      if (score > bestScore) {
        bestScore = score;
        bestMode = mode;
      }
    }

    return bestMode;
  }
}

