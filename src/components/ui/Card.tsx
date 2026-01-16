import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        className={cn(styles.card, styles[variant], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div className={cn(styles.header, className)} ref={ref} {...props} />;
  }
);

CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return <h2 className={cn(styles.title, className)} ref={ref} {...props} />;
  }
);

CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div className={cn(styles.content, className)} ref={ref} {...props} />;
  }
);

CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
