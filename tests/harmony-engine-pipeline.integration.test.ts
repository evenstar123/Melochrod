import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HarmonyEnginePipeline } from '../src/harmonizer/harmony-engine-pipeline.js';

describe('HarmonyEnginePipeline integration', () => {
  const twinkleXml = readFileSync(resolve(process.cwd(), 'tests/fixtures/twinkle.xml'), 'utf-8');

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
});

