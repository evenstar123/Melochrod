import type { Score } from '../core/types.js';
import type { SupportedMode } from '../core/harmony-types.js';
import { ACCIDENTAL_OFFSET, NOTE_TO_SEMITONE } from '../core/constants.js';
import { events_in_span, flatten_timed_notes, total_duration } from '../core/music-time.js';
import { ModeUnificationConfig } from '../harmonizer/mode-unification-config.js';

export interface KeyInfo {
  key: string;
  mode: SupportedMode;
  confidence: number;
  start_time: number;
  end_time: number;
}

interface CandidateKey {
  tonic_pc: number;
  tonic_label: string;
  mode: SupportedMode;
  score: number;
}

const MODE_INTERVALS: Record<SupportedMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const TONE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function normalize_pc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

function is_related_key(from: CandidateKey, to: CandidateKey): boolean {
  const diff = normalize_pc(to.tonic_pc - from.tonic_pc);
  const relatedByFifth = diff === 5 || diff === 7;
  const relatedByRelative =
    (from.mode === 'major' && to.mode === 'minor' && diff === 9) ||
    (from.mode === 'minor' && to.mode === 'major' && diff === 3);
  return relatedByFifth || relatedByRelative;
}

export class KeySequenceAnalyzer {
  private readonly mode_config = new ModeUnificationConfig();

  normalize_mode(mode: string): SupportedMode {
    return this.mode_config.map_to_supported_mode(mode);
  }

  analyze(score: Score, window_beats = 8): KeyInfo[] {
    const duration = total_duration(score);
    const windows: Array<readonly [number, number]> = [];

    for (let start = 0; start < duration - 1e-6; start += window_beats) {
      windows.push([start, Math.min(duration, start + window_beats)]);
    }

    const keyScores = windows.map((window) => this._compute_key_scores(score, window));
    const decoded = this._viterbi_key_sequence(keyScores);

    return decoded.map((candidate, index) => ({
      key: candidate.tonic_label,
      mode: this.mode_config.map_to_supported_mode(candidate.mode),
      confidence: Math.max(0, Math.min(1, candidate.score)),
      start_time: windows[index][0],
      end_time: windows[index][1],
    }));
  }

  private _compute_key_scores(score: Score, window: readonly [number, number]): CandidateKey[] {
    const notes = events_in_span(flatten_timed_notes(score), window);
    if (notes.length === 0) {
      return [{ tonic_pc: 0, tonic_label: 'C', mode: 'major', score: 0.3 }];
    }

    const distribution = new Array(12).fill(0);
    for (const note of notes) {
      const pc = normalize_pc(NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental]);
      const salience = note.event.salience ?? 0.5;
      distribution[pc] += 0.5 + salience;
    }

    const total = distribution.reduce((sum, value) => sum + value, 0);
    const normalized = distribution.map((value) => value / Math.max(1e-6, total));

