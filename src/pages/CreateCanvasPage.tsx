import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import styles from './CreateCanvasPage.module.css';

export function CreateCanvasPage() {
  const { user, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
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
      const response = await fetch('/api/canvases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ title }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/canvases/${data.id}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create canvas');
      }
    } catch (err) {
      setError('Failed to create canvas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <Card>
        <CardTitle>Create New Canvas</CardTitle>
        <CardContent>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Title"
              placeholder="My Canvas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={128}
              required
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Canvas'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
