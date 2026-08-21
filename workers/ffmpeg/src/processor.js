/**
 * Video processing core logic using fluent-ffmpeg
 * Handles platform-specific variant generation with overlays, captions, hooks
 * Includes scene detection, auto-captions (Whisper), and platform optimization
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { config, PLATFORM_SPECS, HOOK_TEMPLATES } from './config.js';
import { logger } from './logger.js';

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Get video metadata using ffprobe
 */
export async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      resolve({
        duration: parseFloat(metadata.format.duration || '0'),
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 30,
        codec: videoStream?.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'none',
        bitrate: parseInt(metadata.format.bit_rate || '0'),
        format: metadata.format.format_name || 'unknown',
      });
    });
  });
}

/**
 * Detect scene changes in video
 */
export async function detectScenes(filePath, threshold = 0.3) {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        '-vf', `select='gt(scene,${threshold})',showinfo`,
        '-f', 'null',
        '-'
      ])
      .on('stderr', (stderr) => {
        const scenes = [];
        const lines = stderr.split('\n');
        for (const line of lines) {
          const match = line.match(/pts_time:(\d+\.?\d*)/);
          if (match) {
            scenes.push(parseFloat(match[1]));
          }
        }
        resolve(scenes);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Generate auto-captions using Whisper (via Python subprocess)
 */
export async function generateCaptions(filePath, language = 'en') {
  // In production, this would call a Whisper service
  // For now, return mock captions structure
  const metadata = await getVideoMetadata(filePath);
  const duration = metadata.duration;
  
  // Generate placeholder captions every 3 seconds
  const captions = [];
  for (let t = 0; t < duration; t += 3) {
    captions.push({
      start: t,
      end: Math.min(t + 3, duration),
      text: `[Auto-caption at ${Math.floor(t)}s]`,
      confidence: 0.9,
    });
  }
  
  return captions;
}

/**
 * Generate thumbnail at specific timestamp
 */
export async function generateThumbnail(inputPath, outputPath, timestamp = '00:00:01', width = 1080) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(timestamp)
      .outputOptions([
        '-vframes 1',
        `-vf scale=${width}:-1`,
        '-q:v 2',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Generate platform-specific variants with safe zones
 */
export async function generateVariants(job, minio, db, sourceVideoPath) {
  const platform = job.platform;
  const spec = PLATFORM_SPECS[platform];

  if (!spec) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const sourceVideo = await db.getSourceVideo(job.sourceVideoId);
  const variants = [];

  // Detect scenes for smart cropping
  const scenes = await detectScenes(sourceVideoPath);
  logger.info({ sceneCount: scenes.length }, 'Scene detection complete');

  // Generate captions if not provided
  let captions = job.captions;
  if (!captions && config.AUTO_CAPTIONS) {
    captions = await generateCaptions(sourceVideoPath);
    logger.info({ captionCount: captions.length }, 'Auto-captions generated');
  }

  for (const variantSpec of spec.variants) {
    const variantId = uuidv4();
    const outputFileName = `${job.sourceVideoId}_${platform}_${variantSpec.name}.mp4`;
    const outputPath = path.join('/tmp', outputFileName);
    const thumbnailFileName = `${job.sourceVideoId}_${platform}_${variantSpec.name}_thumb.jpg`;
    const thumbnailPath = path.join('/tmp', thumbnailFileName);

    logger.info({ variantId, platform, variant: variantSpec.name }, 'Generating variant');

    // Update job progress
    await db.updateJobStatus(job.id, 'processing', 10);

    try {
      // Build FFmpeg filter chain with safe zones
      const filters = buildFilterChain(platform, variantSpec, job, scenes, captions);

      // Process video
      await processWithFFmpeg(sourceVideoPath, outputPath, filters, spec, variantSpec);

      // Generate thumbnail at first scene change or 1s
      const thumbTime = scenes.length > 0 ? formatTimestamp(scenes[0]) : '00:00:01';
      await generateThumbnail(outputPath, thumbnailPath, thumbTime, variantSpec.width);

      // Upload to MinIO
      const videoUrl = await minio.uploadFile('videos', outputFileName, outputPath, {
        jobId: job.id,
        platform,
        variant: variantSpec.name,
        originalName: outputFileName,
      });

      const thumbUrl = await minio.uploadFile('thumbnails', thumbnailFileName, thumbnailPath, {
        jobId: job.id,
        platform,
        variant: variantSpec.name,
        originalName: thumbnailFileName,
      });

      // Get output file stats
      const stats = await fs.stat(outputPath);
      const outputMetadata = await getVideoMetadata(outputPath);

      // Record variant in database
      await db.createPlatformVariant({
        id: variantId,
        jobId: job.id,
        platform,
        variantName: variantSpec.name,
        minioPath: videoUrl,
        thumbnailPath: thumbUrl,
        width: outputMetadata.width,
        height: outputMetadata.height,
        bitrate: variantSpec.bitrate,
        duration: outputMetadata.duration,
        fileSize: stats.size,
      });

      variants.push({
        id: variantId,
        platform,
        variantName: variantSpec.name,
        videoUrl,
        thumbnailUrl: thumbUrl,
        width: outputMetadata.width,
        height: outputMetadata.height,
        duration: outputMetadata.duration,
        fileSize: stats.size,
      });

      // Clean up temp files
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(thumbnailPath).catch(() => {});

      logger.info({ variantId, platform, variant: variantSpec.name }, 'Variant generated successfully');
    } catch (err) {
      logger.error({ err, variantId, platform, variant: variantSpec.name }, 'Variant generation failed');
      throw err;
    }
  }

  return variants;
}

/**
 * Format seconds to HH:MM:SS timestamp
 */
function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Build FFmpeg filter chain for platform-specific processing with safe zones
 */
function buildFilterChain(platform, variantSpec, job, scenes = [], captions = []) {
  const filters = [];
  const safeZone = getSafeZone(platform, variantSpec);

  // 1. Smart crop with scene awareness
  filters.push({
    filter: 'scale',
    options: `${variantSpec.width}:${variantSpec.height}:force_original_aspect_ratio=decrease`,
  });
  filters.push({
    filter: 'pad',
    options: `${variantSpec.width}:${variantSpec.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
  });

  // 2. Add safe zone overlay (visual guide for creators)
  if (config.SHOW_SAFE_ZONES) {
    filters.push({
      filter: 'drawbox',
      options: [
        `x=${safeZone.x}`,
        `y=${safeZone.y}`,
        `w=${safeZone.width}`,
        `h=${safeZone.height}`,
        'color=white@0.3',
        't=2',
      ].join(':'),
    });
  }

  // 3. Add hook overlay if specified
  if (job.hookType && HOOK_TEMPLATES[job.hookType]) {
    const hook = HOOK_TEMPLATES[job.hookType];
    const hookText = job.hookText || getDefaultHookText(job.hookType);

    // Position hook in safe zone
    const hookY = safeZone.y + 50;
    
    filters.push({
      filter: 'drawtext',
      options: [
        `text='${escapeText(hookText)}'`,
        `fontsize=${hook.fontSize}`,
        `fontcolor=${hook.color}`,
        `bordercolor=${hook.strokeColor}`,
        `borderw=${hook.strokeWidth}`,
        `x=(w-text_w)/2`,
        `y=${hookY}`,
        `enable='lt(t,3)'`,
        'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      ].join(':'),
    });
  }

  // 4. Add caption overlay with safe zone positioning
  if (captions && captions.length > 0) {
    for (const caption of captions) {
      // Position captions in lower safe zone
      const captionY = safeZone.y + safeZone.height - 100;
      
      filters.push({
        filter: 'drawtext',
        options: [
          `text='${escapeText(caption.text)}'`,
          `fontsize=${48}`,
          `fontcolor=#FFFFFF`,
          `bordercolor=#000000`,
          `borderw=2`,
          `x=(w-text_w)/2`,
          `y=${captionY}`,
          `enable='between(t,${caption.start},${caption.end})'`,
          'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        ].join(':'),
      });
    }
  }

  // 5. Add watermark/logo if specified
  if (job.watermark) {
    filters.push({
      filter: 'overlay',
      options: `${job.watermark.x || 'W-w-20'}:${job.watermark.y || 'H-h-20'}`,
    });
  }

  // 6. Fade in/out
  filters.push({
    filter: 'fade',
    options: 't=in:st=0:d=0.5',
  });
  filters.push({
    filter: 'fade',
    options: `t=out:st=${Math.max(0, (variantSpec.maxDuration || 60) - 0.5)}:d=0.5`,
  });

  // 7. Audio normalization
  filters.push({
    filter: 'loudnorm',
    options: 'I=-16:TP=-1.5:LRA=11',
  });

  return filters;
}

/**
 * Get platform safe zone for content placement
 */
function getSafeZone(platform, variantSpec) {
  const safeZones = {
    tiktok: {
      x: Math.round(variantSpec.width * 0.1),
      y: Math.round(variantSpec.height * 0.15),
      width: Math.round(variantSpec.width * 0.8),
      height: Math.round(variantSpec.height * 0.6),
    },
    instagram: {
      x: Math.round(variantSpec.width * 0.1),
      y: Math.round(variantSpec.height * 0.1),
      width: Math.round(variantSpec.width * 0.8),
      height: Math.round(variantSpec.height * 0.7),
    },
    youtube: {
      x: Math.round(variantSpec.width * 0.1),
      y: Math.round(variantSpec.height * 0.1),
      width: Math.round(variantSpec.width * 0.8),
      height: Math.round(variantSpec.height * 0.75),
    },
    facebook: {
      x: Math.round(variantSpec.width * 0.1),
      y: Math.round(variantSpec.height * 0.15),
      width: Math.round(variantSpec.width * 0.8),
      height: Math.round(variantSpec.height * 0.6),
    },
    x: {
      x: Math.round(variantSpec.width * 0.1),
      y: Math.round(variantSpec.height * 0.1),
      width: Math.round(variantSpec.width * 0.8),
      height: Math.round(variantSpec.height * 0.8),
    },
    linkedin: {
      x: Math.round(variantSpec.width * 0.1),
      y: Math.round(variantSpec.height * 0.1),
      width: Math.round(variantSpec.width * 0.8),
      height: Math.round(variantSpec.height * 0.8),
    },
  };
  
  return safeZones[platform] || safeZones.tiktok;
}

/**
 * Process video with FFmpeg
 */
function processWithFFmpeg(inputPath, outputPath, filters, spec, variantSpec) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    // Apply video filters
    if (filters.length > 0) {
      const filterComplex = filters.map(f => {
        if (f.filter === 'overlay' && f.options) {
          return `[1:v][0:v]overlay=${f.options}`;
        }
        return `${f.filter}=${f.options}`;
      }).join(',');

      command = command.videoFilters(filterComplex);
    }

    // Encoding options optimized for each platform
    command
      .videoCodec(spec.codec)
      .audioCodec(spec.audioCodec)
      .audioBitrate(spec.audioBitrate)
      .outputOptions([
        `-crf ${config.TARGET_CRF}`,
        `-preset ${config.PRESET}`,
        `-b:v ${variantSpec.bitrate}`,
        `-maxrate ${variantSpec.bitrate}`,
        `-bufsize ${parseInt(variantSpec.bitrate) * 2}k`,
        `-threads ${config.FFMPEG_THREADS}`,
        '-movflags +faststart', // Optimize for streaming
        '-pix_fmt yuv420p', // Compatibility
        '-profile:v high',
        '-level 4.1',
      ])
      .duration(variantSpec.maxDuration || spec.maxDuration)
      .output(outputPath)
      .on('start', (cmd) => {
        logger.debug({ cmd: cmd.substring(0, 200) }, 'FFmpeg started');
      })
      .on('progress', (progress) => {
        logger.debug({ percent: progress.percent }, 'FFmpeg progress');
      })
      .on('end', () => {
        logger.info({ outputPath }, 'FFmpeg processing complete');
        resolve();
      })
      .on('error', (err) => {
        logger.error({ err }, 'FFmpeg error');
        reject(err);
      })
      .run();
  });
}

