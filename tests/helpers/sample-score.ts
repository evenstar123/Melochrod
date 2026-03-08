import type { Accidental, KeySignature, Measure, Note, NoteLetter, Score } from '../../src/core/types.js';

export function make_note(
  step: NoteLetter,
  beat: number,
  opts: {
    accidental?: Accidental;
    octave?: number;
    duration?: Note['duration'];
    dots?: number;
  } = {},
): Note {
  return {
    type: 'note',
    pitch: {
      step,
      accidental: opts.accidental ?? 'none',
      octave: opts.octave ?? 4,
    },
    duration: opts.duration ?? 'quarter',
    dots: opts.dots ?? 0,
    tieStart: false,
    tieStop: false,
    beat,
  };
}

export function make_measure(number: number, notes: Note[]): Measure {
  return {
    number,
    events: notes,
    chords: [],
  };
}

export function make_score(
  measures: Measure[],
  key: KeySignature = { tonic: 'C', tonicAccidental: 'none', mode: 'major', fifths: 0 },
): Score {
  return {
    title: 'Test',
    composer: 'Unit',
    key,
    time: { beats: 4, beatType: 4 },
    tempo: 100,
    measures,
  };
}
