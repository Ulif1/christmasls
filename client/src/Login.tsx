import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/login.less';

const Login: React.FC<{}> = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Login successful');
        sessionStorage.setItem('token', data.token);
        navigate('/home');
      } else {
        setMessage(data.message || 'Login failed');
      }
    } catch (error) {
      setMessage('Login failed');
    }
  };

  return (
    <div className="login">
      <h2 className="login__title">🎄 Merry Christmas Login 🎄</h2>
      <form className="login__form" onSubmit={handleSubmit}>
        <div>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login__button">Login</button>
      </form>
      {message && <p className={`login__message ${message.includes('successful') ? 'login__message--success' : 'login__message--error'}`}>{message}</p>}
    </div>
  );
};

export default Login;