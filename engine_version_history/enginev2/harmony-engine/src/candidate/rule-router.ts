import type { ChordCandidate } from '../core/harmony-types.js';
import type { NoteLetter, Accidental } from '../core/types.js';
import { ACCIDENTAL_OFFSET, CHORD_TEMPLATES, NOTE_TO_SEMITONE } from '../core/constants.js';
import { events_in_span, flatten_timed_notes } from '../core/music-time.js';
import { candidate_from_roman } from './candidate-utils.js';
import type { CandidateRouterContext } from './types.js';

function parse_tonic(input: string): { tonic: NoteLetter; accidental: Accidental } {
  const m = input.trim().match(/^([A-G])([b#]?)/);
  if (!m) {
    return { tonic: 'C', accidental: 'none' };
  }

  return {
    tonic: m[1] as NoteLetter,
    accidental: m[2] === '#' ? 'sharp' : m[2] === 'b' ? 'flat' : 'none',
  };
}

function chord_pitch_classes(candidate: ChordCandidate): Set<number> {
  const root = (NOTE_TO_SEMITONE[candidate.root] + ACCIDENTAL_OFFSET[candidate.root_accidental] + 12) % 12;
  const template = CHORD_TEMPLATES[candidate.quality] ?? CHORD_TEMPLATES.major;
  return new Set(template.map((i) => (root + i) % 12));
}

function melody_coverage(candidate: ChordCandidate, notePcs: number[]): number {
  if (notePcs.length === 0) {
    return 0.5;
  }

  const pcs = chord_pitch_classes(candidate);
  const covered = notePcs.filter((pc) => pcs.has(pc)).length;
  return covered / notePcs.length;
}

function candidates_for_difficulty(difficulty: string, mode: string): string[] {
  if (mode === 'minor') {
    if (difficulty === 'basic') {
      return ['i', 'iv', 'V', 'VI'];
    }
    if (difficulty === 'advanced') {
      return ['i', 'iio', 'III', 'iv', 'V', 'VI', 'VII', 'V7', 'iv7', 'VImaj7'];
    }
    return ['i', 'iio', 'III', 'iv', 'V', 'VI', 'VII', 'V7'];
  }

  if (difficulty === 'basic') {
    return ['I', 'IV', 'V', 'vi'];
  }
  if (difficulty === 'advanced') {
    return ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio', 'V7', 'ii7', 'IVmaj7', 'vi7'];
  }
  return ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio', 'V7', 'ii7'];
}

function cadence_candidates(mode: string): string[] {
  if (mode === 'minor') {
    return ['V', 'i'];
  }
  return ['V', 'I'];
}

function function_fit(functionalState: string | undefined, candidateFunction: string): number {
  if (!functionalState) {
    return 0.5;
  }
  if (functionalState === candidateFunction) {
    return 0.95;
  }
  if (functionalState === 'cadence_preparation' && candidateFunction === 'dominant') {
    return 0.9;
  }
  if (functionalState === 'cadence_resolution' && candidateFunction === 'tonic') {
    return 0.9;
  }
  return 0.35;
}

export class RuleRouter {
  generate(context: CandidateRouterContext): ChordCandidate[] {
    const tonic = parse_tonic(context.key_context.key);
    const timedNotes = events_in_span(flatten_timed_notes(context.score), context.time_span);

    const strongNotePcs = timedNotes
      .filter((entry) => entry.event.is_strong_beat || entry.event.is_downbeat)
      .map((entry) => (NOTE_TO_SEMITONE[entry.event.pitch.step] + ACCIDENTAL_OFFSET[entry.event.pitch.accidental] + 12) % 12);

    const fallbackNotePcs = timedNotes.map((entry) =>
      (NOTE_TO_SEMITONE[entry.event.pitch.step] + ACCIDENTAL_OFFSET[entry.event.pitch.accidental] + 12) % 12,
    );

    const notePcs = strongNotePcs.length > 0 ? strongNotePcs : fallbackNotePcs;

    const romans = new Set(candidates_for_difficulty(context.difficulty, context.key_context.mode));

    const spanEnd = context.time_span[1];
    const phraseEnding = context.phrase_boundaries.some((boundary) => Math.abs(boundary[1] - spanEnd) < 0.25);
    if (phraseEnding) {
      for (const cadence of cadence_candidates(context.key_context.mode)) {
        romans.add(cadence);
      }
    }

    const candidates: ChordCandidate[] = [];
    for (const roman of romans) {
      const candidate = candidate_from_roman({
        roman_numeral: roman,
        tonic: tonic.tonic,
        tonic_accidental: tonic.accidental,
        mode: context.key_context.mode,
        difficulty: context.difficulty,
        source: 'rule',
        explanation: phraseEnding
          ? `Rule candidate with cadence boost at phrase ending (${roman}).`
          : `Rule candidate generated from functional harmony (${roman}).`,
      });

      if (!candidate) {
        continue;
      }

      const coverage = melody_coverage(candidate, notePcs);
      if (coverage < 0.35) {
        continue;
      }

      candidate.melody_coverage = coverage;
      candidate.beat_alignment = notePcs.length > 0 ? 0.8 : 0.5;
      candidate.function_fit = function_fit(context.functional_state, candidate.function);
      candidate.style_fit = context.style === 'hymn' ? (candidate.function === 'dominant' ? 0.7 : 0.6) : 0.6;
      candidate.confidence = 0.55 + coverage * 0.35 + (phraseEnding ? 0.1 : 0);
      candidates.push(candidate);
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }
}
