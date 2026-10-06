import { describe, expect, it } from 'vitest';
import { buildPythonInvocation } from './processor-command.js';

describe('processor command boundaries', () => {
  it('preserves every positional argument for Python analysis scripts', () => {
    expect(buildPythonInvocation('print(sys.argv[1])', '/tmp/source.mp4', '27')).toEqual([
      '-c',
      'print(sys.argv[1])',
      '/tmp/source.mp4',
      '27',
    ]);
  });
});
