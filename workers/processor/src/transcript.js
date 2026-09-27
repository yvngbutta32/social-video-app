import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from './logger.js';
import { parseWhisperJson } from './transcript-parser.js';

function timeToSeconds(timeStr) {
  const [time, ms] = timeStr.split(',');
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

function parseSrt(srtContent) {
  if (!srtContent.trim()) return [];
  const captions = [];
  for (const block of srtContent.trim().split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;
    const start = timeToSeconds(timeMatch[1]);
    const end = timeToSeconds(timeMatch[2]);
    captions.push({ start, end, text: lines.slice(2).join(' ').replace(/\s+/g, ' ').trim(), duration: end - start });
  }
  return captions;
}

export { parseWhisperJson };

export async function generateTranscriptArtifacts(inputPath, options = {}) {
  const language = options.language ?? 'auto';
  const whisperPath = options.whisperPath ?? process.env.WHISPER_PATH ?? '/usr/local/bin/whisper';
  const modelPath = options.modelPath ?? process.env.WHISPER_MODEL ?? '/models/ggml-base.en.bin';
  const audioPath = `/tmp/audio_${Date.now()}_${path.basename(inputPath)}.wav`;
  const outputBase = audioPath.replace(/\.wav$/, '');
  try {
    await new Promise((resolve, reject) => ffmpeg(inputPath).outputOptions(['-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1']).on('end', resolve).on('error', reject).save(audioPath));
    const args = ['-m', modelPath, '-f', audioPath, '-otxt', '-osrt', '-ovtt', '-oj'];
    if (language !== 'auto') args.push('-l', language);
    await new Promise((resolve, reject) => {
      const proc = spawn(whisperPath, args);
      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `Whisper exited with code ${code}`)));
    });
    const srtContent = await fs.readFile(`${outputBase}.srt`, 'utf8').catch(() => '');
    const jsonContent = await fs.readFile(`${outputBase}.json`, 'utf8').catch(() => '');
    const transcript = parseWhisperJson(jsonContent, { modelVersion: path.basename(modelPath), language: language === 'auto' ? null : language });
    return { captions: parseSrt(srtContent), transcript };
  } catch (error) {
    logger.warn({ err: error }, 'Transcript generation failed');
    return { captions: [], transcript: null };
  } finally {
    await Promise.all([audioPath, `${outputBase}.srt`, `${outputBase}.json`, `${outputBase}.txt`, `${outputBase}.vtt`].map((filePath) => fs.unlink(filePath).catch(() => {})));
  }
}
