// Pagination component using Radix UI
import React from 'react';
import { Flex, Button } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

interface PaginationProps {
  page: number;
  hasMore: boolean;
  baseUrl: string;
}

export function Pagination({ page, hasMore, baseUrl }: PaginationProps): React.ReactElement | null {
  if (page <= 1 && !hasMore) return null;

  const separator = baseUrl.includes('?') ? '&' : '?';

  return (
    <Flex gap="2" justify="center" mt="6" className="sans">
      {page > 1 && (
        <Button asChild variant="outline" size="2">
          <a href={`${baseUrl}${separator}page=${page - 1}`}>
            <ChevronLeftIcon /> Previous
          </a>
        </Button>
      )}
      {hasMore && (
        <Button asChild variant="outline" size="2">
          <a href={`${baseUrl}${separator}page=${page + 1}`}>
            Next <ChevronRightIcon />
          </a>
        </Button>
      )}
    </Flex>
  );
}
