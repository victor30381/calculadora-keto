import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
console.log('Deployed at 2026-02-19 12:54');
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);