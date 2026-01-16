import { forwardRef, type InputHTMLAttributes } from 'react';
import * as Label from '@radix-ui/react-label';
import { cn } from '@/lib/utils';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={styles.wrapper}>
        {label && (
          <Label.Root className={styles.label} htmlFor={inputId}>
            {label}
          </Label.Root>
        )}
        <input
          id={inputId}
          className={cn(styles.input, error && styles.error, className)}
          ref={ref}
          {...props}
        />
        {hint && !error && <p className={styles.hint}>{hint}</p>}
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
