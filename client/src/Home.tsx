import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/home.less';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="home">
      <h1 className="home__title">🎅 Welcome Home! 🎅</h1>
      <p>You are logged in. Merry Christmas!</p>
      <button onClick={handleLogout} className="home__button">Logout</button>
    </div>
  );
};

export default Home;