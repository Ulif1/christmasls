import React from 'react';
import { cx } from '../../lib/cx';
import styles from './checkbox.module.css';

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { label, className, disabled, type = 'checkbox', ...rest },
    ref,
  ) {
    return (
      <label
        className={cx(
          styles.checkbox,
          disabled && styles.checkboxDisabled,
          className,
        )}
      >
        <input
          {...rest}
          ref={ref}
          type={type}
          disabled={disabled}
          className={styles.checkboxInput}
        />
        <span className={styles.checkboxLabel}>{label}</span>
      </label>
    );
  },
);

export default Checkbox;
