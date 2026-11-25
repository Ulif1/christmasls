import React, {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Button from '../Button/Button';
import Field from '../Field/Field';
import Input from '../Input/Input';
import Dialog from './Dialog';

export interface ConfirmDialogOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export interface PromptDialogOptions {
  title: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  validate?: (value: string) => string | null;
}

interface BaseRequest {
  id: number;
  settled: boolean;
  returnFocus: HTMLElement | null;
}

interface ConfirmRequest extends BaseRequest {
  kind: 'confirm';
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
}

interface PromptRequest extends BaseRequest {
  kind: 'prompt';
  options: PromptDialogOptions;
  resolve: (value: string | null) => void;
}

type DialogRequest = ConfirmRequest | PromptRequest;

const listeners = new Set<() => void>();
const queue: DialogRequest[] = [];
let current: DialogRequest | null = null;
let nextId = 1;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DialogRequest | null {
  return current;
}

function notify(): void {
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

function activateNext(): void {
  if (current || queue.length === 0) {
    return;
  }
  const next = queue.shift();
  if (!next) {
    return;
  }
  next.returnFocus = getActiveElement();
  current = next;
  notify();
}

function enqueue(request: DialogRequest): void {
  queue.push(request);
  if (!current) {
    activateNext();
  }
}

function getActiveElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

function restoreFocus(target: HTMLElement | null): void {
  const element = target && target.isConnected ? target : document.body;
  element.focus();
}

function finish(
  request: DialogRequest,
  value: boolean | string | null,
): void {
  if (request.settled) {
    return;
  }
  request.settled = true;

  const wasCurrent = current === request;
  if (wasCurrent) {
    current = null;
  } else {
    const index = queue.indexOf(request);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  if (wasCurrent) {
    notify();
  }

  if (request.kind === 'confirm') {
    request.resolve(typeof value === 'boolean' ? value : false);
  } else {
    request.resolve(typeof value === 'string' ? value : null);
  }

  if (wasCurrent) {
    window.setTimeout(() => {
      if (!current) {
        restoreFocus(request.returnFocus);
      }
      activateNext();
    }, 0);
  }
}

function cancelAll(): void {
  const pending = current ? [current, ...queue] : [...queue];
  current = null;
  queue.length = 0;

  for (const request of pending) {
    if (request.settled) {
      continue;
    }
    request.settled = true;
    if (request.kind === 'confirm') {
      request.resolve(false);
    } else {
      request.resolve(null);
    }
  }
}

export function confirmDialog(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({
      kind: 'confirm',
      id: nextId++,
      options,
      returnFocus: null,
      settled: false,
      resolve,
    });
  });
}

export function promptDialog(
  options: PromptDialogOptions,
): Promise<string | null> {
  return new Promise((resolve) => {
    enqueue({
      kind: 'prompt',
      id: nextId++,
      options,
      returnFocus: null,
      settled: false,
      resolve,
    });
  });
}

interface PromptDialogProps {
  options: PromptDialogOptions;
  onResolve: (value: string | null) => void;
}

const PromptDialog = ({ options, onResolve }: PromptDialogProps) => {
  const inputId = useId();
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(options.defaultValue ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();

    if (options.required && trimmed === '') {
      setError('This field is required.');
      inputRef.current?.focus();
      return;
    }

    if (options.validate) {
      const message = options.validate(trimmed);
      if (message) {
        setError(message);
        inputRef.current?.focus();
        return;
      }
    }

    onResolve(trimmed);
  };

  return (
    <Dialog
      open
      title={options.title}
      size="sm"
      onClose={() => onResolve(null)}
      initialFocusRef={inputRef}
      body={
        <form id={formId} onSubmit={handleSubmit} noValidate>
          <Field
            label={options.label}
            htmlFor={inputId}
            error={error ?? undefined}
            required={options.required}
          >
            <Input
              ref={inputRef}
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              invalid={Boolean(error)}
              aria-required={options.required || undefined}
              autoFocus
            />
          </Field>
        </form>
      }
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onResolve(null)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            Save
          </Button>
        </>
      }
    />
  );
};

interface ConfirmDialogProps {
  options: ConfirmDialogOptions;
  onResolve: (value: boolean) => void;
}

const ConfirmDialog = ({ options, onResolve }: ConfirmDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open
      title={options.title}
      body={options.body}
      size="sm"
      tone={options.tone ?? 'default'}
      onClose={() => onResolve(false)}
      initialFocusRef={cancelRef}
      actions={
        <>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={() => onResolve(false)}
          >
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            type="button"
            variant={options.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => onResolve(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    />
  );
};

export function DialogHost() {
  const request = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, []);

  if (!request) {
    return null;
  }

  if (request.kind === 'confirm') {
    return (
      <ConfirmDialog
        key={request.id}
        options={request.options}
        onResolve={(value) => finish(request, value)}
      />
    );
  }

  return (
    <PromptDialog
      key={request.id}
      options={request.options}
      onResolve={(value) => finish(request, value)}
    />
  );
}
