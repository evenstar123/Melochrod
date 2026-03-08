import type { Note, Score } from '../core/types.js';
import { ACCIDENTAL_OFFSET, DURATION_TO_QUARTERS, NOTE_TO_SEMITONE } from '../core/constants.js';
import { flatten_timed_notes, is_downbeat } from '../core/music-time.js';

function normalize(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / max));
}

function key_pc(score: Score): number {
  return (NOTE_TO_SEMITONE[score.key.tonic] + ACCIDENTAL_OFFSET[score.key.tonicAccidental] + 12) % 12;
}

function scale_degrees_for_mode(mode: string): number[] {
  if (mode === 'minor') {
    return [0, 2, 3, 5, 7, 8, 10];
  }
  return [0, 2, 4, 5, 7, 9, 11];
}

function triad_degrees_for_mode(mode: string): number[] {
  if (mode === 'minor') {
    return [0, 3, 7];
  }
  return [0, 4, 7];
}

function pitch_class(note: Note): number {
  return (NOTE_TO_SEMITONE[note.pitch.step] + ACCIDENTAL_OFFSET[note.pitch.accidental] + 12) % 12;
}

function classify_nct(prev: Note | undefined, note: Note, next: Note | undefined): string | undefined {
  if (!prev || !next) {
    return undefined;
  }

  const prevPc = pitch_class(prev);
  const notePc = pitch_class(note);
  const nextPc = pitch_class(next);

  const upStep = (prevPc + 1) % 12 === notePc || (prevPc + 2) % 12 === notePc;
  const downStep = (prevPc + 11) % 12 === notePc || (prevPc + 10) % 12 === notePc;
  const continuesUp = (notePc + 1) % 12 === nextPc || (notePc + 2) % 12 === nextPc;
  const continuesDown = (notePc + 11) % 12 === nextPc || (notePc + 10) % 12 === nextPc;

  if ((upStep && continuesUp) || (downStep && continuesDown)) {
    return 'passing';
  }
  if ((upStep && continuesDown) || (downStep && continuesUp)) {
    return 'neighbor';
  }
  return 'accented_nct';
}

export class NoteSalienceAnalyzer {
  analyze(score: Score, phraseBoundaries: Array<readonly [number, number]> = []): Score {
    const timedNotes = flatten_timed_notes(score);
    const maxDuration = Math.max(
      0,
      ...timedNotes.map((entry) => DURATION_TO_QUARTERS[entry.event.duration] * (entry.event.dots === 0 ? 1 : 1.5)),
    );

    const tonicPc = key_pc(score);
    const scale = scale_degrees_for_mode(score.key.mode);
    const triad = triad_degrees_for_mode(score.key.mode);

    for (let i = 0; i < timedNotes.length; i++) {
      const current = timedNotes[i];
      const note = current.event;

      const downbeat = is_downbeat(score, current.start_time);
      const strongBeat = downbeat || Math.abs(note.beat - Math.round(note.beat / 2) * 2) < 1e-6;
      const beatWeight = downbeat ? 1 : strongBeat ? 0.75 : 0.35;
      const durationWeight = normalize(DURATION_TO_QUARTERS[note.duration] * (note.dots === 0 ? 1 : 1.5), maxDuration);

      const pc = (pitch_class(note) - tonicPc + 12) % 12;
      const inScale = scale.includes(pc);
      const inTriad = triad.includes(pc);

      note.is_downbeat = downbeat;
      note.is_strong_beat = strongBeat;
      note.beat_weight = beatWeight;
      note.duration_weight = durationWeight;
      note.salience = 0.6 * beatWeight + 0.4 * durationWeight;
      note.chord_tone_tendency = inTriad ? 1 : inScale ? 0.6 : 0.3;

      if (!inTriad) {
        note.nct_type = classify_nct(timedNotes[i - 1]?.event, note, timedNotes[i + 1]?.event) ?? 'non_chord_tone';
      }

      note.phrase_boundary = phraseBoundaries.some((boundary) => Math.abs(current.start_time - boundary[1]) < 0.25);
    }

    return score;
  }
}
