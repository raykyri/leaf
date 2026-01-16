import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';

// Pages
import { LoginPage } from './pages/LoginPage';
import { PostsPage } from './pages/PostsPage';
import { PostPage } from './pages/PostPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CreatePostPage } from './pages/CreatePostPage';
import { EditPostPage } from './pages/EditPostPage';
import { UserPostsPage } from './pages/UserPostsPage';
import { CanvasesPage } from './pages/CanvasesPage';
import { CanvasEditorPage } from './pages/CanvasEditorPage';
import { CreateCanvasPage } from './pages/CreateCanvasPage';
import { NotFoundPage } from './pages/NotFoundPage';

function LoadingSpinner() {
  return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    </Layout>
  );
}

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/posts" element={<PostsPage />} />
      <Route path="/posts/:did/:rkey" element={<PostPage />} />
      <Route path="/posts/:did/:rkey/edit" element={<EditPostPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/edit" element={<EditProfilePage />} />
      <Route path="/create" element={<CreatePostPage />} />
      <Route path="/user/:handle" element={<UserPostsPage />} />
      <Route path="/canvases" element={<CanvasesPage />} />
      <Route path="/canvases/new" element={<CreateCanvasPage />} />
      <Route path="/canvases/:id" element={<CanvasEditorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
