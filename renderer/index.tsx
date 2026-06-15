import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { armSplashFailsafe } from './utils/splash';

// Force the startup splash down even if the app never reports ready (mount error,
// slow engine). Armed the moment the bundle runs, so the splash can't get stuck.
armSplashFailsafe(6000);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
