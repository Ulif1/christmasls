import React from 'react';
import { cx } from '../../lib/cx';
import styles from './icon.module.css';

export type IconName =
  | 'edit'
  | 'trash'
  | 'plus'
  | 'share'
  | 'check'
  | 'x'
  | 'chevron-down'
  | 'gift'
  | 'user'
  | 'info';

export interface IconProps {
  name: IconName;
  size?: 16 | 20 | 24;
  title?: string;
  className?: string;
}

const paths: Record<IconName, React.ReactNode> = {
  edit: (
    <>
      <path d="M4 20l.9-3.6L16.4 4.9a2 2 0 0 1 2.8 0l.1.1a2 2 0 0 1 0 2.8L7.6 19.1 4 20Z" />
      <path d="M14.8 6.5l2.8 2.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16" />
      <path d="M9 6.5V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v1.7" />
      <path d="M6.5 6.5l.8 12.2a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7l.8-12.2" />
      <path d="M10 10.5v6" />
      <path d="M14 10.5v6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="M8.7 10.8l6.6-4" />
      <path d="M8.7 13.2l6.6 4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  gift: (
    <>
      <path d="M5 11v8.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V11" />
      <path d="M3.5 7.5h17V11h-17z" />
      <path d="M12 7.5V21" />
      <path d="M12 7.5H8.4a2.2 2.2 0 0 1 0-4.4C10.9 3.1 12 7.5 12 7.5Z" />
      <path d="M12 7.5h3.6a2.2 2.2 0 0 0 0-4.4C13.1 3.1 12 7.5 12 7.5Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20v-1.5A4.5 4.5 0 0 1 9.5 14h5a4.5 4.5 0 0 1 4.5 4.5V20" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
};

const Icon = ({ name, size = 20, title, className }: IconProps) => {
  const classes = cx(styles.icon, className);
  const decorative = !title;

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
};

export default Icon;
