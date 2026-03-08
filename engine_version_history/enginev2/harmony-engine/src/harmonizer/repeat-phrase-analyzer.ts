import type { ChordCandidate, TimeSpan } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import { events_in_span, flatten_timed_notes } from '../core/music-time.js';
import { NOTE_TO_SEMITONE, ACCIDENTAL_OFFSET } from '../core/constants.js';

export interface RepeatGroup {
  group_id: string;
  phrase_indices: number[];
  similarity_score: number;
  context_differs: boolean;
}

function interval_contour(values: number[]): number[] {
  const contour: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    contour.push(diff > 0 ? 1 : diff < 0 ? -1 : 0);
  }
  return contour;
}

function contour_similarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const length = Math.min(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < length; i++) {
    if (a[i] === b[i]) matches += 1;
  }
  return matches / Math.max(a.length, b.length);
}

function phrase_position_index(phrase: TimeSpan, pieceEnd: number): number {
  const center = (phrase[0] + phrase[1]) / 2;
  return Math.floor((center / Math.max(1e-6, pieceEnd)) * 10);
}

export class RepeatPhraseAnalyzer {
  detect_repeats(
    score: Score,
    phrase_boundaries: TimeSpan[],
    threshold = 0.85,
  ): RepeatGroup[] {
    if (phrase_boundaries.length < 2) return [];

    const notes = flatten_timed_notes(score);
    const contours = phrase_boundaries.map((phrase) => {
      const phraseNotes = events_in_span(notes, phrase)
        .map((entry) => entry.event.pitch.octave * 12 + NOTE_TO_SEMITONE[entry.event.pitch.step] + ACCIDENTAL_OFFSET[entry.event.pitch.accidental]);
      return interval_contour(phraseNotes);
    });

    const groups: RepeatGroup[] = [];
    const used = new Set<number>();
    const pieceEnd = phrase_boundaries[phrase_boundaries.length - 1][1];

    for (let i = 0; i < contours.length; i++) {
      if (used.has(i)) continue;

      const currentGroup = [i];
      let bestSimilarity = 0;

      for (let j = i + 1; j < contours.length; j++) {
        const similarity = contour_similarity(contours[i], contours[j]);
        if (similarity >= threshold) {
          currentGroup.push(j);
          used.add(j);
          bestSimilarity = Math.max(bestSimilarity, similarity);
        }
      }

      if (currentGroup.length > 1) {
        const contextDiffers = new Set(currentGroup.map((idx) => phrase_position_index(phrase_boundaries[idx], pieceEnd))).size > 1;
        groups.push({
          group_id: `repeat-${groups.length + 1}`,
          phrase_indices: currentGroup,
          similarity_score: bestSimilarity,
          context_differs: contextDiffers,
        });
      }
    }

    return groups;
  }

  apply_consistency(
    chord_sequence: ChordCandidate[],
    time_spans: TimeSpan[],
    phrase_boundaries: TimeSpan[],
    groups: RepeatGroup[],
  ): ChordCandidate[] {
    const updated = [...chord_sequence];

    for (const group of groups) {
      const referencePhrase = group.phrase_indices[0];
      const referenceSpanIndexes = this.span_indexes_for_phrase(time_spans, phrase_boundaries[referencePhrase]);
      if (referenceSpanIndexes.length === 0) continue;

      const referenceChords = referenceSpanIndexes.map((idx) => updated[idx]);

      for (const phraseIndex of group.phrase_indices.slice(1)) {
        const targetSpanIndexes = this.span_indexes_for_phrase(time_spans, phrase_boundaries[phraseIndex]);
        if (targetSpanIndexes.length === 0) continue;

        const copyCount = Math.min(referenceChords.length, targetSpanIndexes.length);
        for (let i = 0; i < copyCount; i++) {
          const targetIndex = targetSpanIndexes[i];

          // Allow cadence variation at phrase ending if contexts differ.
          const isEnding = i === copyCount - 1;
          if (group.context_differs && isEnding) {
            continue;
          }

          updated[targetIndex] = {
            ...referenceChords[i],
            explanation: `${referenceChords[i].explanation} [Repeat consistency sync from phrase ${referencePhrase + 1}]`,
          };
        }
      }
    }

    return updated;
  }

  build_repeat_expectations(
    chord_sequence: ChordCandidate[],
    time_spans: TimeSpan[],
    phrase_boundaries: TimeSpan[],
    groups: RepeatGroup[],
  ): Record<number, { roman_numeral: string; weight: number }> {
    const expectations: Record<number, { roman_numeral: string; weight: number }> = {};

    for (const group of groups) {
      const referencePhrase = group.phrase_indices[0];
      const referenceSpanIndexes = this.span_indexes_for_phrase(time_spans, phrase_boundaries[referencePhrase]);

      for (const phraseIndex of group.phrase_indices.slice(1)) {
        const targetSpanIndexes = this.span_indexes_for_phrase(time_spans, phrase_boundaries[phraseIndex]);
        const count = Math.min(referenceSpanIndexes.length, targetSpanIndexes.length);

        for (let i = 0; i < count; i++) {
          const targetIdx = targetSpanIndexes[i];
          const sourceIdx = referenceSpanIndexes[i];
          const source = chord_sequence[sourceIdx];
          if (!source) continue;

          expectations[targetIdx] = {
            roman_numeral: source.roman_numeral,
            weight: group.context_differs && i === count - 1 ? 0.2 : 0.6,
          };
        }
      }
    }

    return expectations;
  }

  private span_indexes_for_phrase(time_spans: TimeSpan[], phrase: TimeSpan): number[] {
    const indexes: number[] = [];
    for (let i = 0; i < time_spans.length; i++) {
      const span = time_spans[i];
      if (span[0] >= phrase[0] - 1e-6 && span[1] <= phrase[1] + 1e-6) {
        indexes.push(i);
      }
    }
    return indexes;
  }
}
