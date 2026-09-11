import { describe, expect, it } from 'vitest';
import { buildFilterComplex, headlineOverlayY } from './render-filter.js';

describe('render filter contract', () => {
  const spec = { width: 1080, height: 1920, safeZones: { top: 160, bottom: 220, left: 72, right: 72 } };

  it('builds a deterministic focused crop for a portrait artifact', () => {
    const filter = buildFilterComplex(spec, 1920, 1080, { mode: 'smart_crop', focusPoint: { x: 0.75, y: 0.4 } });
    expect(filter).toContain('[0:v]crop=');
    expect(filter).toContain('scale=1080:1920');
    expect(filter).not.toContain('drawbox');
  });

  it('escapes caption text and keeps editor safe-zone guides explicit', () => {
    const filter = buildFilterComplex(spec, 1080, 1920, {
      mode: 'fit',
      safeZone: true,
      addCaptions: true,
      captionText: "creator: it's 100% ready",
      headlinePlacement: 'lower_safe',
    });
    expect(filter).toContain('drawbox');
    expect(filter).toContain("creator\\: it\\'s 100\\% ready");
    expect(filter).toContain('y=h-text_h-220');
  });

  it('maps headline placement to bounded safe positions', () => {
    expect(headlineOverlayY('upper_safe', spec)).toBe('160');
    expect(headlineOverlayY('lower_safe', spec)).toBe('h-text_h-220');
    expect(headlineOverlayY('center_safe', spec)).toBe('(h-text_h)/2');
  });
});
