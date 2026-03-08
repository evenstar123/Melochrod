import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMusicXML } from '../src/parser/musicxml-parser.js';
import { MusicXMLOutputModule } from '../src/converter/musicxml-output-module.js';

const twinkleXml = readFileSync(resolve(__dirname, 'fixtures/twinkle.xml'), 'utf-8');

const lyricXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration><type>quarter</type>
        <lyric><text>la</text></lyric>
      </note>
    </measure>
  </part>
</score-partwise>`;

describe('MusicXMLOutputModule', () => {
  it('creates harmony elements and preserves note elements', () => {
    const score = parseMusicXML(twinkleXml);
    score.measures[0].chords = [
      { root: 'C', rootAccidental: 'none', quality: 'major', beat: 0 },
    ];

    const module = new MusicXMLOutputModule();
    const output = module.output(twinkleXml, score);

    expect(output).toContain('<harmony>');
    expect(output).toContain('<root-step>C</root-step>');
    expect(output).toContain('<kind>major</kind>');
    expect(output).toContain('<note>');
  });

  it('supports bass/degree/function/offset in harmony element', () => {
    const score = parseMusicXML(twinkleXml);
    const module = new MusicXMLOutputModule();

    const output = module.output(twinkleXml, score, [{
      start_time: 0,
      root: 'D',
      quality: 'dominant7',
      bass: 'F',
      bass_alter: 1,
      extensions: ['9'],
      alterations: ['b5'],
      function_symbol: 'V/V',
      offset: 1,
    }]);

    expect(output).toContain('<bass-step>F</bass-step>');
    expect(output).toContain('<bass-alter>1</bass-alter>');
    expect(output).toContain('<degree-value>9</degree-value>');
    expect(output).toContain('<degree-value>5</degree-value>');
    expect(output).toContain('<function>V/V</function>');
    expect(output).toContain('<offset>1</offset>');
  });

  it('preserves existing lyric elements', () => {
    const score = parseMusicXML(lyricXml);
    score.measures[0].chords = [
      { root: 'C', rootAccidental: 'none', quality: 'major', beat: 0 },
    ];

    const module = new MusicXMLOutputModule();
    const output = module.output(lyricXml, score);

    expect(output).toContain('<lyric>');
    expect(output).toContain('<text>la</text>');
  });
});
