import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parseWhisperJson } from './transcript-parser.js';

const sharedFixture = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../contracts/fixtures/word-level-transcript.json', import.meta.url)), 'utf8'));

describe('Whisper transcript artifact parsing', () => {
  it('normalizes whisper.cpp token offsets into verified word-level cues', () => {
    const result = parseWhisperJson(JSON.stringify({
      result: { language: 'en' },
      transcription: [{ tokens: [
        { text: 'Opening', offsets: { from: 0, to: 3200 }, p: 0.98 },
        { text: ' proof.', offsets: { from: 3500, to: 7200 }, p: 0.97 },
      ] }],
    }), { modelVersion: 'ggml-base.en.bin' });

    expect(result.state).toBe('word_level');
    expect(result.wordCount).toBe(2);
    expect(result.language).toBe('en');
    expect(result.modelVersion).toBe('ggml-base.en.bin');
    expect(result.words).toEqual([
      { id: 'word-1', startMs: 0, endMs: 3200, text: 'Opening', confidence: 0.98, speaker: null },
      { id: 'word-2', startMs: 3500, endMs: 7200, text: 'proof.', confidence: 0.97, speaker: null },
    ]);
    expect(result.transcriptId).toMatch(/^[a-f0-9]{16}$/);
  });

  it('returns text-only provenance when JSON has segments but no word tokens', () => {
    const result = parseWhisperJson(JSON.stringify({ language: 'es', transcription: [{ text: 'Hola mundo.' }] }), { modelVersion: 'small' });

    expect(result.state).toBe('text_only');
    expect(result.wordCount).toBe(0);
    expect(result.words).toEqual([]);
    expect(result.language).toBe('es');
  });

  it('does not fabricate transcript data for malformed or empty output', () => {
    expect(parseWhisperJson('not-json').state).toBe('unavailable');
    expect(parseWhisperJson('').state).toBe('unavailable');
  });

  it('matches the shared persisted artifact contract used by the API gateway', () => {
    const parsed = parseWhisperJson(JSON.stringify({
      result: { language: sharedFixture.language },
      transcription: [{ tokens: sharedFixture.words.map(({ text, startMs, endMs, confidence }) => ({
        text,
        offsets: { from: startMs, to: endMs },
        p: confidence,
      })) }],
    }), { modelVersion: sharedFixture.modelVersion });

    expect(parsed).toEqual(sharedFixture);
  });
});
