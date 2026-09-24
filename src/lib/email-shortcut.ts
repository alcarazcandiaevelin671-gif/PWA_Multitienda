import type { KeyboardEvent } from 'react';

export function getEmailShortcutValue(
  _event: KeyboardEvent<HTMLInputElement>,
  value: string,
): string | null {
  return value;
}
