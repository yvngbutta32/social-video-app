export function buildPythonInvocation(script, ...args) {
  return ['-c', script, ...args];
}
