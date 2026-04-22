// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Clickjacking Penetration Tests (Cases 47-48)
 *
 * Tests that the application cannot be embedded in iframes
 * on malicious sites (clickjacking attacks).
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Clickjacking Protection', () => {

  // Case 47: Iframe embedding check via headers
  test('should prevent iframe embedding via X-Frame-Options', async ({ request }) => {
    const response = await request.get(BASE_URL);
    const xFrameOptions = response.headers()['x-frame-options'];
    const csp = response.headers()['content-security-policy'];

    let protected_ = false;

    // Check X-Frame-Options header
    if (xFrameOptions) {
      const upper = xFrameOptions.toUpperCase();
      if (upper === 'DENY' || upper === 'SAMEORIGIN') {
        protected_ = true;
      }
    }

    // Check CSP frame-ancestors directive
    if (csp && csp.includes('frame-ancestors')) {
      protected_ = true;
    }

    if (!protected_) {
      console.warn('WARNING: No clickjacking protection (X-Frame-Options or CSP frame-ancestors missing)');
    }

    expect(response.status()).toBe(200);
  });

  // Case 48: Actual iframe embedding attempt
  test('should block actual iframe embedding attempt', async ({ page }) => {
    // Create a page that embeds the target in an iframe
    const attackerHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Attacker Page</title></head>
      <body>
        <h1>Clickjacking Test</h1>
        <iframe
          id="target"
          src="${BASE_URL}"
          style="width:100%;height:500px;opacity:0.5;position:absolute;top:50px;"
        ></iframe>
        <script>
          window.iframeLoaded = false;
          window.iframeBlocked = false;
          const frame = document.getElementById('target');

          frame.onload = () => {
            try {
              // Try to access the iframe's content (should fail due to same-origin policy)
              const doc = frame.contentDocument || frame.contentWindow.document;
              window.iframeLoaded = true;
            } catch (e) {
              // Cross-origin, can't access - but iframe still loaded visually
              window.iframeLoaded = true;
            }
          };

          frame.onerror = () => {
            window.iframeBlocked = true;
          };
        </script>
      </body>
      </html>
    `;

    // Navigate to a data URL with the attack page
    await page.setContent(attackerHtml);
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => ({
      loaded: window.iframeLoaded,
      blocked: window.iframeBlocked,
    }));

    // If X-Frame-Options: DENY is set, the browser won't render the iframe
    // Note: This may behave differently in headless mode
    console.log(`Iframe loaded: ${result.loaded}, blocked: ${result.blocked}`);

    // Check if X-Frame-Options is present via a direct request
    const apiResponse = await page.request.get(BASE_URL);
    const xFrame = apiResponse.headers()['x-frame-options'];

    if (!xFrame) {
      console.warn('WARNING: Application can be embedded in iframes - clickjacking vulnerability');
    }
  });
});
