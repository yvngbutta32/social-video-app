import api from '../src/index.js';

async function verify() {
  const response = await api.fetch(new Request('http://localhost/api/v1/videos', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type,x-workspace-id,x-viralboost-client',
    },
  }));
  const allowedHeaders = response.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
  if (response.status >= 400 || !allowedHeaders.includes('x-workspace-id') || !allowedHeaders.includes('x-viralboost-client')) {
    throw new Error('CORS preflight must permit the explicit workspace-selection and native-client headers.');
  }
  console.log('Workspace CORS header verification passed.');
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
