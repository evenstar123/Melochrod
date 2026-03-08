import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EvaluationMetrics } from '../src/perf/evaluation-metrics.js';
import type { TimeSpan } from '../src/core/harmony-types.js';

interface BenchmarkItem {
  id: string;
  predicted_chords: string[];
  ground_truth_chords: string[];
  time_spans?: TimeSpan[];
  total_duration?: number;
  user_feedback?: Array<{ accepted: boolean; corrections: number }>;
}

interface BenchmarkFile {
  name: string;
  baseline?: {
    che?: number;
    cc?: number;
    ctd?: number;
    cadence_f1?: number;
  };
  items: BenchmarkItem[];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function main(): void {
  const inputPath = resolve(process.argv[2] ?? 'benchmarks/benchmark-sample.json');
  const outputPath = resolve(process.argv[3] ?? 'benchmarks/evaluation-report.json');
  const raw = readFileSync(inputPath, 'utf-8');
  const dataset = JSON.parse(raw) as BenchmarkFile;

  const metrics = new EvaluationMetrics();
  const perItem = dataset.items.map((item) => {
    const che = metrics.compute_che(item.predicted_chords, item.ground_truth_chords);
    const cc = metrics.compute_cc(item.predicted_chords, item.ground_truth_chords);
    const ctd = metrics.compute_ctd(item.predicted_chords, item.ground_truth_chords);
    const cadence = metrics.compute_cadence_metrics(item.predicted_chords, item.ground_truth_chords);
    const rhythmComplexity = metrics.compute_rhythm_complexity(item.time_spans ?? []);
    const harmonicDensity = metrics.compute_harmonic_density(item.time_spans ?? [], item.total_duration ?? 0);
    const userAcceptance = metrics.compute_user_acceptance(item.user_feedback ?? []);

    return {
      id: item.id,
      che,
      cc,
      ctd,
      cadence_precision: cadence.precision,
      cadence_recall: cadence.recall,
      cadence_f1: cadence.f1,
      rhythm_complexity: rhythmComplexity,
      harmonic_density: harmonicDensity,
      acceptance_rate: userAcceptance.acceptance_rate,
      average_corrections: userAcceptance.average_corrections,
    };
  });

  const summary = {
    che: average(perItem.map((item) => item.che)),
    cc: average(perItem.map((item) => item.cc)),
    ctd: average(perItem.map((item) => item.ctd)),
    cadence_f1: average(perItem.map((item) => item.cadence_f1)),
    rhythm_complexity: average(perItem.map((item) => item.rhythm_complexity)),
    harmonic_density: average(perItem.map((item) => item.harmonic_density)),
    acceptance_rate: average(perItem.map((item) => item.acceptance_rate)),
    average_corrections: average(perItem.map((item) => item.average_corrections)),
  };

  const report = {
    benchmark: dataset.name,
    generated_at: new Date().toISOString(),
    sample_count: dataset.items.length,
    baseline: dataset.baseline ?? null,
    summary,
    deltas_to_baseline: dataset.baseline
      ? {
        che: summary.che - (dataset.baseline.che ?? 0),
        cc: summary.cc - (dataset.baseline.cc ?? 0),
        ctd: summary.ctd - (dataset.baseline.ctd ?? 0),
        cadence_f1: summary.cadence_f1 - (dataset.baseline.cadence_f1 ?? 0),
      }
      : null,
    items: perItem,
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Evaluation report generated: ${outputPath}`);
  console.log(`Items: ${dataset.items.length}, CHE=${summary.che.toFixed(4)}, CC=${summary.cc.toFixed(4)}, CTD=${summary.ctd.toFixed(4)}`);
}

main();

