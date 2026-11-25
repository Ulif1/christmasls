import React from 'react';
import { cx } from '../../lib/cx';
import styles from './spinner.module.css';

export interface SpinnerProps {
  size?: number;
  label?: string;
  decorative?: boolean;
}

const Spinner = ({
  size = 16,
  label = 'Loading',
  decorative = false,
}: SpinnerProps) => {
  const ring = (
    <svg
      className={cx(styles.spinner, size === 16 && styles.spinnerSm)}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    />
  );

  if (decorative) {
    return <span aria-hidden="true">{ring}</span>;
  }

  return (
    <span role="status">
      <span className={styles.spinnerSrOnly}>{label}</span>
      {ring}
    </span>
  );
};

export default Spinner;
