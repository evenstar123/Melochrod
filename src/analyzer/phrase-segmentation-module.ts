import type { Score } from '../core/types.js';
import type { TimeSpan } from '../core/harmony-types.js';
import { DURATION_TO_QUARTERS } from '../core/constants.js';
import {
  events_in_span,
  flatten_timed_notes,
  flatten_timed_rests,
  measure_start_time,
  total_duration,
} from '../core/music-time.js';

interface BoundaryCandidate {
  time: number;
  score: number;
}

export class PhraseSegmentationModule {
  segment(score: Score, overlap_ratio = 0.15): TimeSpan[] {
    const candidateTimes = this._find_candidate_boundaries(score);
    const selected = this._select_boundaries(score, candidateTimes);
    const phrases = this._build_phrase_intervals(score, selected);

    if (phrases.length <= 1) {
      return this._fallback_fixed_windows(score);
    }

    return this.get_overlapping_windows(phrases, overlap_ratio);
  }

  _find_candidate_boundaries(score: Score): number[] {
    const total = total_duration(score);
    const candidates = new Set<number>([0, total]);

    const notes = flatten_timed_notes(score);
    const rests = flatten_timed_rests(score);

    for (const rest of rests) {
      candidates.add(rest.start_time);
      candidates.add(rest.end_time);
    }

    for (const note of notes) {
      const duration = DURATION_TO_QUARTERS[note.event.duration] * (note.event.dots === 0 ? 1 : 1.5);
      if (duration >= 3.0) {
        candidates.add(note.end_time);
      }
    }

    for (let i = 1; i <= score.measures.length; i++) {
      candidates.add(measure_start_time(score, i));
    }

    // Sparse-density turning points.
    const window = 2;
    for (let time = window; time < total - window; time += 0.5) {
      const leftDensity = events_in_span(notes, [time - window, time]).length / window;
      const rightDensity = events_in_span(notes, [time, time + window]).length / window;
      if (Math.abs(leftDensity - rightDensity) > 1.0) {
        candidates.add(time);
      }
    }

    return Array.from(candidates).sort((a, b) => a - b);
  }

  _score_boundary(score: Score, time: number): number {
    const notes = flatten_timed_notes(score);
    const rests = flatten_timed_rests(score);

    const nearRest = rests.some((rest) => Math.abs(rest.start_time - time) < 0.2 || Math.abs(rest.end_time - time) < 0.2) ? 1 : 0;

    const longNoteEnding = notes.some((note) => {
      const duration = DURATION_TO_QUARTERS[note.event.duration] * (note.event.dots === 0 ? 1 : 1.5);
      return duration >= 3 && Math.abs(note.end_time - time) < 0.2;
    }) ? 1 : 0;

    const closureTendency = notes.some((note) => {
      if (Math.abs(note.end_time - time) > 0.2) return false;
      return note.event.chord_tone_tendency !== undefined && note.event.chord_tone_tendency > 0.7;
    }) ? 1 : 0.4;

    const measureStarts = new Set(score.measures.map((measure) => measure_start_time(score, measure.number)));
    const barlineAlign = measureStarts.has(time) ? 1 : 0;

    const leftDensity = events_in_span(notes, [Math.max(0, time - 2), time]).length / 2;
    const rightDensity = events_in_span(notes, [time, Math.min(total_duration(score), time + 2)]).length / 2;
    const densityChange = Math.min(1, Math.abs(leftDensity - rightDensity) / 2);

    return (
      0.4 * nearRest +
      0.25 * longNoteEnding +
      0.2 * closureTendency +
      0.1 * barlineAlign +
      0.05 * densityChange
    );
  }

  _select_boundaries(score: Score, candidates: number[]): number[] {
    const scored: BoundaryCandidate[] = candidates.map((time) => ({
      time,
      score: this._score_boundary(score, time),
    }));

    const selected: number[] = [];
    for (const item of scored) {
      if (item.time <= 1e-6 || Math.abs(item.time - total_duration(score)) < 1e-6) {
        selected.push(item.time);
        continue;
      }

      if (item.score >= 0.45) {
        if (selected.every((time) => Math.abs(time - item.time) >= 1.0)) {
          selected.push(item.time);
        }
      }
    }

    return selected.sort((a, b) => a - b);
  }

  _build_phrase_intervals(score: Score, boundaries: number[]): TimeSpan[] {
    const total = total_duration(score);
    const sorted = Array.from(new Set([0, ...boundaries, total])).sort((a, b) => a - b);

    const phrases: TimeSpan[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (end - start >= 1.0) {
        phrases.push([start, end]);
      }
    }

    return phrases;
  }

  get_overlapping_windows(phrases: TimeSpan[], overlap_ratio: number): TimeSpan[] {
    if (phrases.length === 0) {
      return [];
    }

    const first = phrases[0][0];
    const last = phrases[phrases.length - 1][1];

    return phrases.map((phrase) => {
      const duration = phrase[1] - phrase[0];
      const overlap = duration * overlap_ratio;
      return [
        Math.max(first, phrase[0] - overlap),
        Math.min(last, phrase[1] + overlap),
      ];
    });
  }

  private _fallback_fixed_windows(score: Score): TimeSpan[] {
    const total = total_duration(score);
    const beatsPerMeasure = score.time.beats * (4 / score.time.beatType);
    const fourMeasureWindow = beatsPerMeasure * 4;
    const eightMeasureWindow = beatsPerMeasure * 8;

    const window = total <= eightMeasureWindow * 1.2 ? fourMeasureWindow : eightMeasureWindow;
    const phrases: TimeSpan[] = [];

    for (let cursor = 0; cursor < total - 1e-6; cursor += window) {
      phrases.push([cursor, Math.min(total, cursor + window)]);
    }

    return phrases;
  }
}
