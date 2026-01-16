import { forwardRef, type TextareaHTMLAttributes } from 'react';
import * as Label from '@radix-ui/react-label';
import { cn } from '@/lib/utils';
import styles from './Textarea.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={styles.wrapper}>
        {label && (
          <Label.Root className={styles.label} htmlFor={textareaId}>
            {label}
          </Label.Root>
        )}
        <textarea
          id={textareaId}
          className={cn(styles.textarea, error && styles.error, className)}
          ref={ref}
          {...props}
        />
        {hint && !error && <p className={styles.hint}>{hint}</p>}
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
