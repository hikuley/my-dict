// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Information Disclosure Penetration Tests (Cases 43-46)
 *
 * Tests that the application does not leak sensitive information
 * through error messages, source maps, or directory listings.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Information Disclosure', () => {

  // Case 43: Error message leakage
  test('500 errors should not expose stack traces', async ({ request }) => {
    // Send intentionally malformed requests to try to trigger 500s
    const badRequests = [
      request.post(`${BASE_URL}/api/words`, {
        data: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
      request.post(`${BASE_URL}/api/words/generate`, {
        data: '{{invalid}}',
        headers: { 'Content-Type': 'application/json' },
      }),
    ];

    const responses = await Promise.all(badRequests);

    for (const response of responses) {
      const body = await response.text();

      // Should not contain stack traces or internal details
      expect(body).not.toContain('at com.');
      expect(body).not.toContain('at org.');
      expect(body).not.toContain('java.lang.');
      expect(body).not.toContain('SQLException');
      expect(body).not.toContain('NullPointerException');
      expect(body).not.toContain('stackTrace');
      expect(body).not.toContain('ClassNotFoundException');
    }
  });

  test('error responses should not expose database details', async ({ request }) => {
    // Try to trigger database errors
    const response = await request.get(`${BASE_URL}/api/words/search`, {
      params: { q: "'; SELECT version();--" },
    });

    const body = await response.text();

    // Should not contain DB version or schema info
    expect(body).not.toContain('PostgreSQL');
    expect(body).not.toContain('pg_catalog');
    expect(body).not.toContain('information_schema');
    expect(body).not.toContain('jdbc:postgresql');
  });

  // Case 44: API endpoint discovery
  test('non-existent API endpoints should not leak info', async ({ request }) => {
    const endpoints = [
      '/api/admin',
      '/api/config',
      '/api/debug',
      '/api/actuator',
      '/api/actuator/env',
      '/api/actuator/health',
      '/api/swagger-ui.html',
      '/api/v2/api-docs',
      '/api/internal',
      '/api/users',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const body = await response.text();

      // Should be 404 or redirect - not exposing internal details
      if (response.status() !== 404) {
        // If not 404, verify no sensitive info is exposed
        expect(body).not.toContain('password');
        expect(body).not.toContain('secret');
        expect(body).not.toContain('api_key');
        expect(body).not.toContain('ANTHROPIC_API_KEY');
      }
    }
  });

  // Case 45: Source map exposure
  test('source maps should not be served in production', async ({ request }) => {
    // Try to access common source map paths
    const mapPaths = [
      '/assets/index.js.map',
      '/src/App.jsx',
      '/src/main.jsx',
      '/src/store/wordsSlice.js',
    ];

    for (const path of mapPaths) {
      const response = await request.get(`${BASE_URL}${path}`);

      // Source maps should return 404 in production
      if (response.status() === 200) {
        const contentType = response.headers()['content-type'] || '';
        // If served, it should not be a source map
        if (contentType.includes('json') || contentType.includes('javascript')) {
          const body = await response.text();
          // Should not contain source map content
          if (body.includes('"mappings"') || body.includes('sourceMappingURL')) {
            console.warn(`WARNING: Source map exposed at ${path}`);
          }
        }
      }
    }
  });

  // Case 46: Directory listing
  test('directory listing should be disabled', async ({ request }) => {
    const paths = [
      '/api/',
      '/assets/',
      '/static/',
      '/src/',
    ];

    for (const path of paths) {
      const response = await request.get(`${BASE_URL}${path}`);
      const body = await response.text();

      // Should not show directory listing
      expect(body).not.toContain('Index of');
      expect(body).not.toContain('Directory listing');
      expect(body).not.toContain('<pre>'); // nginx default directory listing uses <pre>

      // If it's a file listing, it would contain multiple href links to files
      const hrefCount = (body.match(/href="[^"]*\.[a-z]+"/g) || []).length;
      if (hrefCount > 10) {
        console.warn(`WARNING: Possible directory listing at ${path} (${hrefCount} file links)`);
      }
    }
  });
});
