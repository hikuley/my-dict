/**
 * API helper functions for creating and cleaning up test data.
 */

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

/**
 * Create a word directly via API for test setup.
 */
export async function createWord(request, { slug, title, sections = [], phonetic = '', subtitle = '' }) {
  const response = await request.post(`${API_URL}/api/words`, {
    data: { slug, title, phonetic, subtitle, sections },
  });
  return response;
}

/**
 * Delete a word directly via API for test cleanup.
 */
export async function deleteWord(request, slug) {
  return request.delete(`${API_URL}/api/words/${encodeURIComponent(slug)}`);
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
