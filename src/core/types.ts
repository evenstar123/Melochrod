/**
 * 鏍稿績鏁版嵁绫诲瀷 - 鍐呴儴闊充箰琛ㄧず (IR)
 *
 * 璁捐鍘熷垯锛?
 * 1. 淇濈暀闊冲悕璇箟锛堝尯鍒?C# 鍜?Db锛?
 * 2. 鑳戒粠 MusicXML 鏃犳崯杞叆
 * 3. 鑳借交鏉捐浆涓?ABC Notation
 * 4. 鍖呭惈鍜屽０鍒嗘瀽鎵€闇€鐨勫叏閮ㄤ俊鎭?
 */

// ============ 鍩虹闊抽珮绫诲瀷 ============

/** 闊冲悕锛堜笉鍚崌闄嶅彿锛?*/
export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** 鍙橀煶璁板彿 */
export type Accidental = 'sharp' | 'flat' | 'natural' | 'double-sharp' | 'double-flat' | 'none';

/**
 * 闊抽珮 - 瀹屾暣鎻忚堪涓€涓煶鐨勯珮搴?
 * 浣跨敤闊冲悕+鍙橀煶璁板彿+鍏害锛岃€岄潪 MIDI 缂栧彿
 * 杩欐牱 C# 鍜?Db 鏄笉鍚岀殑瀵硅薄
 */
export interface Pitch {
  /** 闊冲悕 */
  step: NoteLetter;
  /** 鍙橀煶璁板彿 */
  accidental: Accidental;
  /** 鍏害锛堝浗闄呮爣鍑嗭紝涓ぎC = C4锛?*/
  octave: number;
}

// ============ 鑺傚绫诲瀷 ============

/** 闊崇鏃跺€肩被鍨?*/
export type DurationType =
  | 'whole'     // 鍏ㄩ煶绗?
  | 'half'      // 浜屽垎闊崇
  | 'quarter'   // 鍥涘垎闊崇
  | 'eighth'    // 鍏垎闊崇
  | '16th'      // 鍗佸叚鍒嗛煶绗?
  | '32nd';     // 涓夊崄浜屽垎闊崇

// ============ 闊崇涓庝紤姝㈢ ============

/** 闊崇 */
export interface Note {
  type: 'note';
  /** 闊抽珮 */
  pitch: Pitch;
  /** 鏃跺€肩被鍨?*/
  duration: DurationType;
  /** 闄勭偣鏁伴噺锛?=鏃犻檮鐐癸紝1=鍗曢檮鐐癸紝2=鍙岄檮鐐癸級 */
  dots: number;
  /** 鏄惁涓鸿繛闊崇嚎鐨勮捣濮?*/
  tieStart: boolean;
  /** 鏄惁涓鸿繛闊崇嚎鐨勭粨鏉?*/
  tieStop: boolean;
  /** 鍦ㄥ皬鑺傚唴鐨勮捣濮嬫媿浣嶇疆锛堜粠0寮€濮嬶紝浠ュ洓鍒嗛煶绗︿负鍗曚綅锛?*/
  beat: number;
  /** Salience feature: whether note starts on downbeat. */
  is_downbeat?: boolean;
  /** Salience feature: whether note starts on a strong beat. */
  is_strong_beat?: boolean;
  /** Salience feature: metric weight of beat strength. */
  beat_weight?: number;
  /** Salience feature: duration-based weight. */
  duration_weight?: number;
  /** Salience feature: blended salience score in [0, 1]. */
  salience?: number;
  /** Non-chord-tone type if detected (passing, neighbor, appoggiatura...). */
  nct_type?: string;
  /** Chord-tone tendency score in [0, 1]. */
  chord_tone_tendency?: number;
  /** Phrase boundary marker for this note position. */
  phrase_boundary?: boolean;
  /** Optional note confidence from upstream recognizer (OMR). */
  confidence?: number;
  /** Optional voice id from MusicXML <voice>. */
  voice?: number;
  /** Optional marker for grace notes. */
  is_grace?: boolean;
  /** Optional tuplet ratio (normal_notes / actual_notes). */
  tuplet_ratio?: number;
  /** Optional tie status from parser. */
  tie_type?: 'none' | 'start' | 'continue' | 'stop';
  /** Optional merged duration in quarter-note units after tie processing. */
  merged_duration_quarters?: number;
}

/** 浼戞绗?*/
export interface Rest {
  type: 'rest';
  duration: DurationType;
  dots: number;
  beat: number;
}

