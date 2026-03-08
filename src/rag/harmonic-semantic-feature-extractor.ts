import type { Score } from '../core/types.js';
import { DURATION_TO_QUARTERS, NOTE_TO_SEMITONE, ACCIDENTAL_OFFSET } from '../core/constants.js';
import { events_in_span, flatten_timed_notes, total_duration } from '../core/music-time.js';

export interface HarmonicSemanticFeatures {
  backbone_notes: number[];
  phrase_position: 'opening' | 'middle' | 'pre_cadence' | 'closing';
  melody_stability: number;
  rhythm_harmony_coupling: number;
  cadence_pattern: string;
  harmonic_density_hint: number;
}

function infer_phrase_position(timeSpan: readonly [number, number], phraseBoundaries: Array<readonly [number, number]>): 'opening' | 'middle' | 'pre_cadence' | 'closing' {
  if (phraseBoundaries.length === 0) {
    return 'middle';
  }

  const [start, end] = timeSpan;
  const phrase = phraseBoundaries.find((boundary) => start >= boundary[0] - 1e-6 && end <= boundary[1] + 1e-6);
  if (!phrase) {
    return 'middle';
  }

  const duration = Math.max(0.001, phrase[1] - phrase[0]);
  const center = (start + end) / 2;
  const position = (center - phrase[0]) / duration;

  if (position < 0.2) return 'opening';
  if (position > 0.85) return 'closing';
  if (position > 0.65) return 'pre_cadence';
  return 'middle';
}

function interval_direction(values: number[]): string {
  if (values.length < 2) {
    return 'static';
  }

  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev) {
    return 'ascending';
  }
  if (last < prev) {
    return 'descending';
  }
  return 'static';
}

export class HarmonicSemanticFeatureExtractor {
  extract(
    score: Score,
    timeSpan: readonly [number, number],
    phraseBoundaries: Array<readonly [number, number]> = [],
  ): HarmonicSemanticFeatures {
    const notes = events_in_span(flatten_timed_notes(score), timeSpan);

    const backbone = notes
      .filter((note) => note.event.is_downbeat || note.event.is_strong_beat || DURATION_TO_QUARTERS[note.event.duration] >= 2)
      .map((note) => (NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental] + 12) % 12);

    const fallback = notes.map((note) =>
      (NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental] + 12) % 12,
    );

    const phrasePosition = infer_phrase_position(timeSpan, phraseBoundaries);

    const stabilitySamples = notes.map((note) => note.event.chord_tone_tendency ?? 0.5);
    const melodyStability = stabilitySamples.length > 0
      ? stabilitySamples.reduce((sum, v) => sum + v, 0) / stabilitySamples.length
      : 0.5;

    const spanDuration = Math.max(0.001, timeSpan[1] - timeSpan[0]);
    const density = notes.length / spanDuration;
    const averageSalience = notes.length > 0
      ? notes.reduce((sum, note) => sum + (note.event.salience ?? 0.4), 0) / notes.length
      : 0.4;
    const rhythmHarmonyCoupling = Math.max(0, Math.min(1, (averageSalience * 0.6) + (Math.min(1, density / 2) * 0.4)));

    const contour = notes.map((note) => note.event.pitch.octave * 12 + NOTE_TO_SEMITONE[note.event.pitch.step]);
    const direction = interval_direction(contour);
    const cadencePattern = phrasePosition === 'closing' || phrasePosition === 'pre_cadence'
      ? direction === 'descending' ? 'descending_close' : 'cadence_pending'
      : 'continuation';

    const pieceDuration = total_duration(score);
    const harmonicDensityHint = Math.max(0.5, Math.min(4, (notes.length / Math.max(1, spanDuration)) * (pieceDuration > 64 ? 1.1 : 0.9)));

    return {
      backbone_notes: backbone.length > 0 ? backbone : fallback,
      phrase_position: phrasePosition,
      melody_stability: melodyStability,
      rhythm_harmony_coupling: rhythmHarmonyCoupling,
      cadence_pattern: cadencePattern,
      harmonic_density_hint: harmonicDensityHint,
    };
  }
}
