import React from 'react';
// Canvas list page component using Radix UI
import { Heading, Flex, Button, Link } from '@radix-ui/themes';
import { Layout, CanvasCard, Pagination, EmptyState } from '../components/index.ts';
import type { Canvas } from '../../database/index.ts';

interface CanvasListPageProps {
  canvases: Canvas[];
  page: number;
  hasMore: boolean;
  user: { handle: string; csrfToken?: string };
}

export function CanvasListPage({ canvases, page, hasMore, user }: CanvasListPageProps): React.ReactElement {
  return (
    <Layout title="My Canvases" user={user}>
      <Flex justify="between" align="center" mb="5">
        <Heading size="7" className="serif">My Canvases</Heading>
        <Button asChild variant="outline" size="2">
          <a href="/canvases/new">New Canvas</a>
        </Button>
      </Flex>

      {canvases.length === 0 ? (
        <EmptyState>
          You haven't created any canvases yet. <Link href="/canvases/new">Create your first canvas!</Link>
        </EmptyState>
      ) : (
        <>
          {canvases.map((canvas) => (
            <CanvasCard
              key={canvas.id}
              id={canvas.id}
              title={canvas.title}
              updatedAt={canvas.updated_at}
              width={canvas.width}
              height={canvas.height}
            />
          ))}
          <Pagination page={page} hasMore={hasMore} baseUrl="/canvases" />
        </>
      )}
    </Layout>
  );
}
