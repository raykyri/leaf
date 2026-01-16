import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import styles from './CreatePostPage.module.css';

export function CreatePostPage() {
  const { user, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ title, description, content }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/posts/${encodeURIComponent(data.author)}/${encodeURIComponent(data.rkey)}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create post');
      }
    } catch (err) {
      setError('Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <Card>
        <CardTitle>Create New Post</CardTitle>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Publishing...' : 'Publish Post'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
