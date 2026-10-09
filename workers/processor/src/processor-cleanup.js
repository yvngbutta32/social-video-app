import fs from 'fs/promises';

export async function cleanupFiles(filePaths, unlink = fs.unlink) {
  const paths = [...new Set(filePaths.filter(Boolean))];
  await Promise.all(paths.map((filePath) => unlink(filePath).catch(() => {})));
  return paths;
}
