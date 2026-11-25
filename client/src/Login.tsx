import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Field, Input } from './components';
import styles from './pages/login.module.css';

interface LoginResponse {
  token: string;
  message?: string;
}

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const navigate = useNavigate();

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
    setError(null);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as LoginResponse;
      if (response.ok) {
        sessionStorage.setItem('token', data.token);
        navigate('/home');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Login failed');
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            🎄
          </span>
          <h1 className={styles.brandName}>ChristmasLS</h1>
        </div>
        <Card header={<h2 className={styles.title}>Log in</h2>}>
          <form
            className={styles.form}
            onSubmit={handleSubmit}
            aria-describedby={error ? 'login-error' : undefined}
          >
            {error ? (
              <p id="login-error" className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.fields}>
              <Field label="Username" htmlFor="login-username">
                <Input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={handleUsernameChange}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Password" htmlFor="login-password">
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                />
              </Field>
            </div>
            <Button
              type="submit"
              variant="primary"
              block
              loading={pending}
              disabled={pending}
              className={styles.submit}
            >
              Log in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
