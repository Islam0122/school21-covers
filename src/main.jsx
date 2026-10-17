import React from 'react';
import ReactDOM from 'react-dom/client';
// PT Serif встроен в сборку: работает офлайн, поддерживает кириллицу и ү, ң, ө
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
