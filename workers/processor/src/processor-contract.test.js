import { describe, expect, it } from 'vitest';
import { buildPythonInvocation } from './processor-command.js';
import { cleanupFiles } from './processor-cleanup.js';

describe('processor command boundaries', () => {
  it('preserves every positional argument for Python analysis scripts', () => {
    expect(buildPythonInvocation('print(sys.argv[1])', '/tmp/source.mp4', '27')).toEqual([
      '-c',
      'print(sys.argv[1])',
      '/tmp/source.mp4',
      '27',
    ]);
  });

  it('cleans each temporary path once and does not mask unlink failures', async () => {
    const removed = [];
    const unlink = async (filePath) => {
      removed.push(filePath);
      if (filePath === '/tmp/missing.mp4') throw new Error('already removed');
    };

    await expect(cleanupFiles([
      '/tmp/input.mp4',
      '/tmp/input.mp4',
      '/tmp/missing.mp4',
      null,
    ], unlink)).resolves.toEqual(['/tmp/input.mp4', '/tmp/missing.mp4']);
    expect(removed).toEqual(['/tmp/input.mp4', '/tmp/missing.mp4']);
  });
});
