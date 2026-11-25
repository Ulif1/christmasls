import React from 'react';
import { cx } from '../../lib/cx';
import Icon from '../Icon/Icon';
import type { IconName } from '../Icon/Icon';
import styles from './icon-button.module.css';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: IconName;
  variant?: 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      variant = 'ghost',
      size = 'md',
      className,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const variantClass = {
      ghost: styles.iconButtonGhost,
      danger: styles.iconButtonDanger,
    }[variant];

    const sizeClass = {
      sm: styles.iconButtonSm,
      md: styles.iconButtonMd,
    }[size];

    const classes = cx(
      styles.iconButton,
      variantClass,
      sizeClass,
      className,
    );

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={classes}
        aria-label={label}
        title={label}
      >
        <Icon name={icon} size={size === 'sm' ? 16 : 20} />
      </button>
    );
  },
);

export default IconButton;
