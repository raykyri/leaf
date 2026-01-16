import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <Layout>
      <div className={styles.container}>
        <h1>404 - Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <p>
          <Link to="/posts">Go to all posts</Link>
        </p>
      </div>
    </Layout>
  );
}
