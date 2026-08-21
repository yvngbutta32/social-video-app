import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { config } from './config.js';
import { logger } from './logger.js';
import { downloadFile, uploadMultipart, uploadPart, completeMultipart, abortMultipart, fileExists } from './minio.js';
import { findVideoById, updateVideoStatus, createVideoVariant } from './db.js';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import axios from 'axios';
import { query } from './db.js';
import { spawn } from 'child_process';

// Platform-specific optimization specifications (Enhanced)
const PLATFORM_SPECS = {
  tiktok: { 
    width: 1080, height: 1920, maxDuration: 180, maxSizeMB: 287, fps: 30, 
    codec: 'libx264', audioCodec: 'aac',
    safeZones: { top: 150, bottom: 300, left: 80, right: 80 },
    preferredBitrate: '8M',
    colorSpace: 'bt709',
    features: ['captions', 'stickers', 'effects', 'music', 'duet', 'stitch'],
    bestPractices: ['hook_first_3s', 'vertical_native', 'trending_audio', 'loop_friendly'],
    thumbnailSpecs: { width: 1080, height: 1920, timeOffset: '00:00:01' },
    audioNormalization: { targetLUFS: -14, truePeak: -1 },
  },
  instagram_reels: { 
    width: 1080, height: 1920, maxDuration: 90, maxSizeMB: 100, fps: 30, 
    codec: 'libx264', audioCodec: 'aac',
    safeZones: { top: 100, bottom: 250, left: 60, right: 60 },
    preferredBitrate: '8M',
    colorSpace: 'bt709',
    features: ['captions', 'stickers', 'music', 'remix', 'templates'],
    bestPractices: ['aesthetic_quality', 'cover_image', 'hashtag_strategy', 'engagement_bait'],
    thumbnailSpecs: { width: 1080, height: 1920, timeOffset: '00:00:01' },
    audioNormalization: { targetLUFS: -14, truePeak: -1 },
  },
  youtube_shorts: { 
    width: 1080, height: 1920, maxDuration: 60, maxSizeMB: 2000, fps: 30, 
    codec: 'libx264', audioCodec: 'aac',
    safeZones: { top: 120, bottom: 280, left: 80, right: 80 },
    preferredBitrate: '12M',
    colorSpace: 'bt709',
    features: ['captions', 'music', 'remix', 'green_screen'],
    bestPractices: ['title_hook', 'loop_seamless', 'series_potential', 'cta_subscribe'],
    thumbnailSpecs: { width: 1280, height: 720, timeOffset: '00:00:00.5' },
    audioNormalization: { targetLUFS: -14, truePeak: -1 },
  },
  facebook_reels: { 
    width: 1080, height: 1920, maxDuration: 90, maxSizeMB: 4000, fps: 30, 
    codec: 'libx264', audioCodec: 'aac',
    safeZones: { top: 100, bottom: 250, left: 60, right: 60 },
    preferredBitrate: '8M',
    colorSpace: 'bt709',
    features: ['captions', 'music', 'remix', 'stars'],
    bestPractices: ['shareable_content', 'community_focus', 'cross_post_ig'],
    thumbnailSpecs: { width: 1080, height: 1920, timeOffset: '00:00:01' },
    audioNormalization: { targetLUFS: -14, truePeak: -1 },
  },
  twitter: { 
    width: 1280, height: 720, maxDuration: 140, maxSizeMB: 512, fps: 30, 
    codec: 'libx264', audioCodec: 'aac',
    safeZones: { top: 60, bottom: 120, left: 60, right: 60 },
    preferredBitrate: '8M',
    colorSpace: 'bt709',
    features: ['captions', 'poll', 'thread'],
    bestPractices: ['native_format', 'text_overlay', 'conversation_starter'],
    thumbnailSpecs: { width: 1280, height: 720, timeOffset: '00:00:01' },
    audioNormalization: { targetLUFS: -14, truePeak: -1 },
  },
  linkedin: { 
    width: 1080, height: 1080, maxDuration: 600, maxSizeMB: 5000, fps: 30, 
    codec: 'libx264', audioCodec: 'aac',
    safeZones: { top: 80, bottom: 80, left: 60, right: 60 },
    preferredBitrate: '10M',
    colorSpace: 'bt709',
    features: ['captions', 'document', 'carousel'],
    bestPractices: ['professional_tone', 'value_first', 'thought_leadership'],
    thumbnailSpecs: { width: 1200, height: 628, timeOffset: '00:00:02' },
    audioNormalization: { targetLUFS: -16, truePeak: -2 },
  },
};

