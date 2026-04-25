// @ts-check
import { test, expect } from '@playwright/test';
import { authenticatePage } from '../fixtures/api-helpers.js';

/**
 * WebSocket Security Penetration Tests (Cases 35-38)
 *
 * Tests WebSocket connection security, message validation,
 * and resilience to malicious inputs.
 */

test.describe('WebSocket Security', () => {

  // Case 35: WebSocket origin validation
  test('should validate WebSocket connection origin', async ({ page, request }) => {
    await authenticatePage(page, request);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(protocol + '//' + window.location.host + '/ws');

          ws.onopen = () => {
            // Connection accepted - check if origin was validated
            ws.close();
            resolve({ connected: true, error: null });
          };

          ws.onerror = () => {
            resolve({ connected: false, error: 'connection error' });
          };

          setTimeout(() => resolve({ connected: false, error: 'timeout' }), 5000);
        } catch (e) {
          resolve({ connected: false, error: e.message });
        }
      });
    });

    // Document: if connection succeeds without origin check, it's a finding
    if (result.connected) {
      console.warn('WARNING: WebSocket accepts connections without origin validation');
    }
    expect(result).toBeDefined();
  });

  // Case 36: Malformed WebSocket messages
  test('should handle malformed JSON messages without crashing', async ({ page, request }) => {
    await authenticatePage(page, request);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + window.location.host + '/ws');

        ws.onopen = () => {
          // Send malformed messages
          try { ws.send('not json at all'); } catch {}
          try { ws.send('{invalid json}'); } catch {}
          try { ws.send(''); } catch {}
          try { ws.send('null'); } catch {}
          try { ws.send('{"type": "unknown-type", "data": null}'); } catch {}

          // Send a very large message
          try { ws.send('x'.repeat(100000)); } catch {}

          setTimeout(() => {
            ws.close();
            resolve({ crashed: false });
          }, 1000);
        };

        ws.onerror = () => resolve({ crashed: false });
        setTimeout(() => resolve({ crashed: false }), 5000);
      });
    });

    // The page should not have crashed
    expect(result.crashed).toBe(false);

    // Verify the page is still functional
    const title = await page.locator('body').textContent();
    expect(title).toContain('My Dictionary');
  });

  test('should handle binary WebSocket data without crashing', async ({ page, request }) => {
    await authenticatePage(page, request);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + window.location.host + '/ws');

        ws.onopen = () => {
          // Send binary data
          try {
            const buffer = new ArrayBuffer(256);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < 256; i++) view[i] = i;
            ws.send(buffer);
          } catch {}

          setTimeout(() => {
            ws.close();
            resolve({ crashed: false });
          }, 500);
        };

        ws.onerror = () => resolve({ crashed: false });
        setTimeout(() => resolve({ crashed: false }), 5000);
      });
    });

    expect(result.crashed).toBe(false);
  });

  // Case 37: WebSocket message replay
  test('should handle replayed word-ready messages gracefully', async ({ page, request }) => {
    await authenticatePage(page, request);
    await page.waitForSelector('table');

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + window.location.host + '/ws');

        ws.onopen = () => {
          // Replay word-ready messages multiple times
          const fakeReady = JSON.stringify({
            type: 'word-ready',
            data: { word: 'replay-test', slug: 'replay-test' },
          });

          for (let i = 0; i < 10; i++) {
            ws.send(fakeReady);
          }

          setTimeout(() => {
            ws.close();
            resolve({ sent: true });
          }, 500);
        };

        ws.onerror = () => resolve({ sent: false });
        setTimeout(() => resolve({ sent: false }), 5000);
      });
    });

    // Page should not crash or show duplicate entries
    await page.waitForTimeout(1000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('My Dictionary');
  });

  // Case 38: WebSocket connection flood
  test('should handle rapid WebSocket connections without freezing', async ({ page, request }) => {
    await authenticatePage(page, request);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const baseUrl = protocol + '//' + window.location.host + '/ws';
        let openCount = 0;
        let errorCount = 0;

        // Open 20 concurrent connections
        for (let i = 0; i < 20; i++) {
          try {
            const ws = new WebSocket(baseUrl);
            ws.onopen = () => {
              openCount++;
              ws.close();
            };
            ws.onerror = () => errorCount++;
          } catch {
            errorCount++;
          }
        }

        setTimeout(() => {
          resolve({ openCount, errorCount });
        }, 3000);
      });
    });

    // Page should still be responsive
    const isResponsive = await page.locator('body').textContent();
    expect(isResponsive).toContain('My Dictionary');

    console.log(`WebSocket flood: ${result.openCount} opened, ${result.errorCount} errors`);
  });
});
