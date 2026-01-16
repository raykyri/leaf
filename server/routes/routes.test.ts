/**
 * HTTP Route Integration Tests
 *
 * Tests the Hono routes with real ATProto credentials.
 * Uses Hono's built-in testing capabilities.
 */

import test from 'ava';
import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../database/schema.ts';

// Test configuration
const TEST_HANDLE = process.env.TEST_HANDLE;
const TEST_APP_PASSWORD = process.env.TEST_APP_PASSWORD;
const TEST_DB_PATH = './data/test-routes.db';

const hasCredentials = TEST_HANDLE && TEST_APP_PASSWORD;
const skipIfNoCredentials = !hasCredentials;

// Log skip reason if credentials not provided
if (!hasCredentials) {
  console.log('Skipping HTTP route integration tests: TEST_HANDLE and TEST_APP_PASSWORD not set');
}

// Create a test app that uses a test database
async function createTestApp() {
  // Set test database path before importing modules that use it
  process.env.DATABASE_PATH = TEST_DB_PATH;

  // Ensure data directory exists
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Import routes after setting env
  const { csrfProtection } = await import('../middleware/csrf.js');
  const authRoutes = (await import('../routes/auth.js')).default;
  const postsRoutes = (await import('../routes/posts.js')).default;
  const { loginPage } = await import('../views/pages.js');
  const { getDatabase } = await import('../database/index.js');

  // Initialize database
  getDatabase();

  const app = new Hono();
  app.use('*', csrfProtection);
  app.route('/auth', authRoutes);
  app.route('/', postsRoutes);

  // Home page
  app.get('/', (c) => {
    return c.html(loginPage());
  });

  return app;
}

// Cleanup function
async function cleanupTestDb() {
  try {
    const { closeDatabase } = await import('../database/index.js');
    closeDatabase();
  } catch {
    // Ignore
  }

  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

// Helper function to extract cookies from response
function extractCookies(res: Response): Map<string, string> {
  const cookies = new Map<string, string>();
  const setCookieHeaders = res.headers.getSetCookie();
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/^([^=]+)=([^;]+)/);
    if (match) {
      cookies.set(match[1], match[2]);
    }
  }
  return cookies;
}

// Public Routes tests
test('Public Routes › GET / should return login page', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/');
    t.is(res.status, 200);
    const text = await res.text();
    t.true(text.includes('Login'));
    t.true(text.includes('Leaflet Blog'));
  } finally {
    await cleanupTestDb();
  }
});

test('Public Routes › GET /auth/login should return login page', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/auth/login');
    t.is(res.status, 200);
    const text = await res.text();
    t.true(text.includes('Login'));
  } finally {
    await cleanupTestDb();
  }
});

test('Public Routes › GET /posts should return empty posts list', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/posts');
    t.is(res.status, 200);
    const text = await res.text();
    t.true(text.includes('All Posts'));
  } finally {
    await cleanupTestDb();
  }
});

test('Public Routes › GET /posts with pagination should work', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/posts?page=1');
    t.is(res.status, 200);
  } finally {
    await cleanupTestDb();
  }
});

test('Public Routes › GET /user/:handle for nonexistent user should return 404', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/user/nonexistent.bsky.social');
    t.is(res.status, 404);
    const text = await res.text();
    t.true(text.includes('Not Found'));
  } finally {
    await cleanupTestDb();
  }
});

test('Public Routes › GET /posts/:did/:rkey for nonexistent post should return 404', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/posts/did:plc:fake/nonexistent');
    t.is(res.status, 404);
    const text = await res.text();
    t.true(text.includes('Not Found'));
  } finally {
    await cleanupTestDb();
  }
});

// Protected Routes (Unauthenticated) tests
test('Protected Routes › GET /profile should redirect to home', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/profile', { redirect: 'manual' });
    t.is(res.status, 302);
    t.is(res.headers.get('location'), '/');
  } finally {
    await cleanupTestDb();
  }
});

test('Protected Routes › GET /create should redirect to home', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/create', { redirect: 'manual' });
    t.is(res.status, 302);
    t.is(res.headers.get('location'), '/');
  } finally {
    await cleanupTestDb();
  }
});

test('Protected Routes › POST /create should redirect to home', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/create', {
      method: 'POST',
      body: new URLSearchParams({ title: 'Test', content: 'Content' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });
    t.is(res.status, 302);
    t.is(res.headers.get('location'), '/');
  } finally {
    await cleanupTestDb();
  }
});

test('Protected Routes › POST /refresh should redirect to home', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/refresh', {
      method: 'POST',
      redirect: 'manual'
    });
    t.is(res.status, 302);
    t.is(res.headers.get('location'), '/');
  } finally {
    await cleanupTestDb();
  }
});