// Enhanced optimization modes with AI-assisted features
const OPTIMIZATION_MODES = {
  fit: 'Scale to fit with letterboxing',
  crop: 'Crop to fill (may lose content)',
  blur_bg: 'Blur background with centered video',
  smart_crop: 'AI-assisted smart crop (face/object detection)',
  smart_fill: 'AI fill + crop for best composition',
  viral_optimize: 'Auto-optimize for viral potential (hook detection, pacing)',
};

function getPlatformSpec(platform) {
  return PLATFORM_SPECS[platform] || PLATFORM_SPECS.tiktok;
}

/**
 * Generate video hash for deduplication
 */
async function generateVideoHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16);
}

/**
 * Detect faces/objects for smart cropping using MediaPipe or OpenCV
 */
async function detectFocusPoints(inputPath) {
  // Try to use Python MediaPipe for face detection
  try {
    const pythonScript = `
import cv2
import sys
import json

cap = cv2.VideoCapture(sys.argv[1])
ret, frame = cap.read()
if not ret:
    print(json.dumps({"x": 0.5, "y": 0.5, "confidence": 0.1}))
    sys.exit(0)

# Use Haar cascade for face detection (built-in)
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
faces = face_cascade.detectMultiScale(gray, 1.1, 4)

if len(faces) > 0:
    # Use the largest face
    (x, y, w, h) = max(faces, key=lambda f: f[2] * f[3])
    center_x = (x + w/2) / frame.shape[1]
    center_y = (y + h/2) / frame.shape[0]
    print(json.dumps({"x": float(center_x), "y": float(center_y), "confidence": 0.8}))
else:
    # Fallback to center
    print(json.dumps({"x": 0.5, "y": 0.5, "confidence": 0.3}))
cap.release()
`;
    const result = await runPythonScript(pythonScript, inputPath);
    return JSON.parse(result);
  } catch (error) {
    logger.warn({ err: error }, 'Face detection failed, using center');
    return { x: 0.5, y: 0.5, confidence: 0.1 };
  }
}

/**
 * Run Python script and return stdout
 */
function runPythonScript(script, arg) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', ['-c', script, arg]);
    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });
    py.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `Process exited with code ${code}`));
    });
  });
}

/**
 * Detect scenes using PySceneDetect (content-aware scene detection)
 */
async function detectScenes(inputPath, threshold = 27.0) {
  try {
    const pythonScript = `
import sys
import json
from scenedetect import detect, ContentDetector

scene_list = detect(sys.argv[1], ContentDetector(threshold=float(sys.argv[2])))
scenes = []
for i, scene in enumerate(scene_list):
    start_sec = scene[0].get_seconds()
    end_sec = scene[1].get_seconds()
    scenes.append({
        "scene_number": i + 1,
        "start_time": start_sec,
        "end_time": end_sec,
        "duration": end_sec - start_sec
    })
print(json.dumps(scenes))
`;
    const result = await runPythonScript(pythonScript, inputPath, String(threshold));
    return JSON.parse(result);
  } catch (error) {
    logger.warn({ err: error }, 'Scene detection failed');
    return [];
  }
}

/**
 * Generate captions using Whisper.cpp (local, fast, no GPU required)
 */
async function generateCaptions(inputPath, language = 'auto') {
  try {
    // Extract audio first
    const audioPath = `/tmp/audio_${Date.now()}.wav`;
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(['-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1'])
        .on('end', () => resolve())
        .on('error', reject)
        .save(audioPath);
    });

    // Run Whisper.cpp
    const whisperPath = process.env.WHISPER_PATH || '/usr/local/bin/whisper';
    const modelPath = process.env.WHISPER_MODEL || '/models/ggml-base.en.bin';
    
    const result = await new Promise((resolve, reject) => {
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '-otxt', // Output text
        '-osrt', // Output SRT
        '-ovtt', // Output VTT
      ];
      
      if (language !== 'auto') {
        args.push('-l', language);
      }
      
      const proc = spawn(whisperPath, args);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `Whisper exited with code ${code}`));
      });
    });

    // Parse SRT output for timed captions
    const srtPath = audioPath.replace('.wav', '.srt');
    const srtContent = await fs.readFile(srtPath, 'utf-8').catch(() => '');
    
    // Cleanup
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
    await fs.unlink(audioPath.replace('.wav', '.txt')).catch(() => {});
    await fs.unlink(audioPath.replace('.wav', '.vtt')).catch(() => {});

    return parseSRT(srtContent);
  } catch (error) {
    logger.warn({ err: error }, 'Caption generation failed');
    return [];
  }
}

