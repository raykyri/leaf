/**
 * HTTP Route Integration Tests
 *
 * Tests the Express routes with real ATProto credentials.
 * Uses supertest to make HTTP requests to the application.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../database/schema.js';

// Test configuration
const TEST_HANDLE = process.env.TEST_HANDLE;
const TEST_APP_PASSWORD = process.env.TEST_APP_PASSWORD;
const TEST_DB_PATH = './data/test-routes.db';

const hasCredentials = TEST_HANDLE && TEST_APP_PASSWORD;

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

describe.skipIf(!hasCredentials)('HTTP Routes Integration', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    // Clean up test database
    const { closeDatabase } = await import('../database/index.js');
    closeDatabase();

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Public Routes', () => {
    it('GET / should return login page', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Login');
      expect(res.text).toContain('Leaflet Blog');
    });

    it('GET /auth/login should return login page', async () => {
      const res = await request(app).get('/auth/login');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Login');
    });

    it('GET /posts should return empty posts list', async () => {
      const res = await request(app).get('/posts');
      expect(res.status).toBe(200);
      expect(res.text).toContain('All Posts');
    });

    it('GET /posts with pagination should work', async () => {
      const res = await request(app).get('/posts?page=1');
      expect(res.status).toBe(200);
    });

    it('GET /user/:handle for nonexistent user should return 404', async () => {
      const res = await request(app).get('/user/nonexistent.bsky.social');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Not Found');
    });

    it('GET /posts/:did/:rkey for nonexistent post should return 404', async () => {
      const res = await request(app).get('/posts/did:plc:fake/nonexistent');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Not Found');
    });
  });

  describe('Protected Routes (Unauthenticated)', () => {
    it('GET /profile should redirect to home', async () => {
      const res = await request(app).get('/profile');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
    });

    it('GET /create should redirect to home', async () => {
      const res = await request(app).get('/create');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
    });

    it('POST /create should redirect to home', async () => {
      const res = await request(app)
        .post('/create')
        .send({ title: 'Test', content: 'Content' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
    });

    it('POST /refresh should redirect to home', async () => {
      const res = await request(app).post('/refresh');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
    });
  });

  describe('Authentication', () => {
    it('POST /auth/login with missing credentials should show error', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});
      expect(res.status).toBe(200);
      expect(res.text).toContain('Please provide both handle and password');
    });

    it('POST /auth/login with invalid credentials should show error', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ handle: 'invalid.bsky.social', password: 'wrongpassword' });
      expect(res.status).toBe(200);
      expect(res.text).toContain('Invalid credentials');
    });

    it('POST /auth/login with valid credentials should redirect and set cookie', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/profile');
      expect(res.headers['set-cookie']).toBeDefined();

      const cookies = res.headers['set-cookie'] as string[];
      const sessionCookie = cookies.find(c => c.startsWith('session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('POST /auth/logout should clear cookie and redirect', async () => {
      // First login
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

      const cookies = loginRes.headers['set-cookie'] as string[];
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

      expect(logoutRes.status).toBe(302);
      expect(logoutRes.headers.location).toBe('/');
    });
  });

  describe('Authenticated Routes', () => {
    let sessionCookie: string;
    let csrfToken: string;

    beforeAll(async () => {
      // Login to get session
      const res = await request(app)
        .post('/auth/login')
        .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

      const cookies = res.headers['set-cookie'] as string[];
      const cookie = cookies.find(c => c.startsWith('session='));
      sessionCookie = cookie!.split(';')[0];

      // Get CSRF token from profile page
      const profileRes = await request(app)
        .get('/profile')
        .set('Cookie', [sessionCookie]);

      // Extract CSRF token from form
      const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
      csrfToken = csrfMatch?.[1] || '';
    });

    it('GET /profile should show user profile', async () => {
      const res = await request(app)
        .get('/profile')
        .set('Cookie', [sessionCookie]);

      expect(res.status).toBe(200);
      expect(res.text).toContain(TEST_HANDLE!);
      expect(res.text).toContain('My Posts');
    });

    it('GET /create should show create post form', async () => {
      const res = await request(app)
        .get('/create')
        .set('Cookie', [sessionCookie]);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Create New Post');
      expect(res.text).toContain('_csrf');
    });

    it('POST /create without CSRF should fail', async () => {
      const res = await request(app)
        .post('/create')
        .set('Cookie', [sessionCookie])
        .send({ title: 'Test', content: 'Test content' });

      expect(res.status).toBe(403);
      expect(res.text).toContain('CSRF');
    });

    it('POST /create with valid CSRF should work', async () => {
      const res = await request(app)
        .post('/create')
        .set('Cookie', [sessionCookie])
        .send({
          title: '[TEST] Route Test Post',
          content: 'Created via route test',
          _csrf: csrfToken
        });

      // Should redirect to the new post
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/posts\//);
    });

    it('POST /create without title should show error', async () => {
      const res = await request(app)
        .post('/create')
        .set('Cookie', [sessionCookie])
        .send({
          content: 'Content without title',
          _csrf: csrfToken
        });

      expect(res.status).toBe(200);
      expect(res.text).toContain('Title and content are required');
    });

    it('POST /refresh should index from PDS', async () => {
      const res = await request(app)
        .post('/refresh')
        .set('Cookie', [sessionCookie])
        .send({ _csrf: csrfToken });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/profile?message=');
    });

    it('GET /user/:handle should show user posts', async () => {
      const res = await request(app)
        .get(`/user/${TEST_HANDLE}`)
        .set('Cookie', [sessionCookie]);

      expect(res.status).toBe(200);
      expect(res.text).toContain(TEST_HANDLE);
    });
  });

  describe('CSRF Protection', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ handle: TEST_HANDLE, password: TEST_APP_PASSWORD });

      const cookies = res.headers['set-cookie'] as string[];
      const cookie = cookies.find(c => c.startsWith('session='));
      sessionCookie = cookie!.split(';')[0];
    });

    it('should reject POST to /create without CSRF token', async () => {
      const res = await request(app)
        .post('/create')
        .set('Cookie', [sessionCookie])
        .send({ title: 'Test', content: 'Test' });

      expect(res.status).toBe(403);
    });

    it('should reject POST with invalid CSRF token', async () => {
      const res = await request(app)
        .post('/create')
        .set('Cookie', [sessionCookie])
        .send({ title: 'Test', content: 'Test', _csrf: 'invalid-token' });

      expect(res.status).toBe(403);
    });

    it('should accept CSRF token in header', async () => {
      // Get a valid CSRF token
      const profileRes = await request(app)
        .get('/profile')
        .set('Cookie', [sessionCookie]);

      const csrfMatch = profileRes.text.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch?.[1] || '';

      const res = await request(app)
        .post('/refresh')
        .set('Cookie', [sessionCookie])
        .set('X-CSRF-Token', csrfToken);

      // Should not be 403
      expect(res.status).not.toBe(403);
    });
  });
});

// Log skip reason if credentials not provided
if (!hasCredentials) {
  console.log('Skipping HTTP route integration tests: TEST_HANDLE and TEST_APP_PASSWORD not set');
}
