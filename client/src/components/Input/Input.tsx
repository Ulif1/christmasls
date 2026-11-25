import React from 'react';
import { cx } from '../../lib/cx';
import { useFieldDescribedBy } from '../../lib/field-aria';
import styles from './input.module.css';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    invalid = false,
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const describedBy = useFieldDescribedBy({
    id,
    invalid,
    describedBy: ariaDescribedBy,
  });

  return (
    <input
      {...rest}
      ref={ref}
      id={id}
      className={cx(styles.input, invalid && styles.inputInvalid, className)}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
    />
  );
});

export default Input;
