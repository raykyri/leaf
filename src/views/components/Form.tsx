// Form components using Radix UI
import React, { type ReactNode } from 'react';
import { Box, Text, TextField, TextArea, Button, Flex, Link } from '@radix-ui/themes';
import { escapeHtml } from '../../utils/html.ts';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'password';
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  defaultValue?: string;
  hint?: ReactNode;
}

export function FormField({ label, name, type = 'text', required, placeholder, maxLength, defaultValue, hint }: FormFieldProps): React.ReactElement {
  return (
    <Box mb="4">
      <Text as="label" htmlFor={name} size="2" weight="medium" className="sans" style={{ display: 'block', marginBottom: '0.5rem' }}>
        {label}
      </Text>
      <TextField.Root
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue ? escapeHtml(defaultValue) : undefined}
        size="2"
      />
      {hint && (
        <Text as="p" size="1" color="gray" mt="1" className="sans">
          {hint}
        </Text>
      )}
    </Box>
  );
}

interface TextAreaFieldProps {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export function TextAreaField({ label, name, required, placeholder, defaultValue }: TextAreaFieldProps): React.ReactElement {
  return (
    <Box mb="4">
      <Text as="label" htmlFor={name} size="2" weight="medium" className="sans" style={{ display: 'block', marginBottom: '0.5rem' }}>
        {label}
      </Text>
      <TextArea
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ? escapeHtml(defaultValue) : undefined}
        size="2"
        style={{ minHeight: '220px' }}
      />
    </Box>
  );
}

interface SubmitButtonProps {
  children: ReactNode;
  variant?: 'solid' | 'outline';
  color?: 'orange' | 'red' | 'gray';
}

export function SubmitButton({ children, variant = 'solid', color }: SubmitButtonProps): React.ReactElement {
  return (
    <Button type="submit" size="2" variant={variant} color={color} highContrast>
      {children}
    </Button>
  );
}

interface FormActionsProps {
  children: ReactNode;
  cancelHref?: string;
}

export function FormActions({ children, cancelHref }: FormActionsProps): React.ReactElement {
  return (
    <Flex gap="4" align="center">
      {children}
      {cancelHref && (
        <Link href={cancelHref} size="2" color="gray">Cancel</Link>
      )}
    </Flex>
  );
}

interface CsrfInputProps {
  token: string;
}

export function CsrfInput({ token }: CsrfInputProps): React.ReactElement {
  return <input type="hidden" name="_csrf" value={escapeHtml(token)} />;
}
