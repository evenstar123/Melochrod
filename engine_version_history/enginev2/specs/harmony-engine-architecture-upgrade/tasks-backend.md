# Backend Engine Implementation Tasks

## Overview

Backend implementation in **TypeScript**, upgrading the existing `harmony-engine/` project from LLM-driven to constraint-based search with LLM assistance.

**Programming Language**: TypeScript锛堝湪鐜版湁 `harmony-engine/` 椤圭洰涓婂崌绾э級
**Runtime**: Node.js锛坱sx锛?
**Build**: tsup
**Test**: vitest + fast-check
**Total Requirements**: 30 (Requirements 1-30)
**Estimated Modules**: 20+

> **娉ㄦ剰**锛氭墍鏈夋柊妯″潡搴斿湪鐜版湁 `harmony-engine/src/` 鐩綍涓嬪垱寤猴紝閬靛惊鐜版湁浠ｇ爜椋庢牸锛圱ypeScript 鎺ュ彛/绫伙級銆?
> 璁捐鏂囨。 (`design.md`) 涓殑 Python 浠ｇ爜浠呬负浼唬鐮侊紝鐢ㄤ簬琛ㄨ揪绠楁硶閫昏緫锛屽疄闄呭疄鐜颁娇鐢?TypeScript銆?

---

## 1. Core Architecture Setup

- [x] 1.1 Set up project structure for new architecture
  - Create `harmony-engine/src/candidate/` for candidate generation
  - Create `harmony-engine/src/decoder/` for global decoding
  - Create `harmony-engine/src/repair/` for repair system
  - Extend existing `harmony-engine/src/core/` with new types and interfaces
  - Follow existing TypeScript module structure (no `__init__.py`)
  - _Requirements: 1, 2, 3_

- [ ]* 1.2 Write unit tests for project structure
  - Test module imports and package structure
  - Verify directory organization
  - _Requirements: 1_

## 2. Data Structures and IR Enhancements

- [x] 2.1 Implement dual-layer harmony representation
  - Create `HarmonyAnnotation` dataclass with functional and surface layers
  - Implement `to_chord_symbol()` and `to_roman_numeral_symbol()` methods
  - Add local_key, mode, roman_numeral, function fields
  - Add root, quality, inversion, bass, extensions, alterations fields
  - Add time information (start_time, end_time)
  - Add metadata (confidence, difficulty, cadence_role, explanation)
  - _Requirements: 12_

