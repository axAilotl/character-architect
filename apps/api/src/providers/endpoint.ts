/** Accept provider roots and versioned API bases without duplicating /v1. */
export function providerEndpoint(baseURL: string, endpoint: string): string {
  const url = new URL(baseURL.trim());
  let path = url.pathname.replace(/\/+$/, '');

  if (url.hostname === 'openrouter.ai' && ['', '/api', '/v1', '/api/v1'].includes(path)) {
    path = '/api/v1';
  } else if (url.hostname === 'api.deepseek.com' && path === '') {
    // DeepSeek documents its unversioned root as the OpenAI-compatible API base.
  } else if (!/\/v\d+$/.test(path)) {
    path += '/v1';
  }

  url.pathname = `${path}/${endpoint}`;
  return url.toString();
}
