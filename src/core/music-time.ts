import type { MusicEvent, Note, Rest, Score, Measure, TimeSignature } from './types.js';
import { DURATION_TO_QUARTERS } from './constants.js';

export interface TimedEvent<T extends MusicEvent = MusicEvent> {
  event: T;
  measure_number: number;
  start_time: number;
  end_time: number;
}

function beatsPerMeasure(time: TimeSignature): number {
  return time.beats * (4 / time.beatType);
}

function eventDuration(event: MusicEvent): number {
  const base = DURATION_TO_QUARTERS[event.duration];
  const dotScale = event.dots === 0 ? 1 : event.dots === 1 ? 1.5 : 1.75;
  return base * dotScale;
}

export function total_duration(score: Score): number {
  let total = 0;
  let activeTime = score.time;

  for (const measure of score.measures) {
    if (measure.timeChange) {
      activeTime = measure.timeChange;
    }

    const expected = beatsPerMeasure(activeTime);
    let occupied = 0;
    for (const event of measure.events) {
      occupied = Math.max(occupied, event.beat + eventDuration(event));
    }

    total += Math.max(expected, occupied);
  }

  return total;
}

export function measure_start_time(score: Score, measureNumber: number): number {
  const sorted = [...score.measures].sort((a, b) => a.number - b.number);
  let time = 0;
  let activeTime = score.time;

  for (const measure of sorted) {
    if (measure.number === measureNumber) {
      return time;
    }
    if (measure.timeChange) {
      activeTime = measure.timeChange;
    }

    const expected = beatsPerMeasure(activeTime);
    let occupied = 0;
    for (const event of measure.events) {
      occupied = Math.max(occupied, event.beat + eventDuration(event));
    }

    time += Math.max(expected, occupied);
  }

  return time;
}

export function flatten_timed_events(score: Score): TimedEvent[] {
  const sorted = [...score.measures].sort((a, b) => a.number - b.number);
  const events: TimedEvent[] = [];

  for (const measure of sorted) {
    const base = measure_start_time(score, measure.number);

    for (const event of measure.events) {
      const start = base + event.beat;
      const end = start + eventDuration(event);
      events.push({ event, measure_number: measure.number, start_time: start, end_time: end });
    }
  }

  return events.sort((a, b) => a.start_time - b.start_time);
}

export function flatten_timed_notes(score: Score): TimedEvent<Note>[] {
  return flatten_timed_events(score)
    .filter((e): e is TimedEvent<Note> => e.event.type === 'note');
}

export function flatten_timed_rests(score: Score): TimedEvent<Rest>[] {
  return flatten_timed_events(score)
    .filter((e): e is TimedEvent<Rest> => e.event.type === 'rest');
}

export function events_in_span<T extends MusicEvent = MusicEvent>(
  timedEvents: TimedEvent<T>[],
  timeSpan: readonly [number, number],
): TimedEvent<T>[] {
  const [start, end] = timeSpan;
  return timedEvents.filter((event) => event.end_time > start && event.start_time < end);
}

export function notes_in_span(score: Score, timeSpan: readonly [number, number]): TimedEvent<Note>[] {
  return events_in_span(flatten_timed_notes(score), timeSpan);
}

export function rests_in_span(score: Score, timeSpan: readonly [number, number]): TimedEvent<Rest>[] {
  return events_in_span(flatten_timed_rests(score), timeSpan);
}

export function is_downbeat(score: Score, time: number): boolean {
  const sorted = [...score.measures].sort((a, b) => a.number - b.number);
  let activeTime = score.time;

  for (const measure of sorted) {
    if (measure.timeChange) {
      activeTime = measure.timeChange;
    }

    const start = measure_start_time(score, measure.number);
    const end = start + beatsPerMeasure(activeTime);
    if (time + 1e-6 >= start && time < end + 1e-6) {
      const local = time - start;
      return Math.abs(local) < 1e-6;
    }
  }

  return false;
}