- [x] 2.2 Enhance Note dataclass with salience analysis
  - Add is_downbeat, is_strong_beat, beat_weight, duration_weight fields
  - Add salience field (莽禄录氓锟剿喢λ溌久ㄢ€樷€斆︹偓?
  - Add nct_type (茅锟脚久モ€櫯捗ヂ悸γ┡嘎趁甭幻ヅ锯€? and chord_tone_tendency fields
  - Add phrase_boundary boolean field
  - _Requirements: 13_

- [x] 2.3 Implement ChordCandidate dataclass
  - Create complete ChordCandidate with surface and functional representation
  - Add metadata fields (confidence, difficulty, source, explanation)
  - Add scoring components (melody_coverage, beat_alignment, function_fit, style_fit)
  - _Requirements: 1_


- [x] 2.4 Implement CandidateLattice dataclass
  - Create time_spans list of (start_time, end_time) tuples
  - Create candidates list of ChordCandidate lists
  - Create transition_scores dictionary
  - Implement get_candidates() and get_transition_score() methods
  - _Requirements: 1_

- [x]* 2.5 Write unit tests for data structures
  - Test HarmonyAnnotation conversion methods
  - Test ChordCandidate scoring components
  - Test CandidateLattice access methods
  - _Requirements: 12, 13, 1_

## 3. Candidate Lattice Generation System

- [x] 3.1 Implement RuleRouter for theory-based candidates
  - Create RuleRouter class with generate() method
  - Implement functional harmony rules (T/S/D progression)
  - Generate candidates based on strong beat notes
  - Boost cadence candidates at phrase endings
  - Apply difficulty-based chord type filtering
  - Filter by melody coverage
  - _Requirements: 1_

- [x] 3.2 Implement RetrievalRouter for RAG-based candidates
  - Create RetrievalRouter class with generate() method
  - Extract harmonic semantic features (backbone notes, phrase position, stability)
  - Call RAGModule.hybrid_search() with features
  - Extract candidates from retrieval results
  - Add source="retrieval" and explanation metadata
  - _Requirements: 1, 9_

- [x] 3.3 Implement ModelRouter for LLM/symbolic model candidates
  - Create ModelRouter class with generate() method
  - Prioritize local symbolic model predictions
  - Call LLM only for low-confidence regions or edge cases
  - Parse LLM response into ChordCandidate objects
  - Add source="model" metadata
  - _Requirements: 1, 3_

- [x] 3.4 Implement CandidateLatticeGenerator
  - Create main generator class coordinating three routers
  - Implement generate() method taking IR, time_spans, key_sequence, difficulty, style
  - For each time span, call all three routers
  - Merge and deduplicate candidates
  - Apply difficulty filtering
  - Compute transition scores between all candidate pairs
  - Return complete CandidateLattice
  - _Requirements: 1_

- [x]* 3.5 Write property tests for candidate generation
  - **Property 1: All candidates have valid chord structure**
  - **Validates: Requirements 1**
  - Test that all generated candidates have non-empty root and quality
  - Test that roman_numeral matches local_key

- [x]* 3.6 Write unit tests for candidate routers
  - Test RuleRouter generates appropriate functional chords
  - Test RetrievalRouter integrates with RAG module
  - Test ModelRouter prioritizes symbolic model over LLM
  - Test CandidateLatticeGenerator merges candidates correctly
  - _Requirements: 1, 3_


## 4. Global Constraint Decoder

- [x] 4.1 Implement local scoring function
  - Create _compute_local_score() method
  - Calculate melody-chord matching (strong beat coverage)
  - Calculate key matching (chord belongs to current key)
  - Calculate strong beat coverage ratio
  - Calculate difficulty matching
  - Weight and combine scores (0.4 + 0.2 + 0.2 + 0.1 + 0.1)
  - _Requirements: 2_

- [x] 4.2 Implement transition scoring function
  - Create _compute_transition_score() method
  - Evaluate functional progression (T芒鈥犫€橲芒鈥犫€橠芒鈥犫€橳)
  - Evaluate cadence tendency at phrase endings
  - Calculate bass line smoothness (interval penalty)
  - Look up historical transition probability
  - Evaluate key continuity (modulation penalty)
  - Weight and combine scores (0.3 + 0.2 + 0.2 + 0.2 + 0.1)
  - _Requirements: 2_

- [x] 4.3 Implement Viterbi algorithm decoder
  - Create _viterbi_decode() method
  - Initialize DP table for all time spans and candidates
  - Compute local scores for first span
  - For each subsequent span, find best predecessor
  - Combine local score + transition score + predecessor score
  - Backtrack to recover optimal path
  - Return (chord_sequence, total_score)
  - _Requirements: 2_

- [x] 4.4 Implement Beam Search decoder
  - Create _beam_search_decode() method
  - Maintain top-K paths at each time span (beam_width=3-5)
  - Expand each path with all candidates
  - Score expanded paths with local + transition scores
  - Keep only top-K paths
  - Return best path from final beam
  - _Requirements: 2_

- [x] 4.5 Implement GlobalDecoder class
  - Create main decoder class with algorithm parameter
  - Implement decode() method dispatching to Viterbi or Beam Search
  - Add configuration for scoring weights
  - Add transition probability matrix loading
  - _Requirements: 2_

- [x]* 4.6 Write property tests for global decoder
  - **Property 2: Decoded sequence respects lattice structure**
  - **Validates: Requirements 2**
  - Test that each chord in sequence comes from corresponding lattice span
  - Test that sequence length matches number of time spans

- [x]* 4.7 Write unit tests for decoder
  - Test local scoring with known melody-chord pairs
  - Test transition scoring with known progressions
  - Test Viterbi finds optimal path in small lattice
  - Test Beam Search maintains beam width
  - _Requirements: 2_


## 5. Three-Layer Repair System

- [x] 5.1 Implement Layer 1: Strong beat coverage repair
  - Create _repair_melody_coverage() method
  - For each chord, check strong beat note coverage
  - If coverage < 0.7, search candidates for better coverage
  - Replace with highest-coverage candidate
  - Add "[盲驴庐氓陇锟矫寂∶︼拷锟矫┞溍︹€斺€姑ヂ锯€姑︹€犆р€衡€撁解€" to explanation
  - _Requirements: 6_

- [x] 5.2 Implement Layer 2: Transition probability repair
  - Create _repair_transitions() method
  - For each consecutive chord pair, check transition probability
  - If probability < 0.05, search for better transition
  - Try replacing second chord with higher-probability candidate
  - Add "[盲驴庐氓陇锟矫寂∶︹€澛姑モ€撯€灻ヅ犈该ㄆ捖矫库€好∨抅" to explanation
  - _Requirements: 6_

- [x] 5.3 Implement Layer 3: Cadence repair
  - Create _repair_cadences() method
  - Identify phrase boundaries from IR
  - For each phrase ending, check if chord is stable cadence
  - If not stable, search for tonic or dominant cadence candidates
  - Replace with best cadence candidate
  - Add "[盲驴庐氓陇锟矫寂∶ヂ悸好ヅ掆€撁凰喢β⒚ヂ硷拷]" to explanation
  - _Requirements: 6_

- [x] 5.4 Implement ThreeLayerRepairer class
  - Create main repairer class
  - Implement repair() method applying all three layers sequentially
  - Pass lattice for candidate lookup
  - Return repaired chord sequence
  - Track repair operations for logging
  - _Requirements: 6_

- [x]* 5.5 Write property tests for repair system
  - **Property 3: Repaired sequence has higher coverage than original**
  - **Validates: Requirements 6**
  - Test that strong beat coverage improves after Layer 1
  - Test that transition probabilities improve after Layer 2

- [x]* 5.6 Write unit tests for repairer
  - Test Layer 1 improves melody coverage
  - Test Layer 2 fixes low-probability transitions
  - Test Layer 3 strengthens cadences
  - Test repair preserves sequence length
  - _Requirements: 6_

## 6. Harmonic Rhythm Prediction

- [x] 6.1 Implement HarmonicRhythmPredictor class
  - Create predictor with predict() method
  - Accept IR, difficulty, style as inputs
  - Determine base duration from difficulty (basic=4.0, intermediate=2.0, advanced=1.0)
  - Process each phrase from phrase_boundaries
  - Return list of (start_time, end_time) tuples
  - _Requirements: 4_

- [x] 6.2 Implement phrase rhythm prediction
  - Create _predict_phrase_rhythm() method
  - Find next change point based on musical cues
  - Check for phrase boundaries (highest priority)
  - Check for strong beat + long duration notes
  - Check for rests
  - Use base duration as fallback
  - _Requirements: 4_

- [x] 6.3 Implement change point detection
  - Create _find_next_change_point() method
  - Collect candidate change points with weights
  - Filter candidates too close (< 0.5 beats)
  - Select highest-weight candidate near base duration
  - _Requirements: 4_


- [x]* 6.4 Write property tests for harmonic rhythm
  - **Property 4: Time spans cover entire piece without gaps**
  - **Validates: Requirements 4**
  - Test that first span starts at 0.0
  - Test that last span ends at total duration
  - Test that spans are contiguous (no gaps or overlaps)

- [x]* 6.5 Write unit tests for harmonic rhythm predictor
  - Test basic difficulty produces sparse rhythm (one per measure)
  - Test advanced difficulty produces dense rhythm
  - Test phrase boundaries are respected
  - _Requirements: 4_

## 7. Phrase Segmentation

- [x] 7.1 Implement PhraseSegmentationModule class
  - Create module with segment() method
  - Accept IR and overlap_ratio parameter
  - Return list of phrase boundaries (start_time, end_time)
  - _Requirements: 5_

- [x] 7.2 Implement candidate boundary detection
  - Create _find_candidate_boundaries() method
  - Detect rests (highest confidence)
  - Detect long notes (>= 3.0 duration)
  - Detect rhythm sparse points
  - Detect barlines (weak candidates)
  - Return sorted unique candidate times
  - _Requirements: 5_

- [x] 7.3 Implement boundary scoring
  - Create _score_boundary() method
  - Score rest presence (0.4)
  - Score long note ending (0.25)
  - Score closure tendency (melodic descent to stable degree) (0.2)
  - Score barline alignment (0.1)
  - Score density change (0.05)
  - _Requirements: 5_

- [x] 7.4 Implement boundary selection and phrase building
  - Create _select_boundaries() method to choose high-score boundaries
  - Create _build_phrase_intervals() to construct phrase spans
  - Implement fallback to fixed windows (4 or 8 measures) if boundaries unclear
  - _Requirements: 5_

- [x] 7.5 Implement overlapping window generation
  - Create get_overlapping_windows() method
  - Add overlap_ratio * duration to each phrase boundary
  - Return extended windows for cross-phrase context
  - _Requirements: 5_

- [x]* 7.6 Write property tests for phrase segmentation
  - **Property 5: Phrases cover entire piece**
  - **Validates: Requirements 5**
  - Test that phrases span from 0 to total duration
  - Test that phrases don't have large gaps

- [x]* 7.7 Write unit tests for phrase segmentation
  - Test rest detection creates boundaries
  - Test long notes create boundaries
  - Test fallback to fixed windows when unclear
  - _Requirements: 5_


## 8. Key Sequence Analysis

- [x] 8.1 Implement KeyInfo dataclass
  - Create dataclass with key, mode, confidence, start_time, end_time
  - Support major, minor, and modal scales (mixolydian, lydian, phrygian)
  - _Requirements: 8_

- [x] 8.2 Implement key score computation
  - Create _compute_key_scores() method
  - Calculate pitch class distribution (Krumhansl-Schmuckler)
  - Evaluate implied harmony from strong beat notes
  - Detect cadence cues (V-I at phrase endings)
  - Check accidentals for modulation hints
  - Return scores for all possible keys
  - _Requirements: 8_

- [x] 8.3 Implement Viterbi key sequence decoder
  - Create _viterbi_key_sequence() method
  - Initialize DP table with key scores for first window
  - Apply key inertia (0.8) for staying in same key
  - Apply modulation penalty (0.3) for distant keys
  - Reduce penalty for related keys (dominant, subdominant, relative)
  - Backtrack to recover optimal key sequence
  - _Requirements: 8_

- [x] 8.4 Implement KeySequenceAnalyzer class
  - Create analyzer with analyze() method
  - Divide melody into windows (e.g., 8 beats = 2 measures)
  - Compute key scores for each window
  - Run Viterbi to find optimal key sequence
  - Return list of KeyInfo objects
  - _Requirements: 8_

- [x]* 8.5 Write property tests for key analysis
  - **Property 6: Key sequence has reasonable inertia**
  - **Validates: Requirements 8**
  - Test that key doesn't change every window
  - Test that modulations are to related keys

- [x]* 8.6 Write unit tests for key analyzer
  - Test key detection on known melodies
  - Test modulation detection
  - Test key inertia prevents spurious changes
  - _Requirements: 8_

## 9. Functional State Machine

- [x] 9.1 Implement FunctionalStateTracker class
  - Define state constants (tonic, subdominant, dominant, cadence_preparation, etc.)
  - Define legal state transitions matrix
  - Initialize with current_state = "tonic"
  - _Requirements: 7_

- [x] 9.2 Implement state tracking
  - Create track() method accepting IR, key_sequence, phrase_boundaries
  - For each time point, determine phrase position
  - Extract melody cues (leading tone, subdominant emphasis)
  - Determine next state based on current state and cues
  - Return state sequence
  - _Requirements: 7_

- [x] 9.3 Implement chord constraint generation
  - Create get_allowed_chords() method
  - Map each state to allowed chord list
  - Filter by difficulty level
  - Return constrained chord list
  - _Requirements: 7_

- [x] 9.4 Implement cadence weight boosting
  - Create boost_cadence_weight() method
  - Return 1.5x boost for cadence_preparation/resolution states
  - Return 1.2x boost for dominant state
  - Return 1.0x (no boost) otherwise
  - _Requirements: 7_


- [x]* 9.5 Write unit tests for functional state machine
  - Test state transitions follow legal paths
  - Test phrase start resets to tonic
  - Test phrase end progresses toward cadence
  - Test allowed chords match state
  - _Requirements: 7_

## 10. RAG Retrieval Upgrades

- [x] 10.1 Implement harmonic semantic feature extraction
  - Create HarmonicSemanticFeatureExtractor class
  - Implement extract() method returning feature dictionary
  - Extract backbone notes (downbeats, strong beats, long notes)
  - Determine phrase position (opening, middle, pre_cadence, closing)
  - Compute melody stability (chord tone tendency)
  - Compute rhythm-harmony coupling
  - Extract cadence pattern
  - _Requirements: 9_

- [x] 10.2 Implement symbolic filtering
  - Create _symbolic_filter() method in HybridRetrievalStrategy
  - Filter by key, mode, style
  - Filter by time signature and phrase length
  - Filter by harmonic density
  - Return filtered segment candidates
  - _Requirements: 10_

- [x] 10.3 Implement sparse symbolic search
  - Create _sparse_search() method
  - Extract scale degree n-grams from query
  - Match beat position patterns
  - Compare interval contours
  - Score and rank candidates
  - Return top-K results with scores
  - _Requirements: 10_

- [x] 10.4 Implement dense vector search
  - Create _dense_search() method
  - Encode query melody with transposition-normalized encoder
  - Compute cosine similarity with segment embeddings
  - Rank by similarity
  - Return top-K results with scores
  - _Requirements: 10_

- [x] 10.5 Implement hybrid fusion
  - Create _fuse_results() method
  - Combine sparse (weight=0.4) and dense (weight=0.6) scores
  - Rank by fused score
  - Return top-K segments
  - _Requirements: 10_

- [x] 10.6 Implement HybridRetrievalStrategy class
  - Create strategy with search() method
  - Coordinate symbolic filter, sparse search, dense search, fusion
  - Return ranked similar segments
  - _Requirements: 10_

- [x]* 10.7 Write unit tests for RAG upgrades
  - Test feature extraction produces expected fields
  - Test symbolic filtering reduces candidate set
  - Test sparse and dense search return ranked results
  - Test fusion combines scores correctly
  - _Requirements: 9, 10_


## 11. Difficulty Control System

- [x] 11.1 Define difficulty constraints
  - Create difficulty_constraints dictionary
  - Define basic: I/IV/V/vi, no inversions, no extensions, rhythm=1.0
  - Define intermediate: I/ii/iii/IV/V/vi/viio, 7th chords, inversions, rhythm=2.0
  - Define advanced: all chords, extensions up to 13, secondary dominants, modal mixture, rhythm=4.0
  - _Requirements: 11_

- [x] 11.2 Implement candidate filtering
  - Create DifficultyController class with filter() method
  - Check chord type against allowed list
  - Check quality against allowed list
  - Check extension degree against max
  - Check inversion against allow_inversions
  - Check secondary dominants and modal mixture
  - Return filtered candidates
  - _Requirements: 11_

- [x] 11.3 Implement scoring weight adjustment
  - Create adjust_weights() method
  - Return weights for basic (melody_coverage=0.5, function_fit=0.3)
  - Return weights for intermediate (balanced)
  - Return weights for advanced (style_fit=0.3, complexity_penalty=0.3)
  - _Requirements: 11_

- [x]* 11.4 Write unit tests for difficulty controller
  - Test basic filters out complex chords
  - Test intermediate allows 7th chords
  - Test advanced allows all chord types
  - Test weight adjustment matches difficulty
  - _Requirements: 11_

## 12. Note Salience Analysis

- [x] 12.1 Implement NoteSalienceAnalyzer class
  - Create analyzer with analyze() method
  - Accept IR and return annotated IR
  - _Requirements: 13_

- [x] 12.2 Implement beat weight computation
  - Create _compute_beat_weight() method
  - Assign 1.0 for downbeat
  - Assign 0.8 for strong beat
  - Assign 0.5 for medium beat
  - Assign 0.3 for weak beat
  - _Requirements: 13_

- [x] 12.3 Implement duration weight computation
  - Create _compute_duration_weight() method
  - Calculate min(1.0, duration / 4.0)
  - Longer notes get higher weight
  - _Requirements: 13_

- [x] 12.4 Implement chord tone tendency computation
  - Create _compute_chord_tone_tendency() method
  - Get scale degree in current key
  - Assign tendency: 1=1.0, 5=0.9, 3=0.8, 4=0.7, others=0.5
  - _Requirements: 13_

- [x] 12.5 Implement non-chord tone classification
  - Create _classify_nct() method
  - Detect passing tones (stepwise motion through)
  - Detect neighbor tones (stepwise away and back)
  - Detect appoggiaturas (leap to, step away)
  - Detect suspensions (held note, step down)
  - Return NCT type or None
  - _Requirements: 13_

- [x] 12.6 Integrate salience analysis into pipeline
  - Call NoteSalienceAnalyzer.analyze() after IR construction
  - Compute salience = beat_weight 脙鈥?duration_weight 脙鈥?chord_tone_tendency
  - Store in Note.salience field
  - _Requirements: 13_


- [x]* 12.7 Write unit tests for salience analysis
  - Test beat weight assignment
  - Test duration weight calculation
  - Test chord tone tendency by scale degree
  - Test NCT classification
  - _Requirements: 13_

## 13. Parser Enhancements

- [x] 13.1 Implement pickup measure detection
  - Create _detect_pickup() method in EnhancedMusicXMLParser
  - Check if first measure duration < expected duration
  - Return pickup duration (expected - actual)
  - _Requirements: 14_

- [x] 13.2 Implement tuplet processing
  - Create _process_tuplets() method
  - Detect tuplet groups (triplets, quintuplets)
  - Adjust duration by ratio (normal_notes / actual_notes)
  - Return processed notes
  - _Requirements: 14_

- [x] 13.3 Implement grace note processing
  - Create _process_grace_notes() method
  - Mark notes as grace notes
  - Reduce salience to 0.1 (mostly ignore in harmony analysis)
  - Return processed notes
  - _Requirements: 14_

- [x] 13.4 Implement tie processing
  - Create _process_ties() method
  - Detect tie_type = "start", "continue", "stop"
  - Merge tied note durations
  - Keep only first note, remove subsequent tied notes
  - Return processed notes
  - _Requirements: 14_

- [x] 13.5 Implement melody voice selection
  - Create _select_melody_voice() method
  - Support strategies: highest pitch, most active, user-specified
  - Group notes by voice
  - Select melody voice by strategy
  - Return melody notes
  - _Requirements: 14_

- [x] 13.6 Integrate parser enhancements
  - Update EnhancedMusicXMLParser.parse() to call all processing methods
  - Process in order: pickup 芒鈥?notes 芒鈥?tuplets 芒鈥?grace notes 芒鈥?ties 芒鈥?voice selection
  - Return enhanced IR
  - _Requirements: 14_

- [x]* 13.7 Write unit tests for parser enhancements
  - Test pickup detection on incomplete first measure
  - Test tuplet duration adjustment
  - Test grace note salience reduction
  - Test tie merging
  - Test voice selection strategies
  - _Requirements: 14_

## 14. MusicXML Output Upgrades

- [x] 14.1 Implement XML AST-based output
  - Create MusicXMLOutputModule class
  - Use XML parser library (e.g., xml.etree.ElementTree)
  - Parse original MusicXML into tree
  - _Requirements: 15_

- [x] 14.2 Implement harmony element creation
  - Create _add_harmony_element() method
  - Add <root> with <root-step>
  - Add <kind> for chord quality
  - Add <bass> for inversions and slash chords
  - Add <degree> elements for extensions and alterations
  - Add <function> for Roman numeral
  - Add <offset> for precise timing
  - _Requirements: 15_


- [x] 14.3 Implement quality to MusicXML kind mapping
  - Create _quality_to_musicxml_kind() method
  - Map major 芒鈥?"major", minor 芒鈥?"minor", dominant7 芒鈥?"dominant"
  - Map major7 芒鈥?"major-seventh", minor7 芒鈥?"minor-seventh"
  - Map diminished 芒鈥?"diminished", augmented 芒鈥?"augmented"
  - _Requirements: 15_

- [x] 14.4 Implement measure finding and insertion
  - Create _find_measure_at_time() method to locate measure by time
  - Create _insert_harmony_at_position() to insert harmony element
  - Preserve existing elements (notes, dynamics, lyrics)
  - _Requirements: 15_

- [x] 14.5 Implement output() method
  - Parse original MusicXML
  - For each harmony in sequence, call _add_harmony_element()
  - Serialize tree back to XML string
  - Return annotated MusicXML
  - _Requirements: 15_

- [x]* 14.6 Write unit tests for MusicXML output
  - Test harmony element structure
  - Test inversion and slash chord representation
  - Test extension and alteration representation
  - Test output preserves original elements
  - _Requirements: 15_

## 15. OMR Interface and Error Handling

- [x] 15.1 Implement OMRConfidenceReport dataclass
  - Create dataclass with overall_confidence, measure_confidences, note_confidences
  - Add risk_regions list of (start, end, risk_type)
  - Add alternative_interpretations dictionary
  - _Requirements: 19_

- [x] 15.2 Implement pitch outlier detection
  - Create _detect_pitch_outliers() method in OMRInterface
  - Check if note.pitch outside reasonable range (36-96)
  - Mark as low confidence (0.3)
  - Add to risk_regions
  - _Requirements: 19_

- [x] 15.3 Implement duration violation detection
  - Create _detect_duration_violations() method
  - Sum note durations in each measure
  - Compare to expected duration from time signature
  - Mark measure as low confidence (0.4) if mismatch
  - _Requirements: 19_

- [x] 15.4 Implement interval anomaly detection
  - Create _detect_interval_anomalies() method
  - Check consecutive note intervals
  - Flag intervals > 19 semitones (octave + fifth)
  - Mark notes as low confidence (0.4)
  - _Requirements: 19_

- [x] 15.5 Implement accidental conflict detection
  - Create _detect_accidental_conflicts() method
  - Check if note accidental conflicts with key signature
  - Mark as low confidence (0.6)
  - _Requirements: 19_

- [x] 15.6 Implement alternative interpretation generation
  - Create _generate_alternative_interpretations() method
  - For low-confidence notes, generate 脗卤1, 脗卤2 semitone alternatives
  - Store in alternative_interpretations dictionary
  - _Requirements: 19_

- [x] 15.7 Implement OMRInterface.process_omr_output()
  - Parse MusicXML to IR
  - Run all detection methods
  - Compute overall confidence
  - Return (IR, OMRConfidenceReport)
  - _Requirements: 19_


- [x]* 15.8 Write unit tests for OMR interface
  - Test pitch outlier detection
  - Test duration violation detection
  - Test interval anomaly detection
  - Test alternative generation
  - _Requirements: 19_

## 16. Error-Aware Decoding

- [x] 16.1 Implement candidate weight adjustment
  - Create _adjust_candidate_weights() in ErrorAwareDecodingStrategy
  - Calculate average note confidence in each span
  - Multiply candidate confidence by note confidence
  - _Requirements: 20_

- [x] 16.2 Implement stable chord preference in low quality regions
  - Create _prefer_stable_chords_in_low_quality() method
  - Identify low-confidence spans (< 0.6)
  - Boost I/IV/V/vi candidates by 1.3x
  - _Requirements: 20_

- [x] 16.3 Implement sparse rhythm preference in low quality regions
  - Create _prefer_sparse_rhythm_in_low_quality() method
  - Mark low-quality regions for harmonic rhythm predictor
  - Predictor uses sparser rhythm in these regions
  - _Requirements: 20_

- [x] 16.4 Implement multi-path decoding with alternatives
  - Create _decode_with_alternatives() method
  - Use beam search with beam_width=3
  - Keep top-3 paths
  - Return all paths with scores
  - _Requirements: 20_

- [x] 16.5 Implement ErrorAwareDecodingStrategy.apply()
  - Adjust candidate weights based on OMR confidence
  - Prefer stable chords in low-quality regions
  - Decode with alternatives
  - Select best path
  - Return chord sequence
  - _Requirements: 20_

- [x]* 16.6 Write unit tests for error-aware decoding
  - Test weight adjustment reduces confidence in low-quality regions
  - Test stable chord preference in low-quality regions
  - Test multi-path decoding returns multiple paths
  - _Requirements: 20_

## 17. Explanation Generation

- [x] 17.1 Implement Explanation dataclass
  - Create dataclass with one_liner, standard, deep fields
  - Add structured fields: function_role, melody_notes_analysis, cadence_info
  - Add alternatives, simpler_version, advanced_version
  - _Requirements: 26_

- [x] 17.2 Implement function role explanation
  - Create _explain_function_role() method
  - Generate description for tonic, subdominant, dominant functions
  - Include key and mode context
  - _Requirements: 26_

- [x] 17.3 Implement melody-chord relation analysis
  - Create _analyze_melody_chord_relation() method
  - For each melody note, check if chord tone
  - If NCT, provide description (passing, neighbor, etc.)
  - Return list of note analyses
  - _Requirements: 26_

- [x] 17.4 Implement cadence explanation
  - Create _explain_cadence() method
  - Identify cadence type (authentic, half, deceptive)
  - Explain role in phrase structure
  - _Requirements: 26_


- [x] 17.5 Implement alternative generation
  - Create _generate_alternatives() method
  - Find 2-3 alternative chords from lattice
  - Explain why each alternative works
  - _Requirements: 26_

- [x] 17.6 Implement simpler/advanced suggestions
  - Create _suggest_simpler() and _suggest_advanced() methods
  - Simpler: reduce to basic triad
  - Advanced: add extensions or substitutions
  - _Requirements: 26_

- [x] 17.7 Implement deep explanation with LLM
  - Create _generate_deep_explanation() method
  - Build prompt with chord context
  - Call LLM for pedagogical explanation
  - Parse and structure response
  - _Requirements: 26_

- [x] 17.8 Implement ExplanationModule.generate()
  - Coordinate all explanation components
  - Generate one-liner, standard, and deep explanations
  - Return complete Explanation object
  - _Requirements: 26_

- [x]* 17.9 Write unit tests for explanation generation
  - Test function role descriptions
  - Test melody-chord analysis
  - Test alternative generation
  - _Requirements: 26_

## 18. Multi-Version Generation

- [x] 18.1 Implement HarmonyVersion dataclass
  - Create dataclass with name, description, applicable_scene
  - Add chord_sequence, difficulty, style, overall_confidence
  - _Requirements: 23_

- [x] 18.2 Implement MultiVersionGenerator class
  - Create generator with generate() method
  - Accept IR, key_sequence, time_spans
  - _Requirements: 23_

- [x] 18.3 Generate teaching-safe version
  - Use difficulty="basic", style="hymn"
  - Generate lattice, decode, repair
  - Create HarmonyVersion with appropriate metadata
  - _Requirements: 23_

- [x] 18.4 Generate popular version
  - Use difficulty="intermediate", style="pop"
  - Generate lattice, decode, repair
  - Create HarmonyVersion with appropriate metadata
  - _Requirements: 23_

- [x] 18.5 Generate rich version
  - Use difficulty="advanced", style="jazz-lite"
  - Generate lattice, decode, repair
  - Create HarmonyVersion with appropriate metadata
  - _Requirements: 23_

- [x] 18.6 Return all versions
  - Return list of 3 HarmonyVersion objects
  - Each with distinct difficulty and style
  - _Requirements: 23_

- [x]* 18.7 Write unit tests for multi-version generation
  - Test three versions are generated
  - Test versions have different difficulties
  - Test versions have different chord complexities
  - _Requirements: 23_


## 19. Repeat Phrase Consistency

- [x] 19.1 Implement RepeatGroup dataclass
  - Create dataclass with group_id, phrase_indices, similarity_score
  - Add context_differs boolean
  - _Requirements: 29_

- [x] 19.2 Implement repeat detection
  - Create RepeatPhraseAnalyzer class with detect_repeats() method
  - For each phrase pair, compute similarity
  - Use interval contour comparison
  - Group phrases with similarity >= threshold (0.85)
  - Check if context differs (phrase position)
  - _Requirements: 29_

- [x] 19.3 Implement consistency application
  - Create apply_consistency() method
  - For each repeat group, use first phrase as reference
  - Copy reference chords to other phrases in group
  - Allow cadence variation if context differs
  - _Requirements: 29_

- [x] 19.4 Integrate into global decoder
  - Add repeat consistency term to objective function
  - Boost score for matching chords in repeat phrases
  - _Requirements: 29_

- [x]* 19.5 Write unit tests for repeat consistency
  - Test repeat detection finds similar phrases
  - Test consistency application copies chords
  - Test cadence variation allowed when context differs
  - _Requirements: 29_

## 20. Interactive Edit API

- [x] 20.1 Implement EditResult dataclass
  - Create dataclass with updated_sequence, affected_measures
  - Add coherence_score and warnings list
  - _Requirements: 21_

- [x] 20.2 Implement chord replacement
  - Create InteractiveEditAPI class with replace_chord() method
  - Replace chord at specified measure
  - Re-evaluate adjacent measures (脗卤2)
  - Use local search for best fit
  - Record correction for learning
  - Return EditResult
  - _Requirements: 21_

- [x] 20.3 Implement alternative retrieval
  - Create get_alternatives() method
  - Get candidates from lattice at specified measure
  - Score candidates in context
  - Return top-3 alternatives
  - _Requirements: 21_

- [x] 20.4 Implement local regeneration
  - Create local_regenerate() method
  - Fix context before and after selected range
  - Regenerate lattice for selected range
  - Decode and repair local sequence
  - Merge with context
  - Return EditResult
  - _Requirements: 21_

- [x] 20.5 Implement repeat phrase synchronization
  - Create sync_repeat_phrases() method
  - Detect repeat groups
  - Find group containing source measure
  - Apply same chord to all phrases in group
  - Return EditResult
  - _Requirements: 21, 29_

- [x]* 20.6 Write unit tests for interactive edit API
  - Test chord replacement updates sequence
  - Test alternative retrieval returns top-3
  - Test local regeneration preserves context
  - Test repeat sync updates all phrases
  - _Requirements: 21_


## 21. Performance Optimization and Caching

- [x] 21.1 Implement multi-level cache
  - Create HarmonyCache class
  - Implement query embedding cache
  - Implement melody hash 芒鈥?harmony result cache
  - Implement RAG top-K cache
  - Implement LLM response cache (by prompt hash)
  - _Requirements: 27_

- [x] 21.2 Implement cache key generation
  - Create _generate_cache_key() methods
  - Hash melody features for result cache
  - Hash prompt for LLM cache
  - Hash query for RAG cache
  - _Requirements: 27_

- [x] 21.3 Implement cache lookup and storage
  - Implement get() and set() methods for each cache level
  - Use TTL (time-to-live) for cache expiration
  - Implement cache size limits (LRU eviction)
  - _Requirements: 27_

- [x] 21.4 Integrate caching into pipeline
  - Check cache before expensive operations
  - Store results after computation
  - Log cache hit/miss rates
  - _Requirements: 27_

- [x]* 21.5 Write unit tests for caching
  - Test cache stores and retrieves correctly
  - Test cache eviction when full
  - Test cache expiration
  - _Requirements: 27_

## 22. Degradation Strategies

- [x] 22.1 Implement embedding service fallback
  - Create DegradationStrategy class
  - If embedding service fails, use rule candidates + transition matrix
  - _Requirements: 27_

- [x] 22.2 Implement LLM service fallback
  - If LLM fails, use dynamic programming with conservative candidates
  - Generate basic explanations from templates
  - _Requirements: 27_

- [x] 22.3 Implement OMR service fallback
  - If OMR fails, prompt user for clearer image
  - Return preprocessing result preview
  - _Requirements: 27_

- [x] 22.4 Implement rendering service fallback
  - If rendering fails, provide MusicXML and ABC text formats
  - _Requirements: 27_

- [x]* 22.5 Write unit tests for degradation
  - Test fallback when services unavailable
  - Test system continues with reduced functionality
  - _Requirements: 27_

## 23. Model Distillation

- [x] 23.1 Implement symbolic model training
  - Create ModelDistillationModule class
  - Collect training data from user corrections and LLM outputs
  - Train small local model (e.g., gradient boosting, small neural net)
  - _Requirements: 28_

- [x] 23.2 Implement model evaluation
  - Evaluate model on validation set
  - Compare performance to LLM
  - Ensure quality threshold is met
  - _Requirements: 28_

- [x] 23.3 Implement incremental training
  - Support online learning from new corrections
  - Periodically retrain model
  - _Requirements: 28_

- [x] 23.4 Implement mode selection
  - Support "local-only", "hybrid", "llm-only" modes
  - Configure in pipeline settings
  - _Requirements: 28_


- [x]* 23.5 Write unit tests for model distillation
  - Test model training from correction data
  - Test model evaluation
  - Test mode selection
  - _Requirements: 28_

## 24. Evaluation Metrics

- [x] 24.1 Implement chord sequence metrics
  - Create EvaluationMetrics class
  - Implement CHE (Chord Hamming Error)
  - Implement CC (Chord Coverage)
  - Implement CTD (Chord Transition Distance)
  - _Requirements: 24_

- [x] 24.2 Implement melody-chord consistency metrics
  - Implement CTnCTR (Chord Tone / Non-Chord Tone Ratio)
  - Implement PCS (Pitch Class Set similarity)
  - Implement MCTD (Melody-Chord Temporal Distance)
  - _Requirements: 24_

- [x] 24.3 Implement harmonic rhythm metrics
  - Implement rhythm complexity measure
  - Implement harmonic density measure
  - _Requirements: 24_

- [x] 24.4 Implement cadence success rate
  - Detect cadences in ground truth and prediction
  - Calculate precision, recall, F1
  - _Requirements: 24_

- [x] 24.5 Implement user acceptance metrics
  - Track user acceptance rate
  - Track average number of corrections
  - _Requirements: 24_

- [x] 24.6 Create evaluation benchmark sets
  - Collect 100+ clean MusicXML teaching pieces
  - Create OMR noise test set
  - Create style-diverse test set (hymn, folk, jazz-lite, modal)
  - _Requirements: 24_

- [x] 24.7 Implement automated evaluation script
  - Run all metrics on benchmark sets
  - Generate evaluation report
  - Compare against baseline
  - _Requirements: 24_

- [x]* 24.8 Write unit tests for evaluation metrics
  - Test CHE calculation
  - Test melody-chord consistency metrics
  - Test cadence detection
  - _Requirements: 24_

## 25. Mode Unification

- [x] 25.1 Define mode mapping configuration
  - Create ModeUnificationConfig class
  - Define supported modes: major, minor, mixolydian, lydian, phrygian, dorian
  - Define characteristic scale degrees for each mode
  - _Requirements: 16_

- [x] 25.2 Implement mode detection in key analyzer
  - Extend KeySequenceAnalyzer to detect modes
  - Use characteristic scale degrees
  - Output mode along with key
  - _Requirements: 16_

- [x] 25.3 Implement mode-aware RAG filtering
  - Update RAG symbolic filter to use mode
  - Select embedding data shard by mode
  - _Requirements: 16_

- [x] 25.4 Implement mode fallback mapping
  - If non-standard mode detected, map to closest standard mode
  - Use mode mapping table
  - _Requirements: 16_


- [x]* 25.5 Write unit tests for mode unification
  - Test mode detection for each supported mode
  - Test RAG filtering by mode
  - Test fallback mapping
  - _Requirements: 16_

## 26. Style Control System

- [x] 26.1 Define style profiles
  - Create StyleProfile dataclass
  - Define pop profile (I-V-vi-IV, ii-V-I progressions)
  - Define hymn profile (traditional four-part harmony, standard cadences)
  - Define classical-lite profile (functional harmony, voice leading rules)
  - Define jazz-lite profile (extended chords, secondary dominants, substitutions)
  - _Requirements: 17_

- [x] 26.2 Implement style-specific transition matrices
  - Load or train transition matrix for each style
  - Use in global decoder transition scoring
  - _Requirements: 17_

- [x] 26.3 Implement style-specific candidate weighting
  - Adjust candidate weights based on style profile
  - Boost common progressions for each style
  - _Requirements: 17_

- [x] 26.4 Implement style selection in pipeline
  - Accept style parameter in pipeline config
  - Apply style profile throughout generation
  - _Requirements: 17_

- [x]* 26.5 Write unit tests for style control
  - Test pop style prefers pop progressions
  - Test hymn style uses traditional cadences
  - Test jazz-lite allows extended chords
  - _Requirements: 17_

## 27. User Preference Learning

- [x] 27.1 Implement user correction tracking
  - Create UserCorrectionLoop class
  - Record acceptance events (user keeps suggestion)
  - Record rejection events (user changes chord)
  - Record modification events (original 芒鈥?new chord + context)
  - _Requirements: 18, 22_

- [x] 27.2 Implement correction analysis
  - Analyze which positions and chord types are frequently modified
  - Distinguish teacher vs student correction patterns
  - _Requirements: 22_

- [x] 27.3 Implement user style profile
  - Build user-specific style profile from corrections
  - Track preferred progressions and chord types
  - _Requirements: 18_

- [x] 27.4 Implement institution style profile
  - Build shared style profile for institutions (schools, studios)
  - Allow institution to upload private corpus
  - _Requirements: 18_

- [x] 27.5 Implement preference-based reranking
  - Use user/institution profile to rerank candidates
  - Boost candidates matching user preferences
  - _Requirements: 18_

- [x]* 27.6 Write unit tests for preference learning
  - Test correction tracking
  - Test style profile building
  - Test preference-based reranking
  - _Requirements: 18, 22_

## 28. Confidence Calibration

- [x] 28.1 Implement confidence output
  - Add confidence score to each chord (0-1 range)
  - Add confidence score to each measure
  - Add overall confidence to entire piece
  - _Requirements: 25_


- [x] 28.2 Implement confidence decomposition
  - Provide key confidence (from key analyzer)
  - Provide OMR confidence (from OMR interface)
  - Provide chord confidence (from decoder)
  - _Requirements: 25_

- [x] 28.3 Implement confidence calibration
  - Create ConfidenceCalibrator class
  - Collect (confidence, actual_correction_rate) pairs
  - Calibrate confidence to match correction rate
  - Periodically update calibration
  - _Requirements: 25_

- [x]* 28.4 Write unit tests for confidence calibration
  - Test confidence output ranges
  - Test calibration improves correlation with corrections
  - _Requirements: 25_

## 29. Main Pipeline Integration

- [x] 29.1 Implement HarmonyEnginePipeline class
  - Create main pipeline coordinating all modules
  - Accept MusicXML/PDF/image input
  - Return annotated MusicXML + metadata
  - _Requirements: 1-30_

- [x] 29.2 Implement pipeline flow
  - OMR 芒鈥?Parser 芒鈥?IR construction
  - Note salience analysis
  - Phrase segmentation
  - Key sequence analysis
  - Harmonic rhythm prediction
  - Functional state tracking
  - Candidate lattice generation
  - Global decoding
  - Three-layer repair
  - Repeat consistency
  - Explanation generation
  - MusicXML output
  - _Requirements: 1-30_

- [x] 29.3 Implement pipeline configuration
  - Accept difficulty, style, mode parameters
  - Accept OMR confidence report
  - Accept user/institution preferences
  - _Requirements: 1-30_

- [x] 29.4 Implement error handling
  - Catch and handle errors at each stage
  - Apply degradation strategies
  - Return partial results with warnings
  - _Requirements: 27_

- [x] 29.5 Implement logging and monitoring
  - Log pipeline execution time
  - Log cache hit rates
  - Log confidence scores
  - Log error rates
  - _Requirements: 27_

- [x]* 29.6 Write integration tests for pipeline
  - Test end-to-end on sample MusicXML
  - Test with different difficulty levels
  - Test with different styles
  - Test error handling
  - _Requirements: 1-30_

## 30. Checkpoint - Backend Core Complete

- [x] 30. Ensure all backend tests pass
  - Run all unit tests
  - Run all property tests
  - Run integration tests
  - Fix any failing tests
  - Ensure code coverage > 80%
  - Ask the user if questions arise

---

## Notes

- All tasks reference specific requirements from requirements.md
- Optional tasks (marked with *) are testing tasks that can be skipped for faster MVP
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end functionality






