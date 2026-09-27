import { createHash } from 'crypto';

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function parseWordTiming(item) {
  if (!item || typeof item !== 'object') return null;
  const value = item;
  const offsets = value.offsets && typeof value.offsets === 'object' ? value.offsets : {};
  const timestamps = value.timestamps && typeof value.timestamps === 'object' ? value.timestamps : {};
  const startMs = Number.isFinite(offsets.from) ? Number(offsets.from) : Math.round((parseTimestamp(timestamps.from ?? value.start) ?? NaN) * 1000);
  const endMs = Number.isFinite(offsets.to) ? Number(offsets.to) : Math.round((parseTimestamp(timestamps.to ?? value.end) ?? NaN) * 1000);
  const rawText = typeof value.text === 'string' ? value.text : typeof value.token === 'string' ? value.token : '';
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || !rawText.trim()) return null;
  return { startMs, endMs, text: rawText.trim(), confidence: Number.isFinite(value.p) ? Math.max(0, Math.min(1, Number(value.p))) : null, speaker: null };
}

export function parseWhisperJson(jsonContent, metadata = {}) {
  const unavailable = { state: 'unavailable', words: [], wordCount: 0, transcriptId: null, provider: 'whisper.cpp', modelVersion: metadata.modelVersion ?? null, language: metadata.language ?? null };
  if (!jsonContent.trim()) return unavailable;
  let parsed;
  try { parsed = JSON.parse(jsonContent); } catch { return unavailable; }
  const segments = Array.isArray(parsed.transcription) ? parsed.transcription : Array.isArray(parsed.segments) ? parsed.segments : [];
  const words = segments.flatMap((segment) => {
    const tokenItems = Array.isArray(segment.tokens) ? segment.tokens : Array.isArray(segment.words) ? segment.words : [];
    return tokenItems.map(parseWordTiming).filter(Boolean);
  }).map((word, index) => ({ id: `word-${index + 1}`, ...word }));
  const language = parsed.result?.language ?? parsed.language ?? metadata.language ?? null;
  if (words.length === 0) return { ...unavailable, state: segments.length ? 'text_only' : 'unavailable', language };
  const transcriptId = createHash('sha256').update(JSON.stringify(words)).digest('hex').slice(0, 16);
  return { state: 'word_level', words, wordCount: words.length, transcriptId, provider: 'whisper.cpp', modelVersion: metadata.modelVersion ?? null, language };
}
