import type { DifficultyLevel, SupportedMode, TimeSpan } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import { ACCIDENTAL_OFFSET, NOTE_TO_SEMITONE } from '../core/constants.js';
import { events_in_span, flatten_timed_notes } from '../core/music-time.js';

export type FunctionalState =
  | 'tonic'
  | 'subdominant'
  | 'dominant'
  | 'cadence_preparation'
  | 'cadence_resolution'
  | 'modal_mixture'
  | 'transition';

export interface FunctionalStateContext {
  start_time: number;
  end_time: number;
  key: string;
  mode: SupportedMode;
}

const LEGAL_TRANSITIONS: Record<FunctionalState, FunctionalState[]> = {
  tonic: ['tonic', 'subdominant', 'transition'],
  subdominant: ['dominant', 'transition', 'cadence_preparation'],
  dominant: ['tonic', 'cadence_resolution', 'transition'],
  cadence_preparation: ['dominant', 'cadence_resolution'],
  cadence_resolution: ['tonic', 'subdominant'],
  modal_mixture: ['subdominant', 'dominant', 'transition'],
  transition: ['tonic', 'subdominant', 'dominant', 'modal_mixture'],
};

const ALLOWED_CHORDS: Record<FunctionalState, string[]> = {
  tonic: ['I', 'vi', 'i', 'III'],
  subdominant: ['ii', 'IV', 'iv', 'iio'],
  dominant: ['V', 'V7', 'viio'],
  cadence_preparation: ['ii', 'IV', 'iv', 'V/V'],
  cadence_resolution: ['I', 'i', 'vi'],
  modal_mixture: ['bVI', 'bVII', 'iv'],
  transition: ['I', 'ii', 'IV', 'V', 'vi'],
};

function parse_tonic(key: string): number {
  const match = key.trim().match(/^([A-G])([b#]?)/);
  if (!match) {
    return 0;
  }

  const step = match[1] as keyof typeof NOTE_TO_SEMITONE;
  const accidental = match[2] === '#' ? 'sharp' : match[2] === 'b' ? 'flat' : 'none';
  return (NOTE_TO_SEMITONE[step] + ACCIDENTAL_OFFSET[accidental] + 12) % 12;
}

function phrase_position(span: TimeSpan, phraseBoundaries: TimeSpan[]): 'start' | 'middle' | 'end' {
  const phrase = phraseBoundaries.find((boundary) => span[0] >= boundary[0] - 1e-6 && span[1] <= boundary[1] + 1e-6);
  if (!phrase) {
    return 'middle';
  }

  const duration = Math.max(0.001, phrase[1] - phrase[0]);
  const center = (span[0] + span[1]) / 2;
  const ratio = (center - phrase[0]) / duration;
  if (ratio < 0.2) return 'start';
  if (ratio > 0.75) return 'end';
  return 'middle';
}

export class FunctionalStateTracker {
  current_state: FunctionalState;

  constructor() {
    this.current_state = 'tonic';
  }

  track(
    score: Score,
    key_sequence: FunctionalStateContext[],
    phrase_boundaries: TimeSpan[],
  ): FunctionalState[] {
    const states: FunctionalState[] = [];
    let state: FunctionalState = 'tonic';

    for (const keyWindow of key_sequence) {
      const span: TimeSpan = [keyWindow.start_time, keyWindow.end_time];
      const position = phrase_position(span, phrase_boundaries);
      const notes = events_in_span(flatten_timed_notes(score), span);
      const tonicPc = parse_tonic(keyWindow.key);

      if (position === 'start') {
        state = 'tonic';
        states.push(state);
        continue;
      }

      const leadingTonePc = (tonicPc + 11) % 12;
      const hasLeadingTone = notes.some((note) => {
        const pc = (NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental] + 12) % 12;
        return pc === leadingTonePc;
      });

      const subdominantEmphasis = notes.filter((note) => {
        const pc = (NOTE_TO_SEMITONE[note.event.pitch.step] + ACCIDENTAL_OFFSET[note.event.pitch.accidental] + 12) % 12;
        return pc === (tonicPc + 5) % 12;
      }).length >= Math.max(1, Math.floor(notes.length * 0.35));

      let proposed: FunctionalState = state;
      if (position === 'end' && hasLeadingTone) {
        proposed = state === 'cadence_preparation' ? 'cadence_resolution' : 'cadence_preparation';
      } else if (subdominantEmphasis) {
        proposed = 'subdominant';
      } else if (hasLeadingTone) {
        proposed = 'dominant';
      } else if (notes.some((note) => note.event.salience && note.event.salience > 0.85)) {
        proposed = 'transition';
      } else {
        proposed = state;
      }

      if (!LEGAL_TRANSITIONS[state].includes(proposed)) {
        proposed = LEGAL_TRANSITIONS[state][0];
      }

      state = proposed;
      states.push(state);
    }

    this.current_state = state;
    return states;
  }

  get_allowed_chords(state: FunctionalState, difficulty: DifficultyLevel): string[] {
    const chords = ALLOWED_CHORDS[state] ?? ALLOWED_CHORDS.tonic;

    if (difficulty === 'basic') {
      return chords.filter((chord) => ['I', 'IV', 'V', 'vi', 'i', 'iv', 'v'].includes(chord));
    }

    if (difficulty === 'intermediate') {
      return chords.filter((chord) => !chord.includes('/'));
    }

    return chords;
  }

  boost_cadence_weight(state: FunctionalState): number {
    if (state === 'cadence_preparation' || state === 'cadence_resolution') {
      return 1.5;
    }
    if (state === 'dominant') {
      return 1.2;
    }
    return 1.0;
  }
}
