import type { Score, Note } from '../core/types.js';
import { parseMusicXML } from '../parser/musicxml-parser.js';
import { ACCIDENTAL_OFFSET, DURATION_TO_QUARTERS, NOTE_TO_SEMITONE } from '../core/constants.js';
import { flatten_timed_notes, total_duration } from '../core/music-time.js';

export interface OMRRiskRegion {
  start: number;
  end: number;
  risk_type: 'pitch_outlier' | 'duration_violation' | 'interval_anomaly' | 'accidental_conflict';
}

export interface OMRConfidenceReport {
  overall_confidence: number;
  measure_confidences: Record<number, number>;
  note_confidences: Record<string, number>;
  risk_regions: OMRRiskRegion[];
  alternative_interpretations: Record<string, string[]>;
}

function note_key(measureNumber: number, beat: number, index: number): string {
  return `${measureNumber}:${beat.toFixed(3)}:${index}`;
}

function midi_of(note: Note): number {
  return note.pitch.octave * 12 + NOTE_TO_SEMITONE[note.pitch.step] + ACCIDENTAL_OFFSET[note.pitch.accidental];
}

function scale_for_key(score: Score): Set<number> {
  const tonic = (NOTE_TO_SEMITONE[score.key.tonic] + ACCIDENTAL_OFFSET[score.key.tonicAccidental] + 12) % 12;
  const pattern = score.key.mode === 'minor'
    ? [0, 2, 3, 5, 7, 8, 10]
    : [0, 2, 4, 5, 7, 9, 11];
  return new Set(pattern.map((degree) => (tonic + degree) % 12));
}

const PC_TO_NAME = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export class OMRInterface {
  process_omr_output(musicxml: string): { score: Score; report: OMRConfidenceReport } {
    const score = parseMusicXML(musicxml);
    const report: OMRConfidenceReport = {
      overall_confidence: 1,
      measure_confidences: {},
      note_confidences: {},
      risk_regions: [],
      alternative_interpretations: {},
    };

    for (const measure of score.measures) {
      report.measure_confidences[measure.number] = 0.9;
      let noteIndex = 0;
      for (const event of measure.events) {
        if (event.type !== 'note') continue;
        const key = note_key(measure.number, event.beat, noteIndex++);
        report.note_confidences[key] = event.confidence ?? 0.9;
      }
    }

    this._detect_pitch_outliers(score, report);
    this._detect_duration_violations(score, report);
    this._detect_interval_anomalies(score, report);
    this._detect_accidental_conflicts(score, report);
    this._generate_alternative_interpretations(score, report);

    const noteValues = Object.values(report.note_confidences);
    const measureValues = Object.values(report.measure_confidences);
    const avgNote = noteValues.reduce((sum, value) => sum + value, 0) / Math.max(1, noteValues.length);
    const avgMeasure = measureValues.reduce((sum, value) => sum + value, 0) / Math.max(1, measureValues.length);
    const riskPenalty = Math.min(0.4, report.risk_regions.length * 0.01);

    report.overall_confidence = Math.max(0, Math.min(1, 0.6 * avgNote + 0.4 * avgMeasure - riskPenalty));

    return { score, report };
  }

  _detect_pitch_outliers(score: Score, report: OMRConfidenceReport): void {
    for (const measure of score.measures) {
      let index = 0;
      for (const event of measure.events) {
        if (event.type !== 'note') continue;

        const midi = midi_of(event);
        if (midi < 36 || midi > 96) {
          const key = note_key(measure.number, event.beat, index);
          report.note_confidences[key] = Math.min(report.note_confidences[key] ?? 0.9, 0.3);
          const start = this.measure_start(score, measure.number) + event.beat;
          report.risk_regions.push({
            start,
            end: start + 0.25,
            risk_type: 'pitch_outlier',
          });
        }

        index += 1;
      }
    }
  }

  _detect_duration_violations(score: Score, report: OMRConfidenceReport): void {
    for (const measure of score.measures) {
      const expected = (measure.timeChange ?? score.time).beats * (4 / (measure.timeChange ?? score.time).beatType);
      let actual = 0;

      for (const event of measure.events) {
        const base = DURATION_TO_QUARTERS[event.duration] ?? 1;
        const dotScale = event.dots === 0 ? 1 : event.dots === 1 ? 1.5 : 1.75;
        actual += base * dotScale;
      }

      if (Math.abs(actual - expected) > 0.5) {
        report.measure_confidences[measure.number] = Math.min(report.measure_confidences[measure.number] ?? 0.9, 0.4);
        const start = this.measure_start(score, measure.number);
        report.risk_regions.push({
          start,
          end: start + expected,
          risk_type: 'duration_violation',
        });
      }
    }
  }

  _detect_interval_anomalies(score: Score, report: OMRConfidenceReport): void {
    const notes = flatten_timed_notes(score);
    for (let i = 1; i < notes.length; i++) {
      const previous = notes[i - 1];
      const current = notes[i];
      const interval = Math.abs(midi_of(current.event) - midi_of(previous.event));

      if (interval > 19) {
        const key = note_key(current.measure_number, current.event.beat, i);
        report.note_confidences[key] = Math.min(report.note_confidences[key] ?? 0.9, 0.4);
        report.risk_regions.push({
          start: current.start_time,
          end: current.start_time + 0.25,
          risk_type: 'interval_anomaly',
        });
      }
    }
  }

  _detect_accidental_conflicts(score: Score, report: OMRConfidenceReport): void {
    const scale = scale_for_key(score);

    for (const measure of score.measures) {
      let index = 0;
      for (const event of measure.events) {
        if (event.type !== 'note') continue;

        const pc = (NOTE_TO_SEMITONE[event.pitch.step] + ACCIDENTAL_OFFSET[event.pitch.accidental] + 12) % 12;
        if (!scale.has(pc)) {
          const key = note_key(measure.number, event.beat, index);
          report.note_confidences[key] = Math.min(report.note_confidences[key] ?? 0.9, 0.6);
          const start = this.measure_start(score, measure.number) + event.beat;
          report.risk_regions.push({
            start,
            end: start + 0.25,
            risk_type: 'accidental_conflict',
          });
        }

        index += 1;
      }
    }
  }

  _generate_alternative_interpretations(score: Score, report: OMRConfidenceReport): void {
    for (const measure of score.measures) {
      let index = 0;
      for (const event of measure.events) {
        if (event.type !== 'note') continue;

        const key = note_key(measure.number, event.beat, index);
        const confidence = report.note_confidences[key] ?? 0.9;
        if (confidence >= 0.7) {
          index += 1;
          continue;
        }

        const midi = midi_of(event);
        const alternatives = [-2, -1, 1, 2]
          .map((delta) => midi + delta)
          .filter((value) => value >= 24 && value <= 108)
          .map((value) => {
            const pc = ((value % 12) + 12) % 12;
            const octave = Math.floor(value / 12);
            return `${PC_TO_NAME[pc]}${octave}`;
          });

        report.alternative_interpretations[key] = alternatives;
        index += 1;
      }
    }
  }

  private measure_start(score: Score, measureNumber: number): number {
    let cursor = 0;
    for (const measure of score.measures) {
      if (measure.number === measureNumber) {
        return cursor;
      }
      const time = measure.timeChange ?? score.time;
      cursor += time.beats * (4 / time.beatType);
    }
    return Math.min(cursor, total_duration(score));
  }
}
