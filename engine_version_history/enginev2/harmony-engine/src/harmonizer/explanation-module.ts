import type { ChordCandidate, TimeSpan } from '../core/harmony-types.js';
import { CandidateLattice } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import { CHORD_TEMPLATES, NOTE_TO_SEMITONE, ACCIDENTAL_OFFSET } from '../core/constants.js';
import { events_in_span, flatten_timed_notes } from '../core/music-time.js';

export interface Explanation {
  one_liner: string;
  standard: string;
  deep: string;
  function_role: string;
  melody_notes_analysis: string[];
  cadence_info: string;
  alternatives: Array<{ chord: string; why_it_works: string }>;
  simpler_version: string;
  advanced_version: string;
}

export interface ExplanationLLMProvider {
  generate(prompt: string): Promise<string>;
}

export interface ExplanationGenerateInput {
  score: Score;
  chord_sequence: ChordCandidate[];
  lattice: CandidateLattice;
  span_index: number;
  phrase_boundaries: TimeSpan[];
  key?: string;
  mode?: string;
}

function pitch_class(step: string, accidental: string): number {
  return (NOTE_TO_SEMITONE[step as keyof typeof NOTE_TO_SEMITONE] + ACCIDENTAL_OFFSET[accidental as keyof typeof ACCIDENTAL_OFFSET] + 12) % 12;
}

function chord_tones(candidate: ChordCandidate): Set<number> {
  const rootPc = pitch_class(candidate.root, candidate.root_accidental);
  const template = CHORD_TEMPLATES[candidate.quality] ?? CHORD_TEMPLATES.major;
  return new Set(template.map((value) => (rootPc + value) % 12));
}

function phrase_ending(phraseBoundaries: TimeSpan[], span: TimeSpan): boolean {
  return phraseBoundaries.some((boundary) => Math.abs(boundary[1] - span[1]) < 0.25);
}

export class ExplanationModule {
  constructor(private readonly llm_provider?: ExplanationLLMProvider) {}

  _explain_function_role(candidate: ChordCandidate, key: string, mode: string): string {
    if (candidate.function === 'tonic') {
      return `In ${key} ${mode}, ${candidate.roman_numeral} acts as a point of rest and tonal center.`;
    }
    if (candidate.function === 'subdominant') {
      return `In ${key} ${mode}, ${candidate.roman_numeral} expands away from tonic and prepares motion.`;
    }
    if (candidate.function === 'dominant') {
      return `In ${key} ${mode}, ${candidate.roman_numeral} creates tension that tends to resolve to tonic.`;
    }
    return `In ${key} ${mode}, ${candidate.roman_numeral} plays a transitional harmonic role.`;
  }

  _analyze_melody_chord_relation(score: Score, span: TimeSpan, candidate: ChordCandidate): string[] {
    const notes = events_in_span(flatten_timed_notes(score), span);
    const tones = chord_tones(candidate);

    return notes.map((entry) => {
      const notePc = pitch_class(entry.event.pitch.step, entry.event.pitch.accidental);
      if (tones.has(notePc)) {
        return `${entry.event.pitch.step}${entry.event.pitch.accidental === 'sharp' ? '#' : entry.event.pitch.accidental === 'flat' ? 'b' : ''} is a chord tone.`;
      }

      const nct = entry.event.nct_type ?? 'non-chord tone';
      return `${entry.event.pitch.step}${entry.event.pitch.accidental === 'sharp' ? '#' : entry.event.pitch.accidental === 'flat' ? 'b' : ''} functions as ${nct}.`;
    });
  }

  _explain_cadence(
    sequence: ChordCandidate[],
    spanIndex: number,
    phraseBoundaries: TimeSpan[],
    span: TimeSpan,
  ): string {
    const ending = phrase_ending(phraseBoundaries, span);
    if (!ending || spanIndex === 0) {
      return 'No phrase-ending cadence implied at this position.';
    }

    const prev = sequence[spanIndex - 1];
    const current = sequence[spanIndex];

    if (prev.function === 'dominant' && current.function === 'tonic') {
      return 'Authentic cadence: dominant resolves to tonic and closes the phrase.';
    }

    if (current.function === 'dominant') {
      return 'Half cadence: phrase pauses on dominant tension.';
    }

    if (prev.function === 'dominant' && current.function !== 'tonic') {
      return 'Deceptive cadence: dominant avoids expected tonic resolution.';
    }

    return 'Weak cadence: phrase ending is present but harmonic closure is mild.';
  }