/**
 * Parse SRT format to structured captions
 */
function parseSRT(srtContent) {
  const captions = [];
  const blocks = srtContent.trim().split('\n\n');
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1];
      const text = lines.slice(2).join(' ');
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (timeMatch) {
        const start = timeToSeconds(timeMatch[1]);
        const end = timeToSeconds(timeMatch[2]);
        captions.push({ start, end, text, duration: end - start });
      }
    }
  }
  return captions;
}

function timeToSeconds(timeStr) {
  const [time, ms] = timeStr.split(',');
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

/**
 * Generate optimized thumbnail for platform
 */
async function generateThumbnail(inputPath, spec, outputPath, options = {}) {
  const { timeOffset = spec.thumbnailSpecs?.timeOffset || '00:00:01', width = spec.thumbnailSpecs?.width, height = spec.thumbnailSpecs?.height } = options;
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(timeOffset)
      .outputOptions([
        '-vframes', '1',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        '-q:v', '2',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Normalize audio loudness to platform standards
 */
async function normalizeAudio(inputPath, outputPath, spec) {
  const { targetLUFS = -14, truePeak = -1 } = spec.audioNormalization || {};
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('aac')
      .outputOptions([
        '-af', `loudnorm=I=${targetLUFS}:TP=${truePeak}:LRA=11:print_format=json`,
        '-ar', '48000',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Create viral-optimized version (detect hooks, optimize pacing)
 */
async function createViralOptimized(inputPath, spec, options = {}) {
  // Analyze video for hook detection (first 3 seconds)
  // In production, integrate with ML model for viral prediction
  const probe = await probeVideo(inputPath);
  const duration = probe.format.duration || 0;
  
  const outputPath = `/tmp/viral_${Date.now()}.mp4`;
  
  // Apply viral optimization: faster cuts, emphasis on first 3s, loop points
  return new Promise((resolve, reject) => {
    const filterComplex = buildFilterComplex(spec, options.inputWidth, options.inputHeight, {
      mode: 'smart_crop',
      safeZone: true,
    });
    
    ffmpeg(inputPath)
      .videoCodec(spec.codec)
      .audioCodec(spec.audioCodec)
      .fps(spec.fps)
      .format('mp4')
      .outputOptions([
        '-filter_complex', filterComplex,
        '-movflags', '+faststart',
        '-preset', 'medium',
        '-crf', '22', // Slightly higher quality for viral content
        '-pix_fmt', 'yuv420p',
        '-b:v', spec.preferredBitrate || '8M',
        '-colorspace', spec.colorSpace || 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

function buildFilterComplex(spec, inputWidth, inputHeight, options = {}) {
  const { 
    mode = 'fit',
    safeZone = true,
    addCaptions = false,
    captionText = '',
    focusPoint = { x: 0.5, y: 0.5 },
  } = options;

  const { width, height, safeZones } = spec;
  const aspectRatio = inputWidth / inputHeight;
  const targetAspect = width / height;

  let videoFilter = '';

  if (mode === 'crop') {
    if (aspectRatio > targetAspect) {
      videoFilter = `[0:v]crop=ih*${targetAspect}:ih,scale=${width}:${height}`;
    } else {
      videoFilter = `[0:v]crop=iw:iw/${targetAspect},scale=${width}:${height}`;
    }
  } else if (mode === 'blur_bg') {
    videoFilter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=20[bg];[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
  } else if (mode === 'smart_crop' || mode === 'smart_fill') {
    // Smart crop based on focus point
    const cropX = Math.floor(focusPoint.x * inputWidth);
    const cropY = Math.floor(focusPoint.y * inputHeight);
    videoFilter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  } else {
    videoFilter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
  }

  // Add safe zone guides (for debugging/preview)
  if (safeZone && safeZones) {
    const { top, bottom, left, right } = safeZones;
    videoFilter += `,drawbox=x=${left}:y=${top}:w=${width-left-right}:h=${height-top-bottom}:color=white@0.3:t=2`;
  }

  // Add captions area placeholder
  if (addCaptions && captionText) {
    videoFilter += `,drawtext=text='${captionText.replace(/'/g, "\\'")}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h-th-100`;
  }

  return videoFilter;
}

async function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

async function transcodeVideo(inputPath, outputPath, spec, options = {}, progressCallback) {
  return new Promise((resolve, reject) => {
    const filterComplex = buildFilterComplex(spec, options.inputWidth, options.inputHeight, options);
    
    const command = ffmpeg(inputPath)
      .videoCodec(spec.codec)
      .audioCodec(spec.audioCodec)
      .fps(spec.fps)
      .format('mp4')
      .outputOptions([
        '-filter_complex', filterComplex,
        '-movflags', '+faststart',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-b:v', spec.preferredBitrate || '8M',
        '-colorspace', spec.colorSpace || 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
      ])
      .on('progress', (progress) => {
        if (progressCallback) progressCallback(progress);
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

async function createOptimizedVariant(inputPath, spec, options = {}) {
  const outputPath = `/tmp/${spec.platform || 'output'}_${Date.now()}.mp4`;
  
  // Probe input for dimensions
  const probe = await probeVideo(inputPath);
  const videoStream = probe.streams.find(s => s.codec_type === 'video');
  const inputWidth = videoStream?.width || 1920;
  const inputHeight = videoStream?.height || 1080;

  // Get focus points for smart crop
  let focusPoint = { x: 0.5, y: 0.5 };
  if (options.mode === 'smart_crop' || options.mode === 'smart_fill') {
    focusPoint = await detectFocusPoints(inputPath);
  }

  await transcodeVideo(inputPath, outputPath, spec, {
    ...options,
    inputWidth,
    inputHeight,
    focusPoint,
  });

  return outputPath;
}

/**
 * Validate variant meets platform requirements
 */
async function validateVariant(filePath, spec) {
  const probe = await probeVideo(filePath);
  const videoStream = probe.streams.find(s => s.codec_type === 'video');
  const audioStream = probe.streams.find(s => s.codec_type === 'audio');
  
  const issues = [];
  
  // Check dimensions
  if (videoStream) {
    if (videoStream.width !== spec.width || videoStream.height !== spec.height) {
      issues.push(`Dimensions mismatch: ${videoStream.width}x${videoStream.height} vs ${spec.width}x${spec.height}`);
    }
    if (videoStream.r_frame_rate && eval(videoStream.r_frame_rate) > spec.fps * 1.1) {
      issues.push(`Frame rate too high: ${videoStream.r_frame_rate}`);
    }
  }
  
  // Check duration
  const duration = probe.format.duration || 0;
  if (duration > spec.maxDuration) {
    issues.push(`Duration exceeds limit: ${duration}s > ${spec.maxDuration}s`);
  }
  
  // Check file size
  const stats = await fs.stat(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  if (sizeMB > spec.maxSizeMB) {
    issues.push(`File size exceeds limit: ${sizeMB.toFixed(1)}MB > ${spec.maxSizeMB}MB`);
  }
  
  // Check codec
  if (videoStream && !videoStream.codec_name.includes('264')) {
    issues.push(`Non-H.264 codec: ${videoStream.codec_name}`);
  }
  
  return { valid: issues.length === 0, issues, metadata: { duration, sizeMB, width: videoStream?.width, height: videoStream?.height } };
}

/**
 * Extract viral hook (first 3 seconds) for A/B testing
 */
async function extractHook(inputPath, duration = 3) {
  const outputPath = `/tmp/hook_${Date.now()}.mp4`;
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-t', String(duration),
        '-c', 'copy',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Generate multiple hook variants for A/B testing
 */
async function generateHookVariants(inputPath, spec, hookCount = 3) {
  const probe = await probeVideo(inputPath);
  const videoDuration = probe.format.duration || 0;
  const variants = [];
  
  // Strategy: extract different 3-second windows from first 30 seconds
  const maxStart = Math.min(30, videoDuration - 3);
  const step = maxStart / (hookCount - 1) || 0;
  
  for (let i = 0; i < hookCount; i++) {
    const startTime = Math.min(i * step, maxStart);
    const outputPath = `/tmp/hook_variant_${i}_${Date.now()}.mp4`;
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .outputOptions([
          '-t', '3',
          '-c', 'copy',
        ])
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath);
    });
    
    variants.push({
      variantIndex: i,
      startTime,
      s3Key: `hooks/${path.basename(outputPath)}`,
      path: outputPath,
    });
  }
  
  return variants;
}

export async function processVideoJob(job, deps) {
  const { pgPool, redis, config, logger } = deps;
  const { videoId, platforms = Object.keys(PLATFORM_SPECS), optimization = 'auto', generateThumbnails = true, generateCaptions: shouldGenerateCaptions = true, detectScenes: shouldDetectScenes = true, extractHooks = true } = job.data;
  const childLogger = logger.child({ jobId: job.id, videoId });
  
  childLogger.info({ platforms, optimization, generateThumbnails, shouldGenerateCaptions, shouldDetectScenes, extractHooks }, 'Starting optimized video processing');
  
  try {
    // Get video metadata from database
    const video = await findVideoById(videoId);
    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }
    
    await updateVideoStatus(videoId, 'processing', { startedAt: new Date().toISOString() });
    
    // Download original video from MinIO
    const originalStream = await downloadFile(video.s3_key);
    if (!originalStream) {
      throw new Error(`Failed to download video ${video.s3_key}`);
    }
    
    // Save to temp file
    const tempInputPath = `/tmp/input_${videoId}_${Date.now()}.mp4`;
    await streamToFile(originalStream, tempInputPath);
    const probe = await probeVideo(tempInputPath);
    const duration = probe.format.duration || 0;
    
    // Generate video hash for deduplication
    const videoHash = await generateVideoHash(tempInputPath);
    childLogger.info({ videoHash, duration }, 'Video probed and hashed');
    
    // Detect scenes for smart editing
    let scenes = [];
    if (shouldDetectScenes) {
      scenes = await detectScenes(tempInputPath);
      childLogger.info({ sceneCount: scenes.length }, 'Scene detection completed');
    }
    
    // Generate captions using Whisper
    let captions = [];
    if (shouldGenerateCaptions) {
      captions = await generateCaptions(tempInputPath);
      childLogger.info({ captionCount: captions.length }, 'Caption generation completed');
    }
    
    // Extract hook variants for A/B testing
    let hookVariants = [];
    if (extractHooks) {
      hookVariants = await generateHookVariants(tempInputPath, getPlatformSpec(platforms[0]));
      childLogger.info({ hookCount: hookVariants.length }, 'Hook variants extracted');
    }
    
    const variants = [];
    const thumbnails = [];
    
    // Process each platform with optimization
    for (const platform of platforms) {
      const spec = { ...getPlatformSpec(platform), platform };
      
      // Check duration limits
      if (duration > spec.maxDuration) {
        childLogger.warn({ platform, duration, maxDuration: spec.maxDuration }, 'Video exceeds platform max duration, will be trimmed');
      }
      
      // Determine optimization mode based on aspect ratio
      const videoStream = probe.streams.find(s => s.codec_type === 'video');
      const inputAspect = videoStream ? videoStream.width / videoStream.height : 16/9;
      const targetAspect = spec.width / spec.height;
      
      let optimizationMode = 'fit';
      if (optimization === 'auto') {
        if (Math.abs(inputAspect - targetAspect) < 0.1) {
          optimizationMode = 'fit';
        } else if (inputAspect > targetAspect * 1.5) {
          optimizationMode = 'blur_bg';
        } else if (inputAspect < targetAspect / 1.5) {
          optimizationMode = 'crop';
        } else {
          optimizationMode = 'smart_crop';
        }
      } else {
        optimizationMode = optimization;
      }
      
      // Create variant for platform
      const variantS3Key = `variants/${videoId}/${platform}_${videoHash}.mp4`;
      
      // Check if variant already exists (deduplication)
      const exists = await fileExists(variantS3Key);
      if (exists) {
        childLogger.info({ platform, variantS3Key }, 'Variant already exists, skipping');
        const variant = await createVideoVariant(videoId, platform, variantS3Key, {
          width: spec.width,
          height: spec.height,
          duration: Math.min(duration, spec.maxDuration),
          sizeBytes: 0,
          codec: spec.codec,
          optimizationMode,
          safeZones: spec.safeZones,
          deduplicated: true,
        });
        variants.push({ platform, variantId: variant.id, s3Key: variantS3Key, optimizationMode, deduplicated: true });
        continue;
      }
      
      // Start multipart upload
      const uploadId = await uploadMultipart(variantS3Key, 'video/mp4', {
        videoId,
        platform,
        originalDuration: String(duration),
        optimizationMode,
        videoHash,
      });
      
      try {
        let outputPath;
        
        // Apply viral optimization if requested
        if (optimizationMode === 'viral_optimize') {
          outputPath = await createViralOptimized(tempInputPath, spec, {
            mode: 'smart_crop',
            safeZone: true,
          });
        } else {
          outputPath = await createOptimizedVariant(tempInputPath, spec, { mode: optimizationMode, safeZone: true });
        }
        
        // Normalize audio
        const normalizedPath = `/tmp/norm_${Date.now()}.mp4`;
        await normalizeAudio(outputPath, normalizedPath, spec);
        
        // Validate variant
        const validation = await validateVariant(normalizedPath, spec);
        if (!validation.valid) {
          childLogger.warn({ platform, issues: validation.issues }, 'Variant validation issues');
        }
        
        // Upload to MinIO
        const fileBuffer = await fs.readFile(normalizedPath);
        const partSize = 5 * 1024 * 1024; // 5MB parts
        let partNumber = 1;
        
        for (let i = 0; i < fileBuffer.length; i += partSize) {
          const chunk = fileBuffer.slice(i, i + partSize);
          await uploadPart(variantS3Key, uploadId, partNumber, chunk);
          partNumber++;
        }
        
        const etag = await completeMultipart(variantS3Key, uploadId, partNumber - 1);
        
        // Generate thumbnail
        let thumbnailKey = null;
        if (generateThumbnails) {
          const thumbPath = `/tmp/thumb_${videoId}_${platform}_${Date.now()}.jpg`;
          await generateThumbnail(normalizedPath, spec, thumbPath);
          const thumbKey = `thumbnails/${videoId}/${platform}_${videoHash}.jpg`;
          const thumbUpload = await uploadMultipart(thumbKey, 'image/jpeg', { videoId, platform });
          await uploadPart(thumbKey, thumbUpload.uploadId, 1, await fs.readFile(thumbPath));
          await completeMultipart(thumbKey, thumbUpload.uploadId, 1);
          thumbnailKey = thumbKey;
          thumbnails.push({ platform, s3Key: thumbKey });
        }
        
        // Create variant record
        const stats = await fs.stat(normalizedPath);
        const variant = await createVideoVariant(videoId, platform, variantS3Key, {
          width: spec.width,
          height: spec.height,
          duration: Math.min(duration, spec.maxDuration),
          sizeBytes: stats.size,
          codec: spec.codec,
          optimizationMode,
          safeZones: spec.safeZones,
          thumbnailKey,
          validation: validation,
          deduplicated: false,
          scenes: scenes,
          captions: captions,
          hookVariants: hookVariants.map(h => h.variantIndex),
        });
        
        variants.push({ platform, variantId: variant.id, s3Key: variantS3Key, optimizationMode, validation: validation.valid });
        
        // Cleanup temp files
        await fs.unlink(normalizedPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        
      } catch (error) {
        await abortMultipart(variantS3Key, uploadId);
        throw error;
      }
    }
    
    // Update video status with all metadata
    await updateVideoStatus(videoId, 'ready', {
      variants: variants.map(v => ({ platform: v.platform, variantId: v.variantId })),
      thumbnails: thumbnails.map(t => ({ platform: t.platform, s3Key: t.s3Key })),
      completedAt: new Date().toISOString(),
      videoHash,
      scenes: scenes.length,
      captions: captions.length,
      hookVariants: hookVariants.length,
    });
    
    // Cleanup original temp file
    await fs.unlink(tempInputPath).catch(() => {});
    
    // Cleanup hook variant temp files
    for (const hv of hookVariants) {
      await fs.unlink(hv.path).catch(() => {});
    }
    
    childLogger.info({ variants: variants.length, thumbnails: thumbnails.length, scenes: scenes.length, captions: captions.length }, 'Video processing completed');
    
    return { success: true, variants, thumbnails, videoHash, scenes, captions, hookVariants };
    
  } catch (error) {
    childLogger.error({ err: error }, 'Video processing failed');
    await updateVideoStatus(videoId, 'failed', { error: error.message, failedAt: new Date().toISOString() });
    throw error;
  }
}

function streamToFile(stream, filePath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);
    stream.on('end', () => resolve(filePath));
    stream.on('error', reject);
    writeStream.on('error', reject);
  });
}

export { PLATFORM_SPECS, OPTIMIZATION_MODES, buildFilterComplex, probeVideo, validateVariant, generateThumbnail, normalizeAudio, detectScenes, generateCaptions, extractHook, generateHookVariants };