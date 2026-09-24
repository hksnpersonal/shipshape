import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/app/App';
// Bundled, not fetched from Google: the app has to look right on a train with no signal.
import '@fontsource-variable/figtree';
import '@fontsource-variable/fraunces';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
