/**
 * HTTP Route Integration Tests
 *
 * Tests the Express routes with real ATProto credentials.
 * Uses supertest to make HTTP requests to the application.
 */

import test from 'ava';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../database/schema.js';

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

  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use('/auth', authRoutes);
  app.use('/', postsRoutes);

  // Home page
  app.get('/', (req, res) => {
    res.send(loginPage());
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

// Public Routes tests
test('Public Routes › GET / should return login page', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const app = await createTestApp();
  try {
    const res = await request(app).get('/');
    t.is(res.status, 200);
    t.true(res.text.includes('Login'));
    t.true(res.text.includes('Leaflet Blog'));
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
    const res = await request(app).get('/auth/login');
    t.is(res.status, 200);
    t.true(res.text.includes('Login'));
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
    const res = await request(app).get('/posts');
    t.is(res.status, 200);
    t.true(res.text.includes('All Posts'));
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
    const res = await request(app).get('/posts?page=1');
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
    const res = await request(app).get('/user/nonexistent.bsky.social');
    t.is(res.status, 404);
    t.true(res.text.includes('Not Found'));
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
    const res = await request(app).get('/posts/did:plc:fake/nonexistent');
    t.is(res.status, 404);
    t.true(res.text.includes('Not Found'));
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
    const res = await request(app).get('/profile');
    t.is(res.status, 302);
    t.is(res.headers.location, '/');
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
    const res = await request(app).get('/create');
    t.is(res.status, 302);
    t.is(res.headers.location, '/');
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
    const res = await request(app)
      .post('/create')
      .send({ title: 'Test', content: 'Content' });
    t.is(res.status, 302);
    t.is(res.headers.location, '/');
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
    const res = await request(app).post('/refresh');
    t.is(res.status, 302);
    t.is(res.headers.location, '/');
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
    const res = await request(app)
      .post('/auth/login')
      .send({});
    t.is(res.status, 200);
    t.true(res.text.includes('Please provide both handle and password'));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: 'invalid.bsky.social', password: 'wrongpassword' });
    t.is(res.status, 200);
    t.true(res.text.includes('Invalid credentials'));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    t.is(res.status, 302);
    t.is(res.headers.location, '/profile');
    t.truthy(res.headers['set-cookie']);

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const sessionCookie = cookies.find(c => c?.startsWith('session='));
    t.truthy(sessionCookie);
    t.true(sessionCookie!.includes('HttpOnly'));
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
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(loginRes.headers['set-cookie']) ? loginRes.headers['set-cookie'] : [loginRes.headers['set-cookie']]) as string[];
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    const sessionValue = sessionCookie!.split(';')[0].split('=')[1];

    // Get CSRF token from profile page
    const profileRes = await request(app)
      .get('/profile')
      .set('Cookie', [`session=${sessionValue}`]);

    const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
    const logoutCsrfToken = csrfMatch?.[1] || '';

    // Then logout with CSRF token
    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Cookie', [`session=${sessionValue}`])
      .send({ _csrf: logoutCsrfToken });

    t.is(logoutRes.status, 302);
    t.is(logoutRes.headers.location, '/');
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    const profileRes = await request(app)
      .get('/profile')
      .set('Cookie', [sessionCookie]);

    t.is(profileRes.status, 200);
    t.true(profileRes.text.includes(TEST_HANDLE!));
    t.true(profileRes.text.includes('My Posts'));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    const createRes = await request(app)
      .get('/create')
      .set('Cookie', [sessionCookie]);

    t.is(createRes.status, 200);
    t.true(createRes.text.includes('Create New Post'));
    t.true(createRes.text.includes('_csrf'));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    const createRes = await request(app)
      .post('/create')
      .set('Cookie', [sessionCookie])
      .send({ title: 'Test', content: 'Test content' });

    t.is(createRes.status, 403);
    t.true(createRes.text.includes('CSRF'));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    // Get CSRF token from profile page
    const profileRes = await request(app)
      .get('/profile')
      .set('Cookie', [sessionCookie]);

    const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const createRes = await request(app)
      .post('/create')
      .set('Cookie', [sessionCookie])
      .send({
        title: '[TEST] Route Test Post',
        content: 'Created via route test',
        _csrf: csrfToken
      });

    // Should redirect to the new post
    t.is(createRes.status, 302);
    t.regex(createRes.headers.location, /^\/posts\//);
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    // Get CSRF token from profile page
    const profileRes = await request(app)
      .get('/profile')
      .set('Cookie', [sessionCookie]);

    const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const createRes = await request(app)
      .post('/create')
      .set('Cookie', [sessionCookie])
      .send({
        content: 'Content without title',
        _csrf: csrfToken
      });

    t.is(createRes.status, 200);
    t.true(createRes.text.includes('Title and content are required'));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    // Get CSRF token from profile page
    const profileRes = await request(app)
      .get('/profile')
      .set('Cookie', [sessionCookie]);

    const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const refreshRes = await request(app)
      .post('/refresh')
      .set('Cookie', [sessionCookie])
      .send({ _csrf: csrfToken });

    t.is(refreshRes.status, 302);
    t.true(refreshRes.headers.location.includes('/profile?message='));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    const userRes = await request(app)
      .get(`/user/${TEST_HANDLE}`)
      .set('Cookie', [sessionCookie]);

    t.is(userRes.status, 200);
    t.true(userRes.text.includes(TEST_HANDLE!));
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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    const createRes = await request(app)
      .post('/create')
      .set('Cookie', [sessionCookie])
      .send({ title: 'Test', content: 'Test' });

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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    const createRes = await request(app)
      .post('/create')
      .set('Cookie', [sessionCookie])
      .send({ title: 'Test', content: 'Test', _csrf: 'invalid-token' });

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
    const res = await request(app)
      .post('/auth/login')
      .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

    const cookies = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]) as string[];
    const cookie = cookies.find(c => c.startsWith('session='));
    const sessionCookie = cookie!.split(';')[0];

    // Get a valid CSRF token
    const profileRes = await request(app)
      .get('/profile')
      .set('Cookie', [sessionCookie]);

    const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch?.[1] || '';

    const refreshRes = await request(app)
      .post('/refresh')
      .set('Cookie', [sessionCookie])
      .set('X-CSRF-Token', csrfToken);

    // Should not be 403
    t.not(refreshRes.status, 403);
  } finally {
    await cleanupTestDb();
  }
});
