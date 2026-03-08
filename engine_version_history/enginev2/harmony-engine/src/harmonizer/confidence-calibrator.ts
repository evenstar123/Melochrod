import type { ChordCandidate, TimeSpan } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import { measure_start_time } from '../core/music-time.js';

export interface ConfidenceDecomposition {
  key_confidence: number;
  omr_confidence: number;
  chord_confidence: number;
}

export interface ChordConfidenceOutput {
  span_index: number;
  roman_numeral: string;
  raw_confidence: number;
  calibrated_confidence: number;
}

export interface MeasureConfidenceOutput {
  measure_number: number;
  confidence: number;
}

export interface ConfidenceOutput {
  chords: ChordConfidenceOutput[];
  measures: MeasureConfidenceOutput[];
  overall_confidence: number;
  decomposition: ConfidenceDecomposition;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class ConfidenceCalibrator {
  private samples: Array<{ confidence: number; actual_correction_rate: number }> = [];
  private slope = 1;
  private intercept = 0;

  collect(confidence: number, actual_correction_rate: number): void {
    this.samples.push({
      confidence: clamp01(confidence),
      actual_correction_rate: clamp01(actual_correction_rate),
    });
  }

  periodically_update(min_samples = 8): void {
    if (this.samples.length >= min_samples) {
      this.fit();
    }
  }

  fit(): void {
    if (this.samples.length < 2) {
      this.slope = 1;
      this.intercept = 0;
      return;
    }

    const xs = this.samples.map((s) => s.confidence);
    const ys = this.samples.map((s) => 1 - s.actual_correction_rate);
    const meanX = xs.reduce((sum, v) => sum + v, 0) / xs.length;
    const meanY = ys.reduce((sum, v) => sum + v, 0) / ys.length;

    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }

    const slope = den === 0 ? 1 : num / den;
    const intercept = meanY - slope * meanX;
    this.slope = slope;
    this.intercept = intercept;
  }

  calibrate(confidence: number): number {
    return clamp01(this.slope * confidence + this.intercept);
  }

  compute_confidence_output(input: {
    score: Score;
    chord_sequence: ChordCandidate[];
    time_spans: TimeSpan[];
    key_confidence: number;
    omr_confidence?: number;
  }): ConfidenceOutput {
    const chordOutputs: ChordConfidenceOutput[] = input.chord_sequence.map((chord, index) => {
      const raw = clamp01(chord.confidence);
      const calibrated = this.calibrate(raw);
      return {
        span_index: index,
        roman_numeral: chord.roman_numeral,
        raw_confidence: raw,
        calibrated_confidence: calibrated,
      };
    });

    const measureBuckets = new Map<number, number[]>();
    for (let i = 0; i < input.time_spans.length; i++) {
      const span = input.time_spans[i];
      const measureNumber = this.find_measure(input.score, span[0]);
      const bucket = measureBuckets.get(measureNumber) ?? [];
      bucket.push(chordOutputs[i]?.calibrated_confidence ?? 0.5);
      measureBuckets.set(measureNumber, bucket);
    }

    const measureOutputs: MeasureConfidenceOutput[] = [...measureBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([measureNumber, values]) => ({
        measure_number: measureNumber,
        confidence: clamp01(values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length)),
      }));

    const chordConfidence = chordOutputs.length === 0
      ? 0.5
      : chordOutputs.reduce((sum, item) => sum + item.calibrated_confidence, 0) / chordOutputs.length;

    const decomposition: ConfidenceDecomposition = {
      key_confidence: clamp01(input.key_confidence),
      omr_confidence: clamp01(input.omr_confidence ?? 0.8),
      chord_confidence: clamp01(chordConfidence),
    };

    const overall = clamp01(
      0.35 * decomposition.key_confidence +
      0.25 * decomposition.omr_confidence +
      0.4 * decomposition.chord_confidence,
    );

    return {
      chords: chordOutputs,
      measures: measureOutputs,
      overall_confidence: overall,
      decomposition,
    };
  }

  mean_absolute_error(samples: Array<{ confidence: number; actual_correction_rate: number }>): number {
    if (samples.length === 0) return 0;
    const error = samples.reduce((sum, sample) => {
      const predictedAccuracy = this.calibrate(clamp01(sample.confidence));
      const actualAccuracy = 1 - clamp01(sample.actual_correction_rate);
      return sum + Math.abs(predictedAccuracy - actualAccuracy);
    }, 0);
    return error / samples.length;
  }

  get_model(): { slope: number; intercept: number; sample_count: number } {
    return {
      slope: this.slope,
      intercept: this.intercept,
      sample_count: this.samples.length,
    };
  }

  private find_measure(score: Score, time: number): number {
    for (const measure of score.measures) {
      const start = measure_start_time(score, measure.number);
      const length = (measure.timeChange ?? score.time).beats * (4 / (measure.timeChange ?? score.time).beatType);
      if (time >= start - 1e-6 && time < start + length - 1e-6) {
        return measure.number;
      }
    }
    return score.measures[score.measures.length - 1]?.number ?? 1;
  }
}
