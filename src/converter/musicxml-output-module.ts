import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type { ChordSymbol, Score } from '../core/types.js';
import { measure_start_time } from '../core/music-time.js';
import type { HarmonyAnnotation } from '../core/harmony-types.js';

export interface OutputHarmony {
  start_time: number;
  root: string;
  root_alter?: number;
  quality: string;
  bass?: string;
  bass_alter?: number;
  extensions?: string[];
  alterations?: string[];
  function_symbol?: string;
  offset?: number;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export class MusicXMLOutputModule {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: false,
    isArray: (name) => name === 'measure' || name === 'part' || name === 'note' || name === 'harmony' || name === 'direction',
  });

  private readonly builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: false,
  });

  _quality_to_musicxml_kind(quality: string): string {
    const map: Record<string, string> = {
      major: 'major',
      minor: 'minor',
      dominant7: 'dominant',
      major7: 'major-seventh',
      minor7: 'minor-seventh',
      diminished: 'diminished',
      augmented: 'augmented',
      diminished7: 'diminished-seventh',
      'half-dim7': 'half-diminished',
      sus2: 'suspended-second',
      sus4: 'suspended-fourth',
    };
    return map[quality] ?? 'major';
  }

  _find_measure_at_time(score: Score, time: number): number {
    for (let i = 0; i < score.measures.length; i++) {
      const measure = score.measures[i];
      const start = measure_start_time(score, measure.number);
      const length = (measure.timeChange ?? score.time).beats * (4 / (measure.timeChange ?? score.time).beatType);
      if (time >= start - 1e-6 && time < start + length + 1e-6) {
        return i;
      }
    }

    return Math.max(0, score.measures.length - 1);
  }

  _add_harmony_element(harmony: OutputHarmony): Record<string, unknown> {
    const element: Record<string, unknown> = {
      root: {
        'root-step': harmony.root,
      },
      kind: this._quality_to_musicxml_kind(harmony.quality),
    };

    if (harmony.root_alter !== undefined && harmony.root_alter !== 0) {
      (element.root as Record<string, unknown>)['root-alter'] = harmony.root_alter;
    }

    if (harmony.bass) {
      element.bass = {
        'bass-step': harmony.bass,
      };
      if (harmony.bass_alter !== undefined && harmony.bass_alter !== 0) {
        (element.bass as Record<string, unknown>)['bass-alter'] = harmony.bass_alter;
      }
    }

    const degreeElements: Array<Record<string, unknown>> = [];
    for (const extension of harmony.extensions ?? []) {
      const match = extension.match(/(\d+)/);
      if (!match) continue;
      degreeElements.push({
        'degree-value': Number(match[1]),
        'degree-type': 'add',
      });
    }

    for (const alteration of harmony.alterations ?? []) {
      const match = alteration.match(/([#b]?)(\d+)/);
      if (!match) continue;
      const alter = match[1] === '#' ? 1 : match[1] === 'b' ? -1 : 0;
      degreeElements.push({
        'degree-value': Number(match[2]),
        'degree-alter': alter,
        'degree-type': 'alter',
      });
    }

    if (degreeElements.length > 0) {
      element.degree = degreeElements;
    }

    if (harmony.function_symbol) {
      element.function = harmony.function_symbol;
    }

    if (harmony.offset !== undefined) {
      element.offset = harmony.offset;
    }

    return element;
  }

  _insert_harmony_at_position(
    xmlMeasure: Record<string, unknown>,
    harmonyElement: Record<string, unknown>,
  ): void {
    const existing = asArray(xmlMeasure.harmony as Array<Record<string, unknown>> | Record<string, unknown> | undefined);
    xmlMeasure.harmony = [...existing, harmonyElement];
  }

  output(
    originalXml: string,
    score: Score,
    harmonySequence?: OutputHarmony[] | HarmonyAnnotation[],
  ): string {
    const doc = this.parser.parse(originalXml) as Record<string, unknown>;
    const root = doc['score-partwise'] as Record<string, unknown> | undefined;
    if (!root) {
      throw new Error('Invalid MusicXML: missing score-partwise');
    }

    const part = asArray(root.part as Array<Record<string, unknown>> | Record<string, unknown> | undefined)[0];
    if (!part) {
      throw new Error('Invalid MusicXML: missing part');
    }

    const xmlMeasures = asArray(part.measure as Array<Record<string, unknown>> | Record<string, unknown> | undefined);

    const harmonies = harmonySequence
      ? harmonySequence.map((entry) => this.normalize_harmony(entry))
      : this.from_score(score);

    for (const harmony of harmonies) {
      const measureIndex = this._find_measure_at_time(score, harmony.start_time);
      const xmlMeasure = xmlMeasures[measureIndex];
      if (!xmlMeasure) continue;

      const harmonyElement = this._add_harmony_element(harmony);
      this._insert_harmony_at_position(xmlMeasure, harmonyElement);
    }

    root.part = [
      {
        ...part,
        measure: xmlMeasures,
      },
    ];

    return this.builder.build(doc);
  }

  private normalize_harmony(input: OutputHarmony | HarmonyAnnotation): OutputHarmony {
    if ('local_key' in input) {
      const accidental = input.root_accidental === 'sharp' ? 1 : input.root_accidental === 'flat' ? -1 : 0;
      const bass = input.bass?.match(/^([A-G])([b#]?)/);
      return {
        start_time: input.start_time,
        root: input.root,
        root_alter: accidental,
        quality: input.quality,
        bass: bass?.[1],
        bass_alter: bass?.[2] === '#' ? 1 : bass?.[2] === 'b' ? -1 : 0,
        extensions: input.extensions,
        alterations: input.alterations,
        function_symbol: input.to_roman_numeral_symbol(),
        offset: 0,
      };
    }

    return input;
  }

  private from_score(score: Score): OutputHarmony[] {
    const sequence: OutputHarmony[] = [];

    for (const measure of score.measures) {
      const start = measure_start_time(score, measure.number);
      for (const chord of measure.chords) {
        sequence.push(this.from_chord_symbol(start, chord));
      }
    }

    return sequence;
  }

  private from_chord_symbol(measureStartTime: number, chord: ChordSymbol): OutputHarmony {
    const alter = chord.rootAccidental === 'sharp' ? 1 : chord.rootAccidental === 'flat' ? -1 : 0;
    return {
      start_time: measureStartTime + chord.beat,
      root: chord.root,
      root_alter: alter,
      quality: chord.quality,
      offset: chord.beat,
    };
  }
}