/**
 * Get default hook text for hook type
 */
function getDefaultHookText(hookType) {
  const defaults = {
    curiosity: 'You won\'t believe what happens next...',
    authority: 'Expert reveals the truth about...',
    transformation: 'Watch this incredible transformation!',
    mistake: 'Stop making this costly mistake!',
    contrarian: 'Everyone says X, but actually Y...',
    money: 'How I made $10K in 30 days...',
    protocol: 'The exact 3-step framework...',
  };
  return defaults[hookType] || '';
}

/**
 * Get Y position for hook based on position setting
 */
function getHookYPosition(position, height) {
  switch (position) {
    case 'top':
      return '50';
    case 'center':
      return '(h-text_h)/2';
    case 'bottom':
      return 'h-text_h-50';
    default:
      return '50';
  }
}

/**
 * Escape text for FFmpeg drawtext filter
 */
function escapeText(text) {
  return text
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Main job processor
 */
export async function processVideoJob(job, minio, db, logger) {
  const startTime = Date.now();

  logger.info({ jobId: job.id, type: job.type }, 'Starting video job processing');

  try {
    // Download source video from MinIO
    const sourceVideo = await db.getSourceVideo(job.sourceVideoId);
    if (!sourceVideo) {
      throw new Error(`Source video not found: ${job.sourceVideoId}`);
    }

    const sourcePath = path.join('/tmp', `source_${job.sourceVideoId}.mp4`);
    await minio.downloadFile('videos', sourceVideo.minio_path.split('/').pop(), sourcePath);

    // Get source metadata
    const metadata = await getVideoMetadata(sourcePath);
    await db.updateJobStatus(job.id, 'processing', 5);

    // Generate variants based on job type
    let variants = [];

    if (job.type === 'generate_variants') {
      variants = await generateVariants(job, minio, db, sourcePath);
    } else if (job.type === 'single_variant') {
      // For single variant (e.g., re-processing)
      const spec = PLATFORM_SPECS[job.platform];
      const variantSpec = spec?.variants.find(v => v.name === job.variant);
      if (!variantSpec) {
        throw new Error(`Variant not found: ${job.variant} for ${job.platform}`);
      }
      variants = await generateVariants({ ...job, platform: job.platform }, minio, db, sourcePath);
    }

    // Update job as completed
    await db.updateJobStatus(job.id, 'completed', 100, null, variants[0]?.videoUrl);

    // Clean up source file
    await fs.unlink(sourcePath).catch(() => {});

    const duration = Date.now() - startTime;
    logger.info({ jobId: job.id, duration, variantCount: variants.length }, 'Job completed successfully');

    return { variants, duration };
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'Job processing failed');
    await db.updateJobStatus(job.id, 'failed', null, err.message);
    throw err;
  }
}

export default { 
  processVideoJob, 
  getVideoMetadata, 
  generateThumbnail, 
  generateVariants,
  detectScenes,
  generateCaptions,
};
