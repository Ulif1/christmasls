import React from 'react';
import { cx } from '../../lib/cx';
import { useFieldDescribedBy } from '../../lib/field-aria';
import Icon from '../Icon/Icon';
import styles from './select.module.css';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options?: { value: string; label: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    invalid = false,
    options,
    className,
    id,
    children,
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
    <span className={styles.selectWrap}>
      <select
        {...rest}
        ref={ref}
        id={id}
        className={cx(styles.select, invalid && styles.selectInvalid, className)}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
      >
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      <span className={styles.selectChevron} aria-hidden="true">
        <Icon name="chevron-down" size={20} />
      </span>
    </span>
  );
});

export default Select;
