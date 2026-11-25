import React from 'react';
import { cx } from '../../lib/cx';
import Spinner from '../Spinner/Spinner';
import styles from './button.module.css';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  block?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      block = false,
      className,
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const variantClass = {
      primary: styles.btnPrimary,
      secondary: styles.btnSecondary,
      ghost: styles.btnGhost,
      danger: styles.btnDanger,
    }[variant];

    const sizeClass = {
      sm: styles.btnSm,
      md: styles.btnMd,
    }[size];

    const classes = cx(
      styles.btn,
      variantClass,
      sizeClass,
      block && styles.btnBlock,
      loading && styles.btnLoading,
      className,
    );

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading ? true : undefined}
      >
        {loading ? (
          <span className={styles.btnSpinner}>
            <Spinner size={16} decorative />
          </span>
        ) : null}
        <span className={styles.btnLabel}>{children}</span>
      </button>
    );
  },
);

export default Button;
