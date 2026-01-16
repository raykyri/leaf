import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import styles from './ProfilePage.module.css';

interface Post {
  author: string;
  rkey: string;
  title: string;
  description?: string;
  published_at?: string;
}

export function ProfilePage() {
  const { user, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/profile/posts?page=${page}`);
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [user, page, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      });
      if (response.ok) {
        setMessage('Posts refreshed from PDS');
        // Refetch posts
        const postsResponse = await fetch(`/api/profile/posts?page=${page}`);
        if (postsResponse.ok) {
          const data = await postsResponse.json();
          setPosts(data.posts);
          setHasMore(data.hasMore);
        }
      }
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
  };

  if (!user) return null;

  return (
    <Layout>
      <h1 className={styles.title}>My Posts</h1>
      <p className={styles.handle}>@{user.handle}</p>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing...' : 'Refresh from PDS'}
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/profile/edit">Edit Profile</Link>
        </Button>
      </div>

      {message && <div className={styles.success}>{message}</div>}

      {isLoading ? (
        <div className={styles.emptyState}>Loading...</div>
      ) : posts.length === 0 ? (
        <div className={styles.emptyState}>
          <p>You haven't created any posts yet. <Link to="/create">Create your first post!</Link></p>
        </div>
      ) : (
        <>
          <div className={styles.postList}>
            {posts.map((post) => (
              <Card key={`${post.author}-${post.rkey}`} variant="interactive" className={styles.postCard}>
                <h2 className={styles.postTitle}>
                  <Link to={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}>
                    {post.title}
                  </Link>
                </h2>
                <div className={styles.postMeta}>
                  {post.published_at && formatDate(post.published_at)}
                  <a
                    href={`https://leaflet.pub/p/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.externalLink}
                  >
                    leaflet.pub
                  </a>
                </div>
                {post.description && <p className={styles.postExcerpt}>{post.description}</p>}
              </Card>
            ))}
          </div>

          <div className={styles.pagination}>
            {page > 1 && (
              <button onClick={() => handlePageChange(page - 1)} className={styles.pageBtn}>
                &larr; Previous
              </button>
            )}
            {hasMore && (
              <button onClick={() => handlePageChange(page + 1)} className={styles.pageBtn}>
                Next &rarr;
              </button>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
