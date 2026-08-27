function boundedFocus(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
}

function escapeDrawtext(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/[\r\n]+/g, ' ');
}

function headlineOverlayY(placement, spec) {
  const top = Math.max(32, Number(spec.safeZones?.top) || Math.round(spec.height * 0.12));
  const bottom = Math.max(32, Number(spec.safeZones?.bottom) || Math.round(spec.height * 0.16));
  if (placement === 'center_safe') return '(h-text_h)/2';
  if (placement === 'lower_safe') return `h-text_h-${bottom}`;
  return String(top);
}

export function buildFilterComplex(spec, inputWidth, inputHeight, options = {}) {
  const {
    mode = 'fit',
    safeZone = false,
    addCaptions = false,
    captionText = '',
    headlinePlacement = 'upper_safe',
    focusPoint = { x: 0.5, y: 0.5 },
  } = options;

  const { width, height, safeZones } = spec;
  const aspectRatio = inputWidth / inputHeight;
  const targetAspect = width / height;
  const focusX = boundedFocus(focusPoint?.x);
  const focusY = boundedFocus(focusPoint?.y);
  let videoFilter = '';

  if (mode === 'crop') {
    videoFilter = aspectRatio > targetAspect
      ? `[0:v]crop=ih*${targetAspect}:ih,scale=${width}:${height}`
      : `[0:v]crop=iw:iw/${targetAspect},scale=${width}:${height}`;
  } else if (mode === 'blur_bg') {
    videoFilter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=20[bg];[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
  } else if (mode === 'smart_crop' || mode === 'smart_fill') {
    if (aspectRatio > targetAspect) {
      const cropWidth = `ih*${targetAspect.toFixed(8)}`;
      videoFilter = `[0:v]crop=${cropWidth}:ih:max(0\\,min(iw-${cropWidth}\\,${focusX.toFixed(6)}*iw-(${cropWidth})/2)):0,scale=${width}:${height}`;
    } else {
      const cropHeight = `iw/${targetAspect.toFixed(8)}`;
      videoFilter = `[0:v]crop=iw:${cropHeight}:0:max(0\\,min(ih-${cropHeight}\\,${focusY.toFixed(6)}*ih-(${cropHeight})/2)),scale=${width}:${height}`;
    }
  } else {
    videoFilter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
  }

  // Safe-zone guides are for editor/debug previews only, never default delivery artifacts.
  if (safeZone && safeZones) {
    const { top, bottom, left, right } = safeZones;
    videoFilter += `,drawbox=x=${left}:y=${top}:w=${width-left-right}:h=${height-top-bottom}:color=white@0.3:t=2`;
  }

  if (addCaptions && captionText) {
    videoFilter += `,drawtext=text='${escapeDrawtext(captionText)}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=${headlineOverlayY(headlinePlacement, spec)}`;
  }

  return videoFilter;
}

export { headlineOverlayY };