// Authentication tests
test('Authentication › POST /auth/login with missing credentials should show error', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({}),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    t.is(res.status, 200);
    const text = await res.text();
    t.true(text.includes('Please provide both handle and password'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authentication › POST /auth/login with invalid credentials should show error', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: 'invalid.bsky.social', password: 'wrongpassword' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    t.is(res.status, 200);
    const text = await res.text();
    t.true(text.includes('Invalid credentials'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authentication › POST /auth/login with valid credentials should redirect and set cookie', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    t.is(res.status, 302);
    t.is(res.headers.get('location'), '/profile');

    const cookies = extractCookies(res);
    t.true(cookies.has('session'));

    const setCookieHeader = res.headers.getSetCookie().find(c => c.startsWith('session='));
    t.truthy(setCookieHeader);
    t.true(setCookieHeader!.includes('HttpOnly'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authentication › POST /auth/logout should clear cookie and redirect', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // First login
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    // Get CSRF token from profile page
    const profileRes = await app.request('/profile', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    const profileText = await profileRes.text();
    const csrfMatch = profileText.match(/name="_csrf" value="([^"]+)"/);
    const logoutCsrfToken = csrfMatch?.[1] || '';

    // Then logout with CSRF token
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      body: new URLSearchParams({ _csrf: logoutCsrfToken }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      redirect: 'manual'
    });

    t.is(logoutRes.status, 302);
    t.is(logoutRes.headers.get('location'), '/');
  } finally {
    await cleanupTestDb();
  }
});

// Authenticated Routes tests
test('Authenticated Routes › GET /profile should show user profile', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    const profileRes = await app.request('/profile', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    t.is(profileRes.status, 200);
    const text = await profileRes.text();
    t.true(text.includes(TEST_HANDLE!));
    t.true(text.includes('My Posts'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authenticated Routes › GET /create should show create post form', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    const createRes = await app.request('/create', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    t.is(createRes.status, 200);
    const text = await createRes.text();
    t.true(text.includes('Create New Post'));
    t.true(text.includes('_csrf'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authenticated Routes › POST /create without CSRF should fail', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    const createRes = await app.request('/create', {
      method: 'POST',
      body: new URLSearchParams({ title: 'Test', content: 'Test content' }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    t.is(createRes.status, 403);
    const text = await createRes.text();
    t.true(text.includes('CSRF'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authenticated Routes › POST /create with valid CSRF should work', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    // Get CSRF token from profile page
    const profileRes = await app.request('/profile', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    const profileText = await profileRes.text();
    const csrfMatch = profileText.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const createRes = await app.request('/create', {
      method: 'POST',
      body: new URLSearchParams({
        title: '[TEST] Route Test Post',
        content: 'Created via route test',
        _csrf: csrfToken
      }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      redirect: 'manual'
    });

    // Should redirect to the new post
    t.is(createRes.status, 302);
    t.regex(createRes.headers.get('location') || '', /^\/posts\//);
  } finally {
    await cleanupTestDb();
  }
});

test('Authenticated Routes › POST /create without title should show error', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    // Get CSRF token from profile page
    const profileRes = await app.request('/profile', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    const profileText = await profileRes.text();
    const csrfMatch = profileText.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const createRes = await app.request('/create', {
      method: 'POST',
      body: new URLSearchParams({
        content: 'Content without title',
        _csrf: csrfToken
      }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    t.is(createRes.status, 200);
    const text = await createRes.text();
    t.true(text.includes('Title and content are required'));
  } finally {
    await cleanupTestDb();
  }
});

test('Authenticated Routes › POST /refresh should index from PDS', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    // Get CSRF token from profile page
    const profileRes = await app.request('/profile', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    const profileText = await profileRes.text();
    const csrfMatch = profileText.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      body: new URLSearchParams({ _csrf: csrfToken }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      redirect: 'manual'
    });

    t.is(refreshRes.status, 302);
    t.true((refreshRes.headers.get('location') || '').includes('/profile?message='));
  } finally {
    await cleanupTestDb();
  }
});

test('Authenticated Routes › GET /user/:handle should show user posts', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    const userRes = await app.request(`/user/${TEST_HANDLE}`, {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    t.is(userRes.status, 200);
    const text = await userRes.text();
    t.true(text.includes(TEST_HANDLE!));
  } finally {
    await cleanupTestDb();
  }
});

// CSRF Protection tests
test('CSRF Protection › should reject POST to /create without CSRF token', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    const createRes = await app.request('/create', {
      method: 'POST',
      body: new URLSearchParams({ title: 'Test', content: 'Test' }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    t.is(createRes.status, 403);
  } finally {
    await cleanupTestDb();
  }
});

test('CSRF Protection › should reject POST with invalid CSRF token', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    const createRes = await app.request('/create', {
      method: 'POST',
      body: new URLSearchParams({ title: 'Test', content: 'Test', _csrf: 'invalid-token' }),
      headers: {
        'Cookie': `session=${sessionValue}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    t.is(createRes.status, 403);
  } finally {
    await cleanupTestDb();
  }
});

test('CSRF Protection › should accept CSRF token in header', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    // Login to get session
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ handle: TEST_HANDLE!, password: TEST_APP_PASSWORD! }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    const cookies = extractCookies(loginRes);
    const sessionValue = cookies.get('session');

    // Get a valid CSRF token
    const profileRes = await app.request('/profile', {
      headers: { 'Cookie': `session=${sessionValue}` }
    });

    const profileText = await profileRes.text();
    const csrfMatch = profileText.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const refreshRes = await app.request('/refresh', {
      method: 'POST',
      headers: {
        'Cookie': `session=${sessionValue}`,
        'X-CSRF-Token': csrfToken
      },
      redirect: 'manual'
    });

    // Should not be 403
    t.not(refreshRes.status, 403);
  } finally {
    await cleanupTestDb();
  }
});
