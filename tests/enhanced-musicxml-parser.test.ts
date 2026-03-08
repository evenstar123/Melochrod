import { describe, expect, it } from 'vitest';
import { EnhancedMusicXMLParser } from '../src/parser/enhanced-musicxml-parser.js';

const pickupXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><voice>1</voice></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><voice>1</voice></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><voice>2</voice></note>
      <note>
        <grace/>
        <pitch><step>D</step><octave>5</octave></pitch>
        <type>eighth</type>
        <voice>1</voice>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>1</duration><type>eighth</type>
        <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
        <voice>1</voice>
        <tie type="start"/>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>1</duration><type>eighth</type>
        <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
        <voice>1</voice>
        <tie type="stop"/>
      </note>
    </measure>
  </part>
</score-partwise>`;

describe('EnhancedMusicXMLParser', () => {
  it('detects pickup duration from incomplete first measure', () => {
    const parser = new EnhancedMusicXMLParser();
    const result = parser.parse(pickupXml);

    expect(result.pickup_duration).toBeCloseTo(3, 3);
  });

  it('processes tuplets, grace notes, and ties', () => {
    const parser = new EnhancedMusicXMLParser();
    const result = parser.parse(pickupXml);

    const notes = result.score.measures.flatMap((m) => m.events).filter((e) => e.type === 'note');

    const grace = notes.find((n) => n.is_grace);
    expect(grace?.salience).toBe(0.1);

    const tuplet = notes.find((n) => n.tuplet_ratio !== undefined);
    expect(tuplet?.tuplet_ratio).toBeCloseTo(2 / 3, 3);

    // tied note continuation should be merged and removed
    const tiedStops = notes.filter((n) => n.tie_type === 'stop');
    expect(tiedStops).toHaveLength(0);
  });

  it('supports melody voice selection strategies', () => {
    const parser = new EnhancedMusicXMLParser();

    const highest = parser.parse(pickupXml, { strategy: 'highest_pitch' }).melody_notes;
    const active = parser.parse(pickupXml, { strategy: 'most_active' }).melody_notes;
    const user = parser.parse(pickupXml, { strategy: 'user_specified', user_voice_id: 2 }).melody_notes;

    expect(highest.length).toBeGreaterThan(0);
    expect(active.length).toBeGreaterThan(0);
    expect(user.every((note) => note.voice === 2)).toBe(true);
  });
});
