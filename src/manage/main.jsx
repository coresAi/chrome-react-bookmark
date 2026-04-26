import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ManageApp from './ManageApp.jsx';
import './manage.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ManageApp />
  </StrictMode>
);
