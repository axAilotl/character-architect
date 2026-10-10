import { instanceApiUrl } from '@character-foundry/character-foundry/integrations';

/** Lumiverse mounts its character API at /api/v1, including behind a proxy prefix. */
export function lumiverseApiUrl(baseUrl: string, endpoint: string): string {
  const url = new URL(baseUrl.trim());
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '/api');
  return instanceApiUrl(url.toString(), `v1/${endpoint}`);
}
