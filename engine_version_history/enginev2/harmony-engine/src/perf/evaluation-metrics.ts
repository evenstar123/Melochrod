import type { ChordSymbol, Score } from '../core/types.js';
import type { TimeSpan } from '../core/harmony-types.js';
import { ACCIDENTAL_OFFSET, CHORD_TEMPLATES, NOTE_TO_SEMITONE } from '../core/constants.js';

export interface CadenceMetrics {
  precision: number;
  recall: number;
  f1: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
}

export interface UserAcceptanceRecord {
  accepted: boolean;
  corrections: number;
}

export interface UserAcceptanceMetrics {
  acceptance_rate: number;
  average_corrections: number;
}

function jaccard_similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function parse_root_pc(symbol: string): number | null {
  const match = symbol.trim().match(/^([A-G])([#b]?)/);
  if (!match) {
    return null;
  }
  const step = match[1] as keyof typeof NOTE_TO_SEMITONE;
  const accidental = match[2] === '#'
    ? 1
    : match[2] === 'b'
      ? -1
      : 0;
  return (NOTE_TO_SEMITONE[step] + accidental + 12) % 12;
}

function chord_pitch_classes(chord: ChordSymbol): Set<number> {
  const rootPc = (NOTE_TO_SEMITONE[chord.root] + ACCIDENTAL_OFFSET[chord.rootAccidental] + 12) % 12;
  const template = CHORD_TEMPLATES[chord.quality] ?? CHORD_TEMPLATES.major;
  return new Set(template.map((interval) => (rootPc + interval) % 12));
}

function is_dominant(symbol: string): boolean {
  const s = symbol.trim();
  return /^V7?$/i.test(s) || /^G7?$/i.test(s);
}

function is_tonic(symbol: string): boolean {
  const s = symbol.trim();
  return /^I$/i.test(s) || /^C$/i.test(s) || /^Am$/i.test(s);
}

export class EvaluationMetrics {
  compute_che(predicted: string[], ground_truth: string[]): number {
    const length = Math.max(predicted.length, ground_truth.length);
    if (length === 0) {
      return 0;
    }

    let mismatches = 0;
    for (let i = 0; i < length; i++) {
      if ((predicted[i] ?? '__MISSING__') !== (ground_truth[i] ?? '__MISSING__')) {
        mismatches += 1;
      }
    }
    return mismatches / length;
  }

  compute_cc(predicted: string[], ground_truth: string[]): number {
    const gt = new Set(ground_truth);
    if (gt.size === 0) {
      return 1;
    }
    const pred = new Set(predicted);
    const covered = [...gt].filter((chord) => pred.has(chord)).length;
    return covered / gt.size;
  }

  compute_ctd(predicted: string[], ground_truth: string[]): number {
    const predTransitions = new Set<string>();
    const gtTransitions = new Set<string>();

    for (let i = 1; i < predicted.length; i++) {
      predTransitions.add(`${predicted[i - 1]}->${predicted[i]}`);
    }
    for (let i = 1; i < ground_truth.length; i++) {
      gtTransitions.add(`${ground_truth[i - 1]}->${ground_truth[i]}`);
    }

    return 1 - jaccard_similarity(predTransitions, gtTransitions);
  }

  compute_ctnctr(score: Score): number {
    let chordTones = 0;
    let nonChordTones = 0;

    for (const measure of score.measures) {
      if (measure.chords.length === 0) {
        continue;
      }
      const sortedChords = [...measure.chords].sort((a, b) => a.beat - b.beat);

      for (const event of measure.events) {
        if (event.type !== 'note') {
          continue;
        }

        const active = sortedChords
          .filter((chord) => chord.beat <= event.beat)
          .slice(-1)[0] ?? sortedChords[0];

        const notePc = (NOTE_TO_SEMITONE[event.pitch.step] + ACCIDENTAL_OFFSET[event.pitch.accidental] + 12) % 12;
        const pcs = chord_pitch_classes(active);
        if (pcs.has(notePc)) {
          chordTones += 1;
        } else {
          nonChordTones += 1;
        }
      }
    }

    return chordTones / Math.max(1, nonChordTones);
  }

  compute_pcs(predicted: string[], ground_truth: string[]): number {
    const predSet = new Set<number>();
    const gtSet = new Set<number>();

    for (const chord of predicted) {
      const pc = parse_root_pc(chord);
      if (pc !== null) predSet.add(pc);
    }
    for (const chord of ground_truth) {
      const pc = parse_root_pc(chord);
      if (pc !== null) gtSet.add(pc);
    }

    if (predSet.size === 0 && gtSet.size === 0) {
      return 1;
    }
    const intersection = [...predSet].filter((pc) => gtSet.has(pc)).length;
    const union = new Set([...predSet, ...gtSet]).size;
    return union === 0 ? 0 : intersection / union;
  }

  compute_mctd(score: Score): number {
    let distanceSum = 0;
    let noteCount = 0;

    for (const measure of score.measures) {
      if (measure.chords.length === 0) {
        continue;
      }

      const beatsPerMeasure = (measure.timeChange ?? score.time).beats;
      for (const event of measure.events) {
        if (event.type !== 'note') {
          continue;
        }
        const minDistance = Math.min(...measure.chords.map((chord) => Math.abs(event.beat - chord.beat)));
        distanceSum += minDistance / Math.max(1, beatsPerMeasure);
        noteCount += 1;
      }
    }

    return noteCount === 0 ? 0 : distanceSum / noteCount;
  }

  compute_rhythm_complexity(time_spans: TimeSpan[]): number {
    if (time_spans.length <= 1) {
      return 0;
    }

    const lengths = time_spans.map((span) => Math.max(0.0001, span[1] - span[0]));
    const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
    const std = Math.sqrt(variance);
    return std / mean;
  }

  compute_harmonic_density(time_spans: TimeSpan[], total_duration: number): number {
    if (total_duration <= 0) {
      return 0;
    }
    const measuresEquivalent = total_duration / 4;
    return time_spans.length / Math.max(1, measuresEquivalent);
  }

  compute_cadence_metrics(predicted: string[], ground_truth: string[]): CadenceMetrics {
    const pred = new Set(this.detect_cadences(predicted));
    const truth = new Set(this.detect_cadences(ground_truth));

    const truePositives = [...pred].filter((idx) => truth.has(idx)).length;
    const falsePositives = pred.size - truePositives;
    const falseNegatives = truth.size - truePositives;

    const precision = pred.size === 0 ? 0 : truePositives / pred.size;
    const recall = truth.size === 0 ? 0 : truePositives / truth.size;
    const f1 = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    return {
      precision,
      recall,
      f1,
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
    };
  }

  compute_user_acceptance(records: UserAcceptanceRecord[]): UserAcceptanceMetrics {
    if (records.length === 0) {
      return {
        acceptance_rate: 0,
        average_corrections: 0,
      };
    }

    const accepted = records.filter((record) => record.accepted).length;
    const corrections = records.reduce((sum, record) => sum + record.corrections, 0);

    return {
      acceptance_rate: accepted / records.length,
      average_corrections: corrections / records.length,
    };
  }

  private detect_cadences(sequence: string[]): number[] {
    const indices: number[] = [];
    for (let i = 1; i < sequence.length; i++) {
      if (is_dominant(sequence[i - 1]) && is_tonic(sequence[i])) {
        indices.push(i);
      }
    }
    return indices;
  }
}