  _generate_alternatives(
    lattice: CandidateLattice,
    spanIndex: number,
    selected: ChordCandidate,
  ): Array<{ chord: string; why_it_works: string }> {
    const alternatives = lattice.get_candidates(spanIndex)
      .filter((candidate) => candidate.roman_numeral !== selected.roman_numeral)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return alternatives.map((candidate) => ({
      chord: candidate.roman_numeral,
      why_it_works: `${candidate.function} function with melody coverage ${(candidate.melody_coverage * 100).toFixed(0)}%.`,
    }));
  }

  _suggest_simpler(selected: ChordCandidate): string {
    if (selected.extensions.length === 0 && selected.quality !== 'dominant7') {
      return `${selected.roman_numeral} is already a simple triadic choice.`;
    }

    const triadRoman = selected.roman_numeral.replace(/7|9|11|13/g, '');
    return `Simpler version: ${triadRoman || selected.roman_numeral} as a plain triad.`;
  }

  _suggest_advanced(selected: ChordCandidate): string {
    if (selected.extensions.length > 0) {
      return `Advanced option: add substitution around ${selected.roman_numeral} (e.g., tritone/secondary dominant).`;
    }

    return `Advanced option: color ${selected.roman_numeral} with 7th/9th extension or modal mixture.`;
  }

  async _generate_deep_explanation(input: {
    selected: ChordCandidate;
    functionRole: string;
    cadenceInfo: string;
    melodyAnalysis: string[];
  }): Promise<string> {
    const prompt = [
      'Explain this harmony decision for teaching context:',
      `Chord: ${input.selected.roman_numeral}`,
      `Role: ${input.functionRole}`,
      `Cadence: ${input.cadenceInfo}`,
      `Melody relation: ${input.melodyAnalysis.join(' | ')}`,
      'Use concise pedagogical language.',
    ].join('\n');

    if (!this.llm_provider) {
      return `Pedagogical explanation: ${input.functionRole} ${input.cadenceInfo} Melody notes support the harmony through chord-tone and passing-tone balance.`;
    }

    try {
      const response = await this.llm_provider.generate(prompt);
      return response.trim();
    } catch {
      return `Pedagogical explanation fallback: ${input.functionRole} ${input.cadenceInfo}`;
    }
  }

  async generate(input: ExplanationGenerateInput): Promise<Explanation> {
    const selected = input.chord_sequence[input.span_index];
    if (!selected) {
      throw new Error(`Span index ${input.span_index} is out of range for chord sequence.`);
    }

    const span = input.lattice.time_spans[input.span_index];
    const key = input.key ?? (selected.local_key.split(' ')[0] || 'C');
    const mode = input.mode ?? selected.mode;

    const functionRole = this._explain_function_role(selected, key, mode);
    const melodyAnalysis = this._analyze_melody_chord_relation(input.score, span, selected);
    const cadenceInfo = this._explain_cadence(input.chord_sequence, input.span_index, input.phrase_boundaries, span);
    const alternatives = this._generate_alternatives(input.lattice, input.span_index, selected);
    const simpler = this._suggest_simpler(selected);
    const advanced = this._suggest_advanced(selected);

    const oneLiner = `${selected.roman_numeral} chosen for ${selected.function} support and melodic fit.`;
    const standard = `${functionRole} ${cadenceInfo}`;
    const deep = await this._generate_deep_explanation({
      selected,
      functionRole,
      cadenceInfo,
      melodyAnalysis,
    });

    return {
      one_liner: oneLiner,
      standard,
      deep,
      function_role: functionRole,
      melody_notes_analysis: melodyAnalysis,
      cadence_info: cadenceInfo,
      alternatives,
      simpler_version: simpler,
      advanced_version: advanced,
    };
  }
}