    const candidates: CandidateKey[] = [];
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      for (const mode of this.mode_config.supported_modes) {
        const profile = new Array(12).fill(0.1);
        for (const degree of MODE_INTERVALS[mode]) {
          profile[normalize_pc(tonicPc + degree)] = 1.0;
        }

        const profileTotal = profile.reduce((sum, value) => sum + value, 0);
        const normalizedProfile = profile.map((value) => value / profileTotal);

        const pitchClassScore = normalized.reduce((sum, value, idx) => sum + value * normalizedProfile[idx], 0);

        const impliedHarmony = this.implied_harmony_bonus(notes, tonicPc, mode);
        const cadenceCue = this.cadence_bonus(notes, tonicPc, mode);
        const accidentalHint = this.accidental_modulation_hint(notes, tonicPc, mode);
        const tonicAnchor = this.tonic_anchor_bonus(notes, tonicPc);

        const characteristicBonus = this.mode_config.mode_characteristic_bonus(mode, tonicPc, normalized);
        const tonalPrior = mode === 'major' || mode === 'minor' ? 0.03 : 0;
        const modalPenalty = mode === 'major' || mode === 'minor' ? 0 : 0.015;
        const score = (
          0.4 * pitchClassScore +
          0.2 * impliedHarmony +
          0.15 * cadenceCue +
          0.1 * accidentalHint +
          0.1 * tonicAnchor +
          0.02 * characteristicBonus +
          tonalPrior -
          modalPenalty
        );

        candidates.push({
          tonic_pc: tonicPc,
          tonic_label: TONE_NAMES[tonicPc],
          mode,
          score,
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
  }

  private _viterbi_key_sequence(windows: CandidateKey[][]): CandidateKey[] {
    if (windows.length === 0) {
      return [];
    }

    const dp: number[][] = windows.map((row) => Array(row.length).fill(Number.NEGATIVE_INFINITY));
    const back: number[][] = windows.map((row) => Array(row.length).fill(-1));

    const primaryStart = windows[0][0];
    for (let i = 0; i < windows[0].length; i++) {
      const candidate = windows[0][i];
      const startBias = candidate.tonic_pc === primaryStart.tonic_pc && candidate.mode === primaryStart.mode ? 0.2 : 0;
      dp[0][i] = candidate.score + startBias;
    }

    for (let t = 1; t < windows.length; t++) {
      for (let i = 0; i < windows[t].length; i++) {
        const current = windows[t][i];

        for (let j = 0; j < windows[t - 1].length; j++) {
          const previous = windows[t - 1][j];
          const sameKey = previous.tonic_pc === current.tonic_pc && previous.mode === current.mode;
          const inertia = sameKey ? 0.35 : 0;

          const distance = Math.min(
            normalize_pc(current.tonic_pc - previous.tonic_pc),
            normalize_pc(previous.tonic_pc - current.tonic_pc),
          );
          const distantPenalty = distance >= 5 ? 0.3 : 0.1;
          const modulationPenalty = sameKey ? 0 : (is_related_key(previous, current) ? distantPenalty * 0.5 : distantPenalty);

          const score = dp[t - 1][j] + current.score + inertia - modulationPenalty;
          if (score > dp[t][i]) {
            dp[t][i] = score;
            back[t][i] = j;
          }
        }
      }
    }

    let lastIndex = 0;
    const finalRow = dp[dp.length - 1];
    for (let i = 1; i < finalRow.length; i++) {
      if (finalRow[i] > finalRow[lastIndex]) {
        lastIndex = i;
      }
    }

    const sequence: CandidateKey[] = [];
    for (let t = windows.length - 1; t >= 0; t--) {
      sequence.unshift(windows[t][lastIndex]);
      lastIndex = back[t][lastIndex];
      if (lastIndex < 0 && t > 0) {
        lastIndex = 0;
      }
    }

    return sequence;
  }

  private implied_harmony_bonus(
    notes: ReturnType<typeof flatten_timed_notes>,
    tonicPc: number,
    mode: SupportedMode,
  ): number {
    const triad = mode === 'minor' ? [0, 3, 7] : [0, 4, 7];
    if (notes.length === 0) return 0.5;

    const ratio = notes.filter((note) => {
      const pc = normalize_pc(NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental] - tonicPc);
      return triad.includes(pc);
    }).length / notes.length;

    return ratio;
  }

  private cadence_bonus(
    notes: ReturnType<typeof flatten_timed_notes>,
    tonicPc: number,
    mode: SupportedMode,
  ): number {
    if (notes.length < 2) return 0.5;

    const tail = notes.slice(-2);
    const pcs = tail.map((note) => normalize_pc(NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental]));
    const dominantPc = normalize_pc(tonicPc + 7);
    const leadingTone = mode === 'minor' ? normalize_pc(tonicPc + 11) : normalize_pc(tonicPc + 11);

    const hasDominant = pcs.includes(dominantPc);
    const resolvesToTonic = pcs[pcs.length - 1] === tonicPc;
    const hasLeading = pcs.includes(leadingTone);

    if (hasDominant && resolvesToTonic) return 1;
    if (hasLeading && resolvesToTonic) return 0.85;
    return 0.4;
  }

  private accidental_modulation_hint(
    notes: ReturnType<typeof flatten_timed_notes>,
    tonicPc: number,
    mode: SupportedMode,
  ): number {
    if (notes.length === 0) return 0.5;

    const scale = MODE_INTERVALS[mode];
    const inScaleRatio = notes.filter((note) => {
      const pc = normalize_pc(NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental] - tonicPc);
      return scale.includes(pc);
    }).length / notes.length;

    return inScaleRatio;
  }

  private tonic_anchor_bonus(
    notes: ReturnType<typeof flatten_timed_notes>,
    tonicPc: number,
  ): number {
    if (notes.length === 0) return 0.5;

    const first = notes[0];
    const last = notes[notes.length - 1];
    const firstPc = normalize_pc(NOTE_TO_SEMITONE[first.event.pitch.step] + ACCIDENTAL_OFFSET[first.event.pitch.accidental]);
    const lastPc = normalize_pc(NOTE_TO_SEMITONE[last.event.pitch.step] + ACCIDENTAL_OFFSET[last.event.pitch.accidental]);

    const tonicPresence = notes.filter((note) => {
      const pc = normalize_pc(NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental]);
      return pc === tonicPc;
    }).length / notes.length;

    let bonus = 0.3 * tonicPresence;
    if (firstPc === tonicPc) bonus += 0.35;
    if (lastPc === tonicPc) bonus += 0.35;

    return Math.min(1, bonus);
  }
}
