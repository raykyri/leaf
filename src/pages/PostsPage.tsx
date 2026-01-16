import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import styles from './PostsPage.module.css';

interface Post {
  author: string;
  rkey: string;
  title: string;
  description?: string;
  published_at?: string;
  handle: string;
  display_name?: string;
  canvas_width?: number;
  canvas_height?: number;
}

export function PostsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/posts?page=${page}`);
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
  }, [page]);

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
  };

  return (
    <Layout>
      <h1 className={styles.title}>All Posts</h1>

      {isLoading ? (
        <div className={styles.emptyState}>Loading...</div>
      ) : posts.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No posts yet. Be the first to create one!</p>
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
                  by <Link to={`/user/${encodeURIComponent(post.handle)}`}>{post.display_name || post.handle}</Link>
                  {post.published_at && ` • ${formatDate(post.published_at)}`}
                  {post.canvas_width && post.canvas_height && ` • ${post.canvas_width}x${post.canvas_height}`}
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
