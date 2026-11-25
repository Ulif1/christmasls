import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import Login from './Login';
import Home from './Home';
import { DialogHost, ToastHost } from './components';

const App: React.FC = () => {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<Home />} />
        </Routes>
      </Router>
      <DialogHost />
      <ToastHost />
    </>
  );
};

export default App;
