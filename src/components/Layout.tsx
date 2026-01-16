import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from './ui/ThemeToggle';
import { Button } from './ui/Button';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function Layout({ children, fullWidth = false }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <Link to="/">Leaflet</Link>
          </div>
          <nav className={styles.nav}>
            <div className={styles.navLinks}>
              <Link to="/posts">Explore</Link>
              {user && (
                <>
                  <Link to="/profile">My Posts</Link>
                  <Link to="/canvases">Canvases</Link>
                </>
              )}
            </div>
            <div className={styles.navActions}>
              {user && (
                <Button asChild variant="primary" size="sm">
                  <Link to="/create">Write</Link>
                </Button>
              )}
              <ThemeToggle />
              {user ? (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className={styles.userBtn}>
                      {user.handle}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className={styles.dropdownContent} sideOffset={5}>
                      <DropdownMenu.Item className={styles.dropdownItem} onSelect={() => navigate('/profile')}>
                        My Posts
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className={styles.dropdownItem} onSelect={() => navigate('/profile/edit')}>
                        Edit Profile
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className={styles.dropdownSeparator} />
                      <DropdownMenu.Item className={styles.dropdownItem} onSelect={handleLogout}>
                        Sign Out
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/">Sign in</Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main className={fullWidth ? styles.mainFull : styles.main}>
        {children}
      </main>
    </div>
  );
}
