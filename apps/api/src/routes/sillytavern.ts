import type { FastifyInstance } from 'fastify';
import { CardRepository } from '../db/repository.js';
import { config } from '../config.js';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import FormData from 'form-data';
import axios from 'axios';

export async function sillyTavernRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);

  // Helper function to build SillyTavern headers
  function buildSillyTavernHeaders(settings: any, overrides: Record<string, string> = {}) {
    const baseUrl = (settings.baseUrl || '').replace(/\/$/, '');
    const headers: Record<string, string> = {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Connection: 'keep-alive',
      Origin: baseUrl,
      Referer: baseUrl,
    };

    return { ...headers, ...overrides };
  }

  // Push card to SillyTavern
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/push-to-sillytavern',
    async (request, reply) => {
      try {
        const settings = config.sillyTavern;

        // Validate configuration
        if (!settings.enabled) {
          reply.code(400);
          return {
            success: false,
            error: 'SillyTavern integration is disabled in configuration',
          };
        }

        if (!settings.baseUrl) {
          reply.code(400);
          return {
            success: false,
            error: 'SillyTavern baseUrl is not configured',
          };
        }

        // Get card
        const cardId = request.params.id;
        const card = cardRepo.get(cardId);
        if (!card) {
          reply.code(404);
          return { success: false, error: 'Card not found' };
        }

        // Check if card has a main portrait asset or exported PNG
        const pngPath = join(config.storagePath, 'exports', `${cardId}.png`);

        if (!existsSync(pngPath)) {
          reply.code(404);
          return {
            success: false,
            error:
              'Card PNG not found. Please export the card as PNG first.',
          };
        }

        const baseUrl = settings.baseUrl.replace(/\/$/, '');
        const baseHeaders = buildSillyTavernHeaders(settings);

        // Step 1: Get CSRF token
        const csrfHeaders = { ...baseHeaders };
        if (settings.sessionCookie) {
          csrfHeaders.Cookie = settings.sessionCookie;
        }

        fastify.log.info(`Fetching CSRF token from ${baseUrl}/csrf-token`);
        const csrfResponse = await axios.get(`${baseUrl}/csrf-token`, {
          headers: csrfHeaders,
          timeout: 15000,
          validateStatus: () => true,
        });

        if (
          csrfResponse.status < 200 ||
          csrfResponse.status >= 300 ||
          !csrfResponse.data?.token
        ) {
          const message =
            csrfResponse.data?.error ||
            'Failed to obtain SillyTavern CSRF token';
          reply.code(csrfResponse.status || 502);
          return {
            success: false,
            error: message,
            response: csrfResponse.data,
          };
        }

        const csrfToken = csrfResponse.data.token;
        fastify.log.info('CSRF token obtained successfully');

        // Step 2: Build cookie header
        const cookieSet = new Set<string>();

        const registerCookie = (value: string | undefined) => {
          if (!value) return;
          const cookieString = value.split(';')[0]; // Get only name=value
          if (cookieString) {
            cookieSet.add(cookieString.trim());
          }
        };

        // Add cookies from CSRF response
        const setCookieHeader = csrfResponse.headers['set-cookie'];
        if (Array.isArray(setCookieHeader)) {
          setCookieHeader.forEach(registerCookie);
        } else if (typeof setCookieHeader === 'string') {
          registerCookie(setCookieHeader);
        }

        // Add cookies from config
        if (settings.sessionCookie) {
          const attributePattern =
            /^(path|max-age|expires|domain|samesite|secure|httponly)/i;
          settings.sessionCookie
            .split(';')
            .map((part) => part.trim())
            .filter(
              (part) => part.includes('=') && !attributePattern.test(part)
            )
            .forEach((part) => registerCookie(part));
        }

        const cookieHeader = Array.from(cookieSet).join('; ');

        if (!cookieHeader) {
          reply.code(502);
          return {
            success: false,
            error: 'Failed to capture SillyTavern session cookies',
          };
        }

        // Step 3: Upload card
        const form = new FormData();
        form.append('avatar', createReadStream(pngPath), {
          filename: `${cardId}.png`,
          contentType: 'image/png',
        });
        form.append('file_type', 'png');
        form.append('preserved_name', cardId);

        const formHeaders = form.getHeaders();
        const importHeaders = {
          ...baseHeaders,
          ...formHeaders,
          Cookie: cookieHeader,
          'X-CSRF-Token': csrfToken,
          Accept: 'application/json, text/plain, */*',
        };

        fastify.log.info(
          `Uploading card to ${baseUrl}${settings.importEndpoint}`
        );
        const importResponse = await axios.post(
          `${baseUrl}${settings.importEndpoint}`,
          form,
          {
            headers: importHeaders,
            timeout: 30000,
            maxBodyLength: Infinity,
            validateStatus: () => true,
          }
        );

        if (importResponse.status >= 200 && importResponse.status < 300) {
          fastify.log.info(
            `Card ${cardId} pushed to SillyTavern successfully`
          );
          return {
            success: true,
            status: importResponse.status,
            imported: importResponse.data,
            fileName: importResponse.data?.file_name || `${cardId}.png`,
          };
        } else {
          fastify.log.warn(
            `SillyTavern import failed with status ${importResponse.status}`
          );
          reply.code(importResponse.status);
          return {
            success: false,
            error:
              importResponse.data?.error ||
              `SillyTavern returned status ${importResponse.status}`,
            response: importResponse.data,
          };
        }
      } catch (error: any) {
        fastify.log.error({ error }, 'Failed to push card to SillyTavern');
        reply.code(500);
        return {
          success: false,
          error: error?.message || 'Failed to push card to SillyTavern',
        };
      }
    }
  );
}
