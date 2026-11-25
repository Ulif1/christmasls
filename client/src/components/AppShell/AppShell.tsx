import React, { useEffect, useId, useRef, useState } from 'react';
import Icon from '../Icon/Icon';
import { confirmDialog } from '../Dialog/dialog-service';
import styles from './app-shell.module.css';

export interface AppShellProps {
  children: React.ReactNode;
  username: string;
  listCount: number;
  onLogout: () => void;
}

const AppShell = ({ children, username, listCount, onLogout }: AppShellProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const closeMenu = () => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      if (triggerRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    closeMenu();
    const confirmed = await confirmDialog({
      title: 'Log out?',
      confirmLabel: 'Log out',
    });
    if (confirmed) {
      onLogout();
    }
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              🎄
            </span>
            <span className={styles.brandName}>ChristmasLS</span>
          </span>
          <div className={styles.headerRight}>
            <span className={styles.listCount}>{listCount} lists</span>
            <div className={styles.userMenu}>
              <button
                ref={triggerRef}
                type="button"
                className={styles.userTrigger}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? menuId : undefined}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name="user" size={20} />
                <span className={styles.userName}>{username}</span>
              </button>
              {menuOpen ? (
                <div
                  id={menuId}
                  ref={menuRef}
                  className={styles.menu}
                  role="menu"
                >
                  {username ? (
                    <div className={styles.menuUser}>{username}</div>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => {
                      void handleLogout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      {children}
    </>
  );
};

export default AppShell;
