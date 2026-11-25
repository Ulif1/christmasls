import React from 'react';
import { cx } from '../../lib/cx';
import { FieldAriaContext } from '../../lib/field-aria';
import styles from './field.module.css';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

const Field = ({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className,
}: FieldProps) => {
  const hasHint = Boolean(hint);
  const hasError = Boolean(error);

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className={styles.fieldRequired} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <FieldAriaContext.Provider value={{ htmlFor, hasHint, hasError }}>
        {children}
      </FieldAriaContext.Provider>
      {hasHint ? (
        <p id={`${htmlFor}-hint`} className={styles.fieldHint}>
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={`${htmlFor}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default Field;
