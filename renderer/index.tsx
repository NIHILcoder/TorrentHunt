import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading-screen">Loading...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);
