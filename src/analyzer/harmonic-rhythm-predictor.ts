import type { DifficultyLevel, TimeSpan } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import { DURATION_TO_QUARTERS } from '../core/constants.js';
import {
  events_in_span,
  flatten_timed_notes,
  flatten_timed_rests,
  total_duration,
} from '../core/music-time.js';

export interface HarmonicRhythmPredictionConfig {
  score: Score;
  difficulty: DifficultyLevel;
  style?: string;
  phrase_boundaries: TimeSpan[];
  low_quality_regions?: TimeSpan[];
}

export class HarmonicRhythmPredictor {
  predict(config: HarmonicRhythmPredictionConfig): TimeSpan[] {
    const baseDuration = config.difficulty === 'basic' ? 4.0 : config.difficulty === 'intermediate' ? 2.0 : 1.0;
    const spans: TimeSpan[] = [];

    const phrases = config.phrase_boundaries.length > 0
      ? config.phrase_boundaries
      : [[0, total_duration(config.score)] as TimeSpan];

    for (const phrase of phrases) {
      spans.push(...this._predict_phrase_rhythm(config.score, phrase, baseDuration, config.low_quality_regions ?? []));
    }

    if (spans.length === 0) {
      return [[0, total_duration(config.score)]];
    }

    // Normalize continuity.
    const normalized: TimeSpan[] = [];
    for (let i = 0; i < spans.length; i++) {
      const start = i === 0 ? 0 : normalized[i - 1][1];
      const end = spans[i][1];
      if (end - start > 1e-6) {
        normalized.push([start, end]);
      }
    }

    const total = total_duration(config.score);
    if (normalized[normalized.length - 1][1] < total) {
      normalized.push([normalized[normalized.length - 1][1], total]);
    }

    return normalized;
  }

  private _predict_phrase_rhythm(
    score: Score,
    phrase: TimeSpan,
    baseDuration: number,
    lowQualityRegions: TimeSpan[],
  ): TimeSpan[] {
    const spans: TimeSpan[] = [];
    let cursor = phrase[0];

    while (cursor < phrase[1] - 1e-6) {
      const effectiveBase = lowQualityRegions.some((region) => cursor >= region[0] && cursor < region[1])
        ? Math.max(baseDuration, baseDuration * 1.5)
        : baseDuration;

      const next = this._find_next_change_point(score, cursor, phrase, effectiveBase);
      const safeNext = Math.min(phrase[1], Math.max(cursor + 0.5, next));
      spans.push([cursor, safeNext]);
      cursor = safeNext;
    }

    return spans;
  }

  private _find_next_change_point(
    score: Score,
    cursor: number,
    phrase: TimeSpan,
    baseDuration: number,
  ): number {
    const target = cursor + baseDuration;
    const candidatePoints: Array<{ time: number; weight: number }> = [];

    for (const boundary of [phrase[1]]) {
      if (boundary > cursor) {
        candidatePoints.push({ time: boundary, weight: 1.0 });
      }
    }

    const searchSpan: TimeSpan = [cursor, Math.min(phrase[1], cursor + baseDuration * 2.5)];
    const notes = events_in_span(flatten_timed_notes(score), searchSpan);
    for (const note of notes) {
      const duration = DURATION_TO_QUARTERS[note.event.duration] * (note.event.dots === 0 ? 1 : 1.5);
      if ((note.event.is_strong_beat || note.event.is_downbeat) && duration >= 1.5 && note.start_time > cursor + 0.25) {
        candidatePoints.push({ time: note.start_time, weight: 0.8 });
      }
    }

    const rests = events_in_span(flatten_timed_rests(score), searchSpan);
    for (const rest of rests) {
      if (rest.start_time > cursor + 0.25) {
        candidatePoints.push({ time: rest.start_time, weight: 0.7 });
      }
    }

    candidatePoints.push({ time: target, weight: 0.5 });

    const filtered = candidatePoints
      .filter((candidate) => candidate.time <= phrase[1] + 1e-6)
      .sort((a, b) => Math.abs(a.time - target) - Math.abs(b.time - target))
      .filter((candidate, index, arr) => {
        if (index === 0) return true;
        return Math.abs(candidate.time - arr[index - 1].time) >= 0.5;
      });

    if (filtered.length === 0) {
      return Math.min(phrase[1], target);
    }

    filtered.sort((a, b) => {
      const distA = Math.abs(a.time - target);
      const distB = Math.abs(b.time - target);
      const scoreA = a.weight - distA * 0.15;
      const scoreB = b.weight - distB * 0.15;
      return scoreB - scoreA;
    });

    return filtered[0].time;
  }
}
