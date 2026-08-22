import './lib/spa-boot.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { maybeRedirectForUiMode } from '../js/ui-mode.js';
import App from './App.jsx';
import './index.css';

if (!maybeRedirectForUiMode()) {
  createRoot(document.getElementById('root')).render(<App />);
}
