import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import type { ToastTone } from './Toast';
import styles from './toast.module.css';

export interface ToastOptions {
  duration?: number;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  duration: number;
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  hovered: boolean;
  focusWithin: boolean;
}

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 5000;

const listeners = new Set<() => void>();
let toasts: ToastItem[] = [];
let nextId = 1;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastItem[] {
  return toasts;
}

function notify(): void {
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

function clearTimer(item: ToastItem): void {
  if (item.timer) {
    clearTimeout(item.timer);
    item.timer = null;
  }
}

function syncTimer(item: ToastItem): void {
  const paused = item.hovered || item.focusWithin;

  if (paused) {
    if (item.timer) {
      clearTimer(item);
      item.remaining = Math.max(
        0,
        item.remaining - (Date.now() - item.startedAt),
      );
    }
    return;
  }

  if (item.duration <= 0 || item.timer) {
    return;
  }

  const remaining = item.remaining > 0 ? item.remaining : item.duration;
  item.remaining = remaining;
  item.startedAt = Date.now();
  item.timer = setTimeout(() => dismiss(item.id), remaining);
}

function dismiss(id: number): void {
  const item = toasts.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  clearTimer(item);
  toasts = toasts.filter((entry) => entry.id !== id);
  notify();
}

function add(tone: ToastTone, message: string, opts?: ToastOptions): void {
  const duration = opts?.duration ?? DEFAULT_DURATION;
  const item: ToastItem = {
    id: nextId++,
    tone,
    message,
    duration,
    remaining: duration,
    startedAt: Date.now(),
    timer: null,
    hovered: false,
    focusWithin: false,
  };

  toasts = [...toasts, item];

  while (toasts.length > MAX_TOASTS) {
    const oldest = toasts[0];
    clearTimer(oldest);
    toasts = toasts.slice(1);
  }

  syncTimer(item);
  notify();
}

function setHovered(id: number, hovered: boolean): void {
  const item = toasts.find((entry) => entry.id === id);
  if (!item || item.hovered === hovered) {
    return;
  }
  item.hovered = hovered;
  syncTimer(item);
}

function setFocusWithin(id: number, focusWithin: boolean): void {
  const item = toasts.find((entry) => entry.id === id);
  if (!item || item.focusWithin === focusWithin) {
    return;
  }
  item.focusWithin = focusWithin;
  syncTimer(item);
}

function clearAll(): void {
  for (const item of toasts) {
    clearTimer(item);
  }
  toasts = [];
}

export const toast = {
  success(message: string, opts?: ToastOptions): void {
    add('success', message, opts);
  },
  error(message: string, opts?: ToastOptions): void {
    add('error', message, opts);
  },
  info(message: string, opts?: ToastOptions): void {
    add('info', message, opts);
  },
};

export function ToastHost() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    return () => {
      clearAll();
    };
  }, []);

  const notices = items.filter((item) => item.tone !== 'error');
  const errors = items.filter((item) => item.tone === 'error');

  return createPortal(
    <div className={styles.viewport}>
      <div className={styles.region} role="status" aria-live="polite">
        {notices.map((item) => (
          <Toast
            key={item.id}
            tone={item.tone}
            message={item.message}
            onDismiss={() => dismiss(item.id)}
            onPointerEnter={() => setHovered(item.id, true)}
            onPointerLeave={() => setHovered(item.id, false)}
            onFocusWithinChange={(focusWithin) =>
              setFocusWithin(item.id, focusWithin)
            }
          />
        ))}
      </div>
      <div className={styles.region} role="alert">
        {errors.map((item) => (
          <Toast
            key={item.id}
            tone={item.tone}
            message={item.message}
            onDismiss={() => dismiss(item.id)}
            onPointerEnter={() => setHovered(item.id, true)}
            onPointerLeave={() => setHovered(item.id, false)}
            onFocusWithinChange={(focusWithin) =>
              setFocusWithin(item.id, focusWithin)
            }
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
