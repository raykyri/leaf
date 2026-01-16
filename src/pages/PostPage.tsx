import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { CanvasRenderer } from '@/components/CanvasRenderer';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import styles from './PostPage.module.css';

interface Post {
  author: string;
  rkey: string;
  title: string;
  description?: string;
  content: string;
  published_at?: string;
}

interface Author {
  handle: string;
  display_name?: string;
  did: string;
}

interface CanvasBlock {
  block?: {
    $type?: string;
    plaintext?: string;
  };
  x: number;
  y: number;
  width: number;
  height?: number;
}

interface CanvasData {
  blocks: CanvasBlock[];
  width: number;
  height: number;
}

export function PostPage() {
  const { did, rkey } = useParams<{ did: string; rkey: string }>();
  const { user, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [renderedContent, setRenderedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCanvasPost, setIsCanvasPost] = useState(false);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);

  const isOwner = user && author && user.did === author.did;

  useEffect(() => {
    const fetchPost = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(did!)}/${encodeURIComponent(rkey!)}`);
        if (response.ok) {
          const data = await response.json();
          setPost(data.post);
          setAuthor(data.author);
          setRenderedContent(data.renderedContent);
          setIsCanvasPost(data.isCanvasPost || false);
          setCanvasId(data.canvasId || null);
          setCanvasData(data.canvasData || null);
        } else {
          navigate('/404');
        }
      } catch (err) {
        console.error('Failed to fetch post:', err);
        navigate('/404');
      } finally {
        setIsLoading(false);
      }
    };

    if (did && rkey) {
      fetchPost();
    }
  }, [did, rkey, navigate]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(did!)}/${encodeURIComponent(rkey!)}`,
        {
          method: 'DELETE',
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
        }
      );

      if (response.ok) {
        navigate('/profile');
      } else {
        alert('Failed to delete post');
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className={styles.loading}>Loading...</div>
      </Layout>
    );
  }

  if (!post || !author) {
    return (
      <Layout>
        <div className={styles.notFound}>Post not found</div>
      </Layout>
    );
  }

  // Determine the edit link based on whether this is a canvas post
  const getEditLink = () => {
    if (isCanvasPost && canvasId) {
      return `/canvases/${canvasId}`;
    }
    return `/posts/${encodeURIComponent(post!.author)}/${encodeURIComponent(post!.rkey)}/edit`;
  };

  return (
    <Layout fullWidth={isCanvasPost}>
      <article className={isCanvasPost ? styles.canvasArticle : undefined}>
        <header className={styles.header}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            by <Link to={`/user/${encodeURIComponent(author.handle)}`}>{author.display_name || author.handle}</Link>
            {post.published_at && ` • ${formatDate(post.published_at)}`}
          </div>
          {post.description && <p className={styles.description}>{post.description}</p>}
        </header>

        {isCanvasPost && canvasData ? (
          <CanvasRenderer
            blocks={canvasData.blocks}
            width={canvasData.width}
            height={canvasData.height}
          />
        ) : (
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        )}
      </article>

      <div className={styles.actions}>
        <Link to="/posts">&larr; Back to all posts</Link>
        <a
          href={`https://leaflet.pub/p/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalLink}
        >
          View on leaflet.pub
        </a>
        {isOwner && (
          <>
            {(isCanvasPost ? canvasId : true) && (
              <Button asChild variant="secondary" size="sm">
                <Link to={getEditLink()}>
                  {isCanvasPost ? 'Edit Canvas' : 'Edit Post'}
                </Link>
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Post'}
            </Button>
          </>
        )}
      </div>
    </Layout>
  );
}
