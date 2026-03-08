import { describe, expect, it } from 'vitest';
import { OMRInterface } from '../src/omr/omr-interface.js';

const omrXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>8</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>6</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

describe('OMRInterface', () => {
  it('detects pitch outliers and duration violations', () => {
    const omr = new OMRInterface();
    const { report } = omr.process_omr_output(omrXml);

    const hasPitchOutlier = report.risk_regions.some((region) => region.risk_type === 'pitch_outlier');
    const hasDurationViolation = report.risk_regions.some((region) => region.risk_type === 'duration_violation');

    expect(hasPitchOutlier).toBe(true);
    expect(hasDurationViolation).toBe(true);
  });

  it('detects interval anomalies and accidental conflicts', () => {
    const omr = new OMRInterface();
    const { report } = omr.process_omr_output(omrXml);

    const hasInterval = report.risk_regions.some((region) => region.risk_type === 'interval_anomaly');
    const hasAccidentalConflict = report.risk_regions.some((region) => region.risk_type === 'accidental_conflict');

    expect(hasInterval).toBe(true);
    expect(hasAccidentalConflict).toBe(true);
  });

  it('generates alternatives for low-confidence notes', () => {
    const omr = new OMRInterface();
    const { report } = omr.process_omr_output(omrXml);

    const alternatives = Object.values(report.alternative_interpretations);
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives[0].length).toBeGreaterThanOrEqual(2);
    expect(report.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(report.overall_confidence).toBeLessThanOrEqual(1);
  });
});
