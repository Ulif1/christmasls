import React from 'react';
import { cx } from '../../lib/cx';
import Icon from '../Icon/Icon';
import type { IconName } from '../Icon/Icon';
import styles from './toast.module.css';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastProps {
  tone: ToastTone;
  message: string;
  onDismiss: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocusWithinChange: (focusWithin: boolean) => void;
}

const toneClass = {
  success: styles.toastSuccess,
  error: styles.toastError,
  info: styles.toastInfo,
};

const iconClass = {
  success: styles.iconSuccess,
  error: styles.iconError,
  info: styles.iconInfo,
};

const iconName: Record<ToastTone, IconName> = {
  success: 'check',
  error: 'x',
  info: 'info',
};

const Toast = ({
  tone,
  message,
  onDismiss,
  onPointerEnter,
  onPointerLeave,
  onFocusWithinChange,
}: ToastProps) => {
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      onFocusWithinChange(false);
    }
  };

  return (
    <div
      className={cx(styles.toast, toneClass[tone])}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={() => onFocusWithinChange(true)}
      onBlur={handleBlur}
    >
      <span className={cx(styles.icon, iconClass[tone])} aria-hidden="true">
        <Icon name={iconName[tone]} size={16} />
      </span>
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
};

export default Toast;
