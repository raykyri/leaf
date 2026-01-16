import { useState, useEffect, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import styles from './EditPostPage.module.css';

export function EditPostPage() {
  const { did, rkey } = useParams<{ did: string; rkey: string }>();
  const { user, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(did!)}/${encodeURIComponent(rkey!)}`);
        if (response.ok) {
          const data = await response.json();
          setTitle(data.post.title);
          setDescription(data.post.description || '');
          setContent(data.plainTextContent || '');
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
  }, [did, rkey, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(did!)}/${encodeURIComponent(rkey!)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ title, description, content }),
      });

      if (response.ok) {
        navigate(`/posts/${encodeURIComponent(did!)}/${encodeURIComponent(rkey!)}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update post');
      }
    } catch (err) {
      setError('Failed to update post');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <Layout>
        <div className={styles.loading}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Card>
        <CardTitle>Edit Post</CardTitle>
        <CardContent>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={280}
              required
            />
            <Input
              label="Description (optional)"
              placeholder="A brief summary of your post"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
            <Textarea
              label="Content"
              placeholder={`Write your post content here...\n\nSeparate paragraphs with blank lines.`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <div className={styles.actions}>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Updating...' : 'Update Post'}
              </Button>
              <Link to={`/posts/${encodeURIComponent(did!)}/${encodeURIComponent(rkey!)}`} className={styles.cancelBtn}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
