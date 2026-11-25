import React from 'react';
import { cx } from '../../lib/cx';
import styles from './card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = ({
  as = 'div',
  header,
  footer,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) => {
  const Tag = as as React.ElementType;

  const paddingClass = {
    none: styles.cardPadNone,
    sm: styles.cardPadSm,
    md: styles.cardPadMd,
    lg: styles.cardPadLg,
  }[padding];

  return (
    <Tag className={cx(styles.card, className)} {...rest}>
      {header != null ? (
        <div className={styles.cardHeader}>{header}</div>
      ) : null}
      <div className={cx(styles.cardBody, paddingClass)}>{children}</div>
      {footer != null ? (
        <div className={styles.cardFooter}>{footer}</div>
      ) : null}
    </Tag>
  );
};

export default Card;
