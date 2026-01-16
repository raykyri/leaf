// Message components using Radix UI
import React from 'react';
import { Callout } from '@radix-ui/themes';
import { CrossCircledIcon, CheckCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { escapeHtml } from '../../utils/html.ts';

interface MessageProps {
  message: string;
}

export function ErrorMessage({ message }: MessageProps): React.ReactElement {
  return (
    <Callout.Root color="red" mb="4" size="1">
      <Callout.Icon>
        <CrossCircledIcon />
      </Callout.Icon>
      <Callout.Text className="sans">{escapeHtml(message)}</Callout.Text>
    </Callout.Root>
  );
}

export function SuccessMessage({ message }: MessageProps): React.ReactElement {
  return (
    <Callout.Root color="green" mb="4" size="1">
      <Callout.Icon>
        <CheckCircledIcon />
      </Callout.Icon>
      <Callout.Text className="sans">{escapeHtml(message)}</Callout.Text>
    </Callout.Root>
  );
}

export function InfoMessage({ message }: MessageProps): React.ReactElement {
  return (
    <Callout.Root color="blue" mb="4" size="1">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>
      <Callout.Text className="sans">{escapeHtml(message)}</Callout.Text>
    </Callout.Root>
  );
}
