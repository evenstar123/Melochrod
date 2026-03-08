import { describe, expect, it } from 'vitest';
import { ConfidenceCalibrator } from '../src/harmonizer/confidence-calibrator.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('ConfidenceCalibrator', () => {
  it('outputs chord/measure/overall confidence in [0,1]', () => {
    const calibrator = new ConfidenceCalibrator();
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1)]),
      make_measure(2, [make_note('G', 0), make_note('B', 1)]),
    ]);

    const output = calibrator.compute_confidence_output({
      score,
      chord_sequence: [
        {
          local_key: 'C major',
          mode: 'major',
          roman_numeral: 'I',
          function: 'tonic',
          root: 'C',
          root_accidental: 'none',
          quality: 'major',
          inversion: 'root',
          extensions: [],
          alterations: [],
          confidence: 0.8,
          difficulty: 'basic',
          source: 'rule',
          explanation: 'I',
          melody_coverage: 0.8,
          beat_alignment: 0.8,
          function_fit: 0.8,
          style_fit: 0.7,
        },
        {
          local_key: 'C major',
          mode: 'major',
          roman_numeral: 'V',
          function: 'dominant',
          root: 'G',
          root_accidental: 'none',
          quality: 'major',
          inversion: 'root',
          extensions: [],
          alterations: [],
          confidence: 0.6,
          difficulty: 'basic',
          source: 'rule',
          explanation: 'V',
          melody_coverage: 0.8,
          beat_alignment: 0.8,
          function_fit: 0.8,
          style_fit: 0.7,
        },
      ],
      time_spans: [[0, 4], [4, 8]],
      key_confidence: 0.7,
      omr_confidence: 0.9,
    });

    expect(output.chords.length).toBe(2);
    expect(output.measures.length).toBe(2);
    expect(output.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(output.overall_confidence).toBeLessThanOrEqual(1);
    expect(output.decomposition.key_confidence).toBeGreaterThanOrEqual(0);
    expect(output.decomposition.omr_confidence).toBeLessThanOrEqual(1);
  });

  it('calibration improves confidence-to-correction alignment', () => {
    const rawSamples = [
      { confidence: 0.2, actual_correction_rate: 0.6 },
      { confidence: 0.4, actual_correction_rate: 0.45 },
      { confidence: 0.6, actual_correction_rate: 0.3 },
      { confidence: 0.8, actual_correction_rate: 0.2 },
      { confidence: 0.9, actual_correction_rate: 0.1 },
    ];

    const before = new ConfidenceCalibrator();
    const beforeError = before.mean_absolute_error(rawSamples);

    const calibrated = new ConfidenceCalibrator();
    for (const sample of rawSamples) {
      calibrated.collect(sample.confidence, sample.actual_correction_rate);
    }
    calibrated.fit();
    const afterError = calibrated.mean_absolute_error(rawSamples);

    expect(afterError).toBeLessThan(beforeError);
  });
});

