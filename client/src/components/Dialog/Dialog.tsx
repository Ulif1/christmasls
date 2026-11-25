import React, { useEffect, useId, useRef } from 'react';
import { cx } from '../../lib/cx';
import styles from './dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
  tone?: 'default' | 'danger';
  size?: 'sm' | 'md';
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

const Dialog = ({
  open,
  title,
  body,
  actions,
  onClose,
  tone = 'default',
  size = 'md',
  initialFocusRef,
  className,
}: DialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const sizeClass = {
    sm: styles.dialogSm,
    md: styles.dialogMd,
  }[size];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }

      const target = initialFocusRef?.current;
      if (target) {
        const frame = window.requestAnimationFrame(() => {
          target.focus();
        });
        return () => {
          window.cancelAnimationFrame(frame);
        };
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  useEffect(() => {
    return () => {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx(styles.dialog, sizeClass, className)}
      aria-labelledby={titleId}
      aria-describedby={body != null ? bodyId : undefined}
      data-tone={tone}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      </header>
      {body != null ? (
        <div id={bodyId} className={styles.body}>
          {body}
        </div>
      ) : null}
      {actions != null ? (
        <footer className={styles.footer}>{actions}</footer>
      ) : null}
    </dialog>
  );
};

export default Dialog;
