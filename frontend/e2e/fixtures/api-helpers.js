/**
 * API helper functions for creating and cleaning up test data.
 */

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

/** Cached auth token for API helpers */
let _authToken = null;

/**
 * Sign up (or log in) a test user and return the JWT token.
 * The token is cached for the lifetime of the test worker.
 */
export async function getAuthToken(request) {
  if (_authToken) return _authToken;

  const email = `e2e-api-helper@test.com`;
  const password = 'TestPassword123';
  const name = 'E2E API Helper';

  // Try login first (user may already exist)
  let res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (res.ok()) {
    const body = await res.json();
    _authToken = body.token;
    return _authToken;
  }

  // Sign up
  res = await request.post(`${API_URL}/api/auth/signup`, {
    data: { name, email, password },
  });

  if (res.ok()) {
    const body = await res.json();
    _authToken = body.token;
    return _authToken;
  }

  // Signup may fail (e.g. mail server unavailable) but user might be created.
  // Retry login.
  res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (res.ok()) {
    const body = await res.json();
    _authToken = body.token;
    return _authToken;
  }

  throw new Error(`Failed to authenticate test user: ${res.status()} ${await res.text()}`);
}

/**
 * Return auth headers for API requests.
 */
export async function authHeaders(request) {
  const token = await getAuthToken(request);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Create a word directly via API for test setup.
 */
export async function createWord(request, { slug, title, sections = [], phonetic = '', subtitle = '' }) {
  const headers = await authHeaders(request);
  const response = await request.post(`${API_URL}/api/words`, {
    data: { slug, title, phonetic, subtitle, sections },
    headers,
  });
  return response;
}

/**
 * Delete a word directly via API for test cleanup.
 */
export async function deleteWord(request, slug) {
  const headers = await authHeaders(request);
  return request.delete(`${API_URL}/api/words/${encodeURIComponent(slug)}`, { headers });
}

/**
 * Create a word with malicious section content for XSS testing.
 */
export async function createXssWord(request, slug, xssPayload) {
  const sections = [
    {
      title: 'Definition',
      icon: '📖',
      content: xssPayload,
    },
  ];
  return createWord(request, {
    slug,
    title: slug.toUpperCase(),
    sections,
    subtitle: 'XSS test word',
  });
}

/**
 * Cleanup: delete a word, ignoring errors if it doesn't exist.
 */
export async function safeDelete(request, slug) {
  try {
    await deleteWord(request, slug);
  } catch {
    // ignore
  }
}

/**
 * Authenticate a Playwright page by setting localStorage token + user,
 * then reload so the app sees the authenticated state.
 */
export async function authenticatePage(page, request) {
  const token = await getAuthToken(request);
  const user = {
    id: '00000000-0000-0000-0000-000000000099',
    name: 'E2E API Helper',
    email: 'e2e-api-helper@test.com',
    authType: 'manual',
    isVerified: true,
  };
  await page.goto('/');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });
  await page.reload();
}
