import { createContext, useContext } from 'react';

export interface FieldAriaContextValue {
  htmlFor: string;
  hasHint: boolean;
  hasError: boolean;
}

export const FieldAriaContext = createContext<FieldAriaContextValue | null>(
  null,
);

export function useFieldAria(): FieldAriaContextValue | null {
  return useContext(FieldAriaContext);
}

export interface ComposeDescribedByOptions {
  id?: string;
  invalid?: boolean;
  hasHint?: boolean;
  hasError?: boolean;
  describedBy?: string;
}

export function composeDescribedBy({
  id,
  invalid = false,
  hasHint = false,
  hasError = false,
  describedBy,
}: ComposeDescribedByOptions): string | undefined {
  const ids = new Set<string>();

  const add = (value?: string) => {
    if (!value) {
      return;
    }
    for (const token of value.split(/\s+/)) {
      if (token) {
        ids.add(token);
      }
    }
  };

  add(describedBy);
  if (id && hasHint) {
    add(`${id}-hint`);
  }
  if (id && invalid && hasError) {
    add(`${id}-error`);
  }

  return ids.size > 0 ? Array.from(ids).join(' ') : undefined;
}

export interface FieldDescribedByOptions {
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}

export function useFieldDescribedBy({
  id,
  invalid,
  describedBy,
}: FieldDescribedByOptions): string | undefined {
  const field = useFieldAria();

  const hasHint =
    field != null && id != null && id === field.htmlFor && field.hasHint;
  const hasError =
    field != null && id != null && id === field.htmlFor && field.hasError;

  return composeDescribedBy({
    id,
    invalid,
    hasHint,
    hasError,
    describedBy,
  });
}
