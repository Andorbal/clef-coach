import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles/global.css';
// registers the Bravura music font early (used by the notation and some UI glyphs)
import { notationFontsReady } from './notation/render';
import App from './App';

notationFontsReady();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
