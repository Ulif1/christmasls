import React from 'react';
import { cx } from '../../lib/cx';
import Icon from '../Icon/Icon';
import type { IconName } from '../Icon/Icon';
import styles from './empty-state.module.css';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState = ({
  icon = 'gift',
  title,
  body,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div className={cx(styles.emptyState, className)}>
      <span className={styles.emptyStateIcon}>
        <Icon name={icon} size={24} />
      </span>
      <h3 className={styles.emptyStateTitle}>{title}</h3>
      {body != null ? (
        <div className={styles.emptyStateBody}>{body}</div>
      ) : null}
      {action != null ? (
        <div className={styles.emptyStateAction}>{action}</div>
      ) : null}
    </div>
  );
};

export default EmptyState;
