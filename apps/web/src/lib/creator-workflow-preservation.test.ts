import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..', '..');

async function source(path: string) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

describe('creator workflow preservation', () => {
  it('retains the native import, review, edit, processing, artifact, learning, and workspace flows', async () => {
    const [home, library, review, editLab, processing, learn, artifact, workspace] = await Promise.all([
      source('apps/mobile/app/(tabs)/index.tsx'),
      source('apps/mobile/app/(tabs)/library.tsx'),
      source('apps/mobile/app/review.tsx'),
      source('apps/mobile/app/edit-lab.tsx'),
      source('apps/mobile/app/processing-detail.tsx'),
      source('apps/mobile/app/(tabs)/learn.tsx'),
      source('apps/mobile/app/artifact-preview.tsx'),
      source('apps/mobile/app/workspace-selector.tsx'),
    ]);
    expect(home).toMatch(/MediaIntakeSheet/);
    expect(library).toMatch(/uploadCreatorSource/);
    expect(review).toMatch(/prepareAdaptationPlan/);
    expect(editLab).toMatch(/saveAdaptationEdit/);
    expect(processing).toMatch(/getProcessingDiagnostic/);
    expect(learn).toMatch(/getSourceAnalytics/);
    expect(artifact).toMatch(/getPrivateArtifactPreview/);
    expect(workspace).toMatch(/selectViralBoostWorkspace/);
  });

  it('retains the self-owned API processing and source route boundaries', async () => {
    const videos = await source('apps/api-gateway/src/routes/videos.ts');
    const growth = await source('apps/api-gateway/src/routes/growth.ts');
    expect(videos).toMatch(/multipart/);
    expect(videos).toMatch(/processing-diagnostics/);
    expect(videos).toMatch(/retry-processing/);
    expect(growth).toMatch(/recipe/);
    expect(growth).toMatch(/adaptations\/:variantId\/preview/);
  });

  it('keeps the developer console truthful rather than restoring static creator or reach claims', async () => {
    const developer = await source('apps/web/src/app/developer/page.tsx');
    expect(developer).toMatch(/parseOwnerClients/);
    expect(developer).toMatch(/parseOwnerOperationalHealth/);
    expect(developer).not.toMatch(/99\.97%|4\.8M|2\.1M|1\.6M|baseline lift|VB-/);
  });
});
