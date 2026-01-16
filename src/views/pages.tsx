// Page rendering functions using React SSR with Radix UI
// This file maintains backward compatibility with the existing routes

import { renderPage } from './render.tsx';
import {
  LoginPage,
  PostsListPage,
  PostPage,
  UserPostsPage,
  ProfilePage,
  EditProfilePage,
  CreatePostPage,
  EditPostPage,
  NotFoundPage,
  ErrorPage,
  CanvasListPage,
  CreateCanvasPage,
  CanvasEditorPage
} from './pages/index.ts';
import type { Document, User, Canvas } from '../database/index.ts';

export function loginPage(error?: string): string {
  return renderPage(<LoginPage error={error} />);
}

export function postsListPage(
  posts: (Document & { handle: string; display_name: string | null })[],
  page: number,
  hasMore: boolean,
  user?: { handle: string; csrfToken?: string }
): string {
  return renderPage(<PostsListPage posts={posts} page={page} hasMore={hasMore} user={user} />);
}

export function postPage(
  post: Document,
  author: { handle: string; display_name: string | null; did?: string },
  user?: { handle: string; csrfToken?: string },
  isOwner?: boolean
): string {
  return renderPage(<PostPage post={post} author={author} user={user} isOwner={isOwner} />);
}

export function userPostsPage(
  author: User,
  posts: Document[],
  page: number,
  hasMore: boolean,
  currentUser?: { handle: string; csrfToken?: string }
): string {
  return renderPage(<UserPostsPage author={author} posts={posts} page={page} hasMore={hasMore} currentUser={currentUser} />);
}

export function profilePage(
  user: User,
  posts: Document[],
  page: number,
  hasMore: boolean,
  csrfToken: string,
  message?: string
): string {
  return renderPage(<ProfilePage user={user} posts={posts} page={page} hasMore={hasMore} csrfToken={csrfToken} message={message} />);
}

export function editProfilePage(
  user: User,
  csrfToken: string,
  message?: string,
  error?: string
): string {
  return renderPage(<EditProfilePage user={user} csrfToken={csrfToken} message={message} error={error} />);
}

export function createPostPage(user: { handle: string }, csrfToken: string, error?: string): string {
  return renderPage(<CreatePostPage user={user} csrfToken={csrfToken} error={error} />);
}

export function editPostPage(
  post: Document,
  user: { handle: string; csrfToken?: string },
  error?: string
): string {
  return renderPage(<EditPostPage post={post} user={user} error={error} />);
}

export function notFoundPage(user?: { handle: string; csrfToken?: string }): string {
  return renderPage(<NotFoundPage user={user} />);
}

export function errorPage(user?: { handle: string; csrfToken?: string }, message?: string): string {
  return renderPage(<ErrorPage user={user} message={message} />);
}

// Canvas pages
export function canvasListPage(
  canvases: Canvas[],
  page: number,
  hasMore: boolean,
  user: { handle: string; csrfToken?: string }
): string {
  return renderPage(<CanvasListPage canvases={canvases} page={page} hasMore={hasMore} user={user} />);
}

export function createCanvasPage(
  user: { handle: string; csrfToken?: string },
  error?: string
): string {
  return renderPage(<CreateCanvasPage user={user} error={error} />);
}

export function canvasEditorPage(
  canvas: Canvas,
  user: { handle: string; csrfToken?: string }
): string {
  return renderPage(<CanvasEditorPage canvas={canvas} user={user} />);
}