/** 闊充箰浜嬩欢锛堥煶绗︽垨浼戞绗︼級 */
export type MusicEvent = Note | Rest;

// ============ 鍜屽鸡鏍囪 ============

/** 鍜屽鸡璐ㄩ噺 */
export type ChordQuality =
  | 'major'       // 澶т笁鍜屽鸡
  | 'minor'       // 灏忎笁鍜屽鸡
  | 'diminished'  // 鍑忎笁鍜屽鸡
  | 'augmented'   // 澧炰笁鍜屽鸡
  | 'dominant7'   // 灞炰竷鍜屽鸡
  | 'major7'      // 澶т竷鍜屽鸡
  | 'minor7'      // 灏忎竷鍜屽鸡
  | 'diminished7' // 鍑忎竷鍜屽鸡
  | 'half-dim7'   // 鍗婂噺涓冨拰寮?
  | 'sus2'        // 鎸備簩鍜屽鸡
  | 'sus4';       // 鎸傚洓鍜屽鸡

/**
 * 鍜屽鸡绗﹀彿 - 鏍囨敞鍦ㄤ箰璋变笂鏂圭殑鍜屽鸡
 * 渚嬪锛欳, Am, G7, Bdim
 */
export interface ChordSymbol {
  /** 鏍归煶闊冲悕 */
  root: NoteLetter;
  /** 鏍归煶鍙橀煶璁板彿 */
  rootAccidental: Accidental;
  /** 鍜屽鸡璐ㄩ噺 */
  quality: ChordQuality;
  /** 鍦ㄥ皬鑺傚唴鐨勬媿浣嶇疆 */
  beat: number;
}

// ============ 璋冩€?============

/** 璋冨紡 */
export type Mode = 'major' | 'minor';

/** 璋冩€т俊鎭?*/
export interface KeySignature {
  /** 涓婚煶 */
  tonic: NoteLetter;
  /** 涓婚煶鍙橀煶璁板彿 */
  tonicAccidental: Accidental;
  /** 璋冨紡 */
  mode: Mode;
  /** MusicXML 涓殑 fifths 鍊硷紙-7鍒?锛岃礋鏁颁负闄嶅彿璋冿紝姝ｆ暟涓哄崌鍙疯皟锛?*/
  fifths: number;
}

// ============ 鎷嶅彿 ============

/** 鎷嶅彿 */
export interface TimeSignature {
  /** 姣忓皬鑺傛媿鏁?*/
  beats: number;
  /** 浠ヤ粈涔堥煶绗︿负涓€鎷?*/
  beatType: number;
}

// ============ 灏忚妭涓庝箰璋?============

/** 灏忚妭 */
export interface Measure {
  /** 灏忚妭缂栧彿锛堜粠1寮€濮嬶級 */
  number: number;
  /** 璇ュ皬鑺傜殑闊充箰浜嬩欢 */
  events: MusicEvent[];
  /** 璇ュ皬鑺傜殑鍜屽鸡鏍囨敞锛堢敱 Harmonizer 濉厖锛?*/
  chords: ChordSymbol[];
  /** 濡傛灉璇ュ皬鑺傛湁璋冩€у彉鍖栵紝璁板綍鏂拌皟鎬?*/
  keyChange?: KeySignature;
  /** 濡傛灉璇ュ皬鑺傛湁鎷嶅彿鍙樺寲锛岃褰曟柊鎷嶅彿 */
  timeChange?: TimeSignature;
}

/**
 * Score - 瀹屾暣涔愯氨鐨勫唴閮ㄨ〃绀?
 * 杩欐槸鏁翠釜绯荤粺鐨勬牳蹇冩暟鎹粨鏋?
 */
export interface Score {
  /** 鏇插悕 */
  title: string;
  /** 浣滄洸鑰?*/
  composer: string;
  /** 鍒濆璋冩€?*/
  key: KeySignature;
  /** 璋冨彿鏄惁鏉ヨ嚜 MusicXML 鐨勬樉寮忓０鏄庯紙鑰岄潪榛樿鍊硷級 */
  keyExplicit?: boolean;
  /** 鍒濆鎷嶅彿 */
  time: TimeSignature;
  /** 閫熷害锛圔PM锛屽洓鍒嗛煶绗?鍒嗛挓锛?*/
  tempo: number;
  /** 鎵€鏈夊皬鑺?*/
  measures: Measure[];
}

