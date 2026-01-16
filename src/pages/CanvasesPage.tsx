import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import styles from './CanvasesPage.module.css';

interface Canvas {
  id: string;
  title: string;
  width: number;
  height: number;
  updated_at: string;
}

export function CanvasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchCanvases = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/canvases?page=${page}`);
        if (response.ok) {
          const data = await response.json();
          setCanvases(data.canvases);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        console.error('Failed to fetch canvases:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvases();
  }, [user, page, navigate]);

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
  };

  if (!user) return null;

  return (
    <Layout>
      <div className={styles.header}>
        <h1>My Canvases</h1>
        <Button asChild variant="secondary" size="sm">
          <Link to="/canvases/new">New Canvas</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className={styles.emptyState}>Loading...</div>
      ) : canvases.length === 0 ? (
        <div className={styles.emptyState}>
          <p>You haven't created any canvases yet. <Link to="/canvases/new">Create your first canvas!</Link></p>
        </div>
      ) : (
        <>
          <div className={styles.canvasList}>
            {canvases.map((canvas) => (
              <Card key={canvas.id} variant="interactive" className={styles.canvasCard}>
                <h2 className={styles.canvasTitle}>
                  <Link to={`/canvases/${canvas.id}`}>{canvas.title}</Link>
                </h2>
                <div className={styles.canvasMeta}>
                  {formatDate(canvas.updated_at)} &bull; {canvas.width}x{canvas.height}
                </div>
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
