import { XMLParser } from 'fast-xml-parser';
import type { Note, Score } from '../core/types.js';
import { DURATION_TO_QUARTERS, NOTE_TO_SEMITONE, ACCIDENTAL_OFFSET } from '../core/constants.js';
import { parseMusicXML } from './musicxml-parser.js';

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function duration_quarters(note: Note): number {
  const base = DURATION_TO_QUARTERS[note.duration] ?? 1;
  const dotScale = note.dots === 0 ? 1 : note.dots === 1 ? 1.5 : 1.75;
  return base * dotScale * (note.tuplet_ratio ?? 1);
}

export type MelodySelectionStrategy = 'highest_pitch' | 'most_active' | 'user_specified';

export interface EnhancedParseOptions {
  strategy?: MelodySelectionStrategy;
  user_voice_id?: number;
}

export interface EnhancedParseResult {
  score: Score;
  pickup_duration: number;
  melody_notes: Note[];
}

export class EnhancedMusicXMLParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'measure' || name === 'note' || name === 'tie' || name === 'tied',
  });

  parse(xml: string, options: EnhancedParseOptions = {}): EnhancedParseResult {
    const score = parseMusicXML(xml);
    const pickupDuration = this._detect_pickup(score);

    // Enrich parsed notes with raw XML details before post-processing.
    this.annotate_note_details_from_xml(score, xml);

    this._process_tuplets(score);
    this._process_grace_notes(score);
    this._process_ties(score);

    const melodyNotes = this._select_melody_voice(score, options.strategy ?? 'highest_pitch', options.user_voice_id);

    return {
      score,
      pickup_duration: pickupDuration,
      melody_notes: melodyNotes,
    };
  }

  _detect_pickup(score: Score): number {
    const firstMeasure = score.measures[0];
    if (!firstMeasure) return 0;

    const expectedDuration = score.time.beats * (4 / score.time.beatType);
    let actualDuration = 0;

    for (const event of firstMeasure.events) {
      if (event.type === 'note') {
        actualDuration = Math.max(actualDuration, event.beat + duration_quarters(event));
      } else {
        const base = DURATION_TO_QUARTERS[event.duration] ?? 1;
        const dotScale = event.dots === 0 ? 1 : event.dots === 1 ? 1.5 : 1.75;
        actualDuration = Math.max(actualDuration, event.beat + base * dotScale);
      }
    }

    if (actualDuration >= expectedDuration - 1e-6) {
      return 0;
    }

    return Math.max(0, expectedDuration - actualDuration);
  }

  _process_tuplets(score: Score): Score {
    for (const measure of score.measures) {
      for (const event of measure.events) {
        if (event.type !== 'note') continue;
        if (!event.tuplet_ratio || event.tuplet_ratio <= 0) continue;

        event.duration_weight = (event.duration_weight ?? 1) * event.tuplet_ratio;
      }
    }

    return score;
  }

  _process_grace_notes(score: Score): Score {
    for (const measure of score.measures) {
      for (const event of measure.events) {
        if (event.type !== 'note') continue;
        if (!event.is_grace) continue;

        event.salience = 0.1;
        event.duration_weight = Math.min(event.duration_weight ?? 0.5, 0.1);
      }
    }

    return score;
  }

  _process_ties(score: Score): Score {
    for (const measure of score.measures) {
      const processed: typeof measure.events = [];

      for (const event of measure.events) {
        if (event.type !== 'note') {
          processed.push(event);
          continue;
        }

        if (event.tie_type === 'continue' || event.tie_type === 'stop') {
          const previous = processed.length > 0 ? processed[processed.length - 1] : undefined;
          if (previous && previous.type === 'note' && this.same_pitch(previous, event)) {
            previous.merged_duration_quarters = (previous.merged_duration_quarters ?? duration_quarters(previous)) + duration_quarters(event);
            continue;
          }
        }

        if (event.tie_type === 'start') {
          event.merged_duration_quarters = duration_quarters(event);
        }

        processed.push(event);
      }

      measure.events = processed;
    }

    return score;
  }

  _select_melody_voice(score: Score, strategy: MelodySelectionStrategy, userVoiceId?: number): Note[] {
    const notes = score.measures.flatMap((measure) => measure.events.filter((event): event is Note => event.type === 'note'));

    const groups = new Map<number, Note[]>();
    for (const note of notes) {
      const voice = note.voice ?? 1;
      if (!groups.has(voice)) groups.set(voice, []);
      groups.get(voice)!.push(note);
    }

    if (groups.size === 0) return [];

    if (strategy === 'user_specified' && userVoiceId !== undefined && groups.has(userVoiceId)) {
      return groups.get(userVoiceId)!;
    }

    if (strategy === 'most_active') {
      return [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0][1];
    }

    // highest_pitch (default)
    const avgPitch = (collection: Note[]): number => {
      const values = collection.map((note) => note.pitch.octave * 12 + NOTE_TO_SEMITONE[note.pitch.step] + ACCIDENTAL_OFFSET[note.pitch.accidental]);
      return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    };

    return [...groups.entries()].sort((a, b) => avgPitch(b[1]) - avgPitch(a[1]))[0][1];
  }

  private annotate_note_details_from_xml(score: Score, xml: string): void {
    const doc = this.parser.parse(xml);
    const scorePartwise = doc['score-partwise'];
    const part = asArray(scorePartwise?.part)[0] as Record<string, unknown> | undefined;
    if (!part) return;

    const xmlMeasures = asArray(part.measure) as Array<Record<string, unknown>>;

    for (let measureIndex = 0; measureIndex < Math.min(score.measures.length, xmlMeasures.length); measureIndex++) {
      const measure = score.measures[measureIndex];
      const xmlNotes = asArray(xmlMeasures[measureIndex].note) as Array<Record<string, unknown>>;

      const parsedNotes = measure.events.filter((event): event is Note => event.type === 'note');
      let parsedCursor = 0;

      for (const xmlNote of xmlNotes) {
        const isChordNote = xmlNote.chord !== undefined;
        const isRest = xmlNote.rest !== undefined;
        if (isChordNote || isRest) continue;

        const target = parsedNotes[parsedCursor++];
        if (!target) break;

        const voice = Number(xmlNote.voice);
        if (!Number.isNaN(voice) && voice > 0) {
          target.voice = voice;
        }

        target.is_grace = xmlNote.grace !== undefined;

        const timeMod = xmlNote['time-modification'] as Record<string, unknown> | undefined;
        if (timeMod) {
          const actual = Number(timeMod['actual-notes']);
          const normal = Number(timeMod['normal-notes']);
          if (!Number.isNaN(actual) && !Number.isNaN(normal) && actual > 0) {
            target.tuplet_ratio = normal / actual;
          }
        }

        const ties = asArray(xmlNote.tie as Array<Record<string, unknown>> | Record<string, unknown> | undefined);
        const tied = asArray((xmlNote.notations as Record<string, unknown> | undefined)?.tied as Array<Record<string, unknown>> | Record<string, unknown> | undefined);
        const allTies = [...ties, ...tied];
        const hasStart = allTies.some((t) => t?.['@_type'] === 'start');
        const hasStop = allTies.some((t) => t?.['@_type'] === 'stop');

        if (hasStart && hasStop) target.tie_type = 'continue';
        else if (hasStart) target.tie_type = 'start';
        else if (hasStop) target.tie_type = 'stop';
        else target.tie_type = 'none';
      }
    }
  }

  private same_pitch(a: Note, b: Note): boolean {
    return a.pitch.step === b.pitch.step && a.pitch.accidental === b.pitch.accidental && a.pitch.octave === b.pitch.octave;
  }
}
