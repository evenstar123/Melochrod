import type { ChordCandidate } from '../core/harmony-types.js';

export type UserRole = 'teacher' | 'student' | 'unknown';
export type CorrectionEventType = 'accept' | 'reject' | 'modify';

export interface CorrectionEvent {
  timestamp: number;
  user_id: string;
  institution_id?: string;
  role: UserRole;
  event_type: CorrectionEventType;
  position: number;
  original_chord?: string;
  new_chord?: string;
  context?: {
    style?: string;
    key?: string;
    previous_chord?: string;
  };
}

export interface CorrectionAnalysis {
  total_events: number;
  by_role: Record<UserRole, number>;
  frequently_modified_positions: number[];
  frequently_modified_chords: string[];
}

export interface PreferenceProfile {
  profile_id: string;
  preferred_chords: string[];
  rejected_chords: string[];
  preferred_progressions: string[];
}

function top_n(counter: Map<string, number>, n: number): string[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

function top_n_numbers(counter: Map<number, number>, n: number): number[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

export class UserCorrectionLoop {
  private readonly events: CorrectionEvent[] = [];
  private readonly institution_corpus = new Map<string, string[][]>();

  record_acceptance(input: Omit<CorrectionEvent, 'timestamp' | 'event_type'>): void {
    this.events.push({
      ...input,
      event_type: 'accept',
      timestamp: Date.now(),
    });
  }

  record_rejection(input: Omit<CorrectionEvent, 'timestamp' | 'event_type'>): void {
    this.events.push({
      ...input,
      event_type: 'reject',
      timestamp: Date.now(),
    });
  }

  record_modification(input: Omit<CorrectionEvent, 'timestamp' | 'event_type'>): void {
    this.events.push({
      ...input,
      event_type: 'modify',
      timestamp: Date.now(),
    });
  }

  upload_institution_corpus(institution_id: string, chord_sequences: string[][]): void {
    this.institution_corpus.set(institution_id, chord_sequences);
  }

  get_events(): CorrectionEvent[] {
    return [...this.events];
  }

  analyze_corrections(): CorrectionAnalysis {
    const byRole: Record<UserRole, number> = { teacher: 0, student: 0, unknown: 0 };
    const positionCounter = new Map<number, number>();
    const chordCounter = new Map<string, number>();

    for (const event of this.events) {
      byRole[event.role] += 1;

      if (event.event_type === 'modify' || event.event_type === 'reject') {
        positionCounter.set(event.position, (positionCounter.get(event.position) ?? 0) + 1);
        if (event.original_chord) {
          chordCounter.set(event.original_chord, (chordCounter.get(event.original_chord) ?? 0) + 1);
        }
      }
    }

    return {
      total_events: this.events.length,
      by_role: byRole,
      frequently_modified_positions: top_n_numbers(positionCounter, 5),
      frequently_modified_chords: top_n(chordCounter, 5),
    };
  }

  build_user_style_profile(user_id: string): PreferenceProfile {
    const events = this.events.filter((event) => event.user_id === user_id);
    return this.build_profile(`user:${user_id}`, events);
  }

  build_institution_style_profile(institution_id: string): PreferenceProfile {
    const institutionEvents = this.events.filter((event) => event.institution_id === institution_id);
    const corpus = this.institution_corpus.get(institution_id) ?? [];

    const profile = this.build_profile(`institution:${institution_id}`, institutionEvents);

    const progressionCounter = new Map<string, number>();
    for (const sequence of corpus) {
      for (let i = 1; i < sequence.length; i++) {
        const progression = `${sequence[i - 1]}->${sequence[i]}`;
        progressionCounter.set(progression, (progressionCounter.get(progression) ?? 0) + 1);
      }
    }

    return {
      ...profile,
      preferred_progressions: Array.from(new Set([
        ...profile.preferred_progressions,
        ...top_n(progressionCounter, 6),
      ])),
    };
  }

  rerank_candidates(
    candidates: ChordCandidate[],
    options: {
      user_profile?: PreferenceProfile;
      institution_profile?: PreferenceProfile;
      previous_chord?: string;
    } = {},
  ): ChordCandidate[] {
    const preferred = new Set([
      ...(options.user_profile?.preferred_chords ?? []),
      ...(options.institution_profile?.preferred_chords ?? []),
    ]);
    const rejected = new Set([
      ...(options.user_profile?.rejected_chords ?? []),
      ...(options.institution_profile?.rejected_chords ?? []),
    ]);
    const preferredProgressions = new Set([
      ...(options.user_profile?.preferred_progressions ?? []),
      ...(options.institution_profile?.preferred_progressions ?? []),
    ]);

    const reranked = candidates.map((candidate) => {
      let boost = 0;
      if (preferred.has(candidate.roman_numeral)) {
        boost += 0.2;
      }
      if (rejected.has(candidate.roman_numeral)) {
        boost -= 0.25;
      }
      if (options.previous_chord && preferredProgressions.has(`${options.previous_chord}->${candidate.roman_numeral}`)) {
        boost += 0.15;
      }

      return {
        ...candidate,
        confidence: Math.max(0, Math.min(1, candidate.confidence + boost)),
      };
    });

    return reranked.sort((a, b) => b.confidence - a.confidence);
  }

  private build_profile(profile_id: string, events: CorrectionEvent[]): PreferenceProfile {
    const preferredChords = new Map<string, number>();
    const rejectedChords = new Map<string, number>();
    const progressionCounter = new Map<string, number>();

    for (const event of events) {
      if (event.event_type === 'accept' && event.new_chord) {
        preferredChords.set(event.new_chord, (preferredChords.get(event.new_chord) ?? 0) + 1);
      }
      if (event.event_type === 'modify' && event.new_chord) {
        preferredChords.set(event.new_chord, (preferredChords.get(event.new_chord) ?? 0) + 1);
      }
      if ((event.event_type === 'reject' || event.event_type === 'modify') && event.original_chord) {
        rejectedChords.set(event.original_chord, (rejectedChords.get(event.original_chord) ?? 0) + 1);
      }

      const previous = event.context?.previous_chord;
      const current = event.new_chord;
      if (previous && current) {
        const progression = `${previous}->${current}`;
        progressionCounter.set(progression, (progressionCounter.get(progression) ?? 0) + 1);
      }
    }

    return {
      profile_id,
      preferred_chords: top_n(preferredChords, 8),
      rejected_chords: top_n(rejectedChords, 8),
      preferred_progressions: top_n(progressionCounter, 8),
    };
  }
}

