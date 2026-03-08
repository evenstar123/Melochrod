import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HarmonyEnginePipeline } from '../src/harmonizer/harmony-engine-pipeline.js';

describe('HarmonyEnginePipeline integration', () => {
  const twinkleXml = readFileSync(resolve(process.cwd(), 'tests/fixtures/twinkle.xml'), 'utf-8');
  const step1Xml = readFileSync(resolve(process.cwd(), '../melochord-miniprogram/test_data/step1.xml'), 'utf-8');

  it('runs end-to-end from sample MusicXML and returns annotated MusicXML', async () => {
    const pipeline = new HarmonyEnginePipeline();
    const result = await pipeline.run_from_input(
      { type: 'musicxml', content: twinkleXml },
      { difficulty: 'basic', style: 'hymn' },
    );

    expect(result.time_spans.length).toBeGreaterThan(0);
    expect(result.chord_sequence.length).toBeGreaterThan(0);
    expect(result.annotated_musicxml).toContain('<harmony>');
    expect(result.metadata.input_type).toBe('musicxml');
    expect(result.monitoring.execution_ms).toBeGreaterThanOrEqual(0);
  });

  it('supports different difficulty levels', async () => {
    const pipeline = new HarmonyEnginePipeline();
    const basic = await pipeline.run_from_input(
      { type: 'musicxml', content: twinkleXml },
      { difficulty: 'basic', style: 'hymn' },
    );
    const advanced = await pipeline.run_from_input(
      { type: 'musicxml', content: twinkleXml },
      { difficulty: 'advanced', style: 'hymn' },
    );

    expect(basic.metadata.difficulty).toBe('basic');
    expect(advanced.metadata.difficulty).toBe('advanced');
    expect(basic.chord_sequence.length).toBeGreaterThan(0);
    expect(advanced.chord_sequence.length).toBeGreaterThan(0);
  });

  it('supports different styles', async () => {
    const pipeline = new HarmonyEnginePipeline();
    const hymn = await pipeline.run_from_input(
      { type: 'musicxml', content: twinkleXml },
      { difficulty: 'intermediate', style: 'hymn' },
    );
    const jazzLite = await pipeline.run_from_input(
      { type: 'musicxml', content: twinkleXml },
      { difficulty: 'intermediate', style: 'jazz-lite' },
    );

    expect(hymn.metadata.style).toBe('hymn');
    expect(jazzLite.metadata.style).toBe('jazz-lite');
    expect(hymn.total_score).toBeTypeOf('number');
    expect(jazzLite.total_score).toBeTypeOf('number');
  });

  it('returns partial result with warnings when OMR input is missing', async () => {
    const pipeline = new HarmonyEnginePipeline();
    const result = await pipeline.run_from_input(
      { type: 'pdf' },
      { difficulty: 'basic', style: 'hymn' },
    );

    expect(result.metadata.degraded).toBe(true);
    expect(result.metadata.warnings.length).toBeGreaterThan(0);
    expect(result.metadata.errors.length).toBeGreaterThan(0);
    expect(result.chord_sequence).toHaveLength(0);
  });

  it('prefers score key signatures over the unreliable key-sequence analyzer', async () => {
    const pipeline = new HarmonyEnginePipeline();
    const result = await pipeline.run_from_input(
      { type: 'musicxml', content: step1Xml },
      { difficulty: 'basic', style: 'hymn' },
    );

    expect(result.key_sequence.length).toBeGreaterThan(0);
    expect(result.key_sequence[0].key).toBe('Eb');
    expect(result.key_sequence[0].mode).toBe('major');

    const renderedRoots = new Set(
      result.score.measures.flatMap((measure) =>
        measure.chords.map((chord) => `${chord.root}${chord.rootAccidental === 'flat' ? 'b' : chord.rootAccidental === 'sharp' ? '#' : ''}`),
      ),
    );
    const renderedChords = result.score.measures.flatMap((measure) => measure.chords);

    expect(renderedRoots.has('G#')).toBe(false);
    expect(renderedRoots.has('Eb')).toBe(true);
    expect(renderedChords[0]?.root).toBe('E');
    expect(renderedChords[0]?.rootAccidental).toBe('flat');
    expect(renderedChords[renderedChords.length - 1]?.root).toBe('E');
    expect(renderedChords[renderedChords.length - 1]?.rootAccidental).toBe('flat');
  });
});
