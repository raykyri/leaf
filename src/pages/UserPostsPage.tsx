import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import styles from './UserPostsPage.module.css';

interface User {
  handle: string;
  display_name?: string;
}

interface Post {
  author: string;
  rkey: string;
  title: string;
  description?: string;
  published_at?: string;
}

export function UserPostsPage() {
  const { handle } = useParams<{ handle: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserPosts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/users/${encodeURIComponent(handle!)}/posts?page=${page}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setPosts(data.posts);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        console.error('Failed to fetch user posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (handle) {
      fetchUserPosts();
    }
  }, [handle, page]);

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
  };

  return (
    <Layout>
      {isLoading ? (
        <div className={styles.emptyState}>Loading...</div>
      ) : user ? (
        <>
          <h1 className={styles.title}>{user.display_name || user.handle}</h1>
          <p className={styles.handle}>@{user.handle}</p>

          {posts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No posts from this user yet.</p>
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
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>User not found.</p>
        </div>
      )}
    </Layout>
  );
}
