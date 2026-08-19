import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Web shell (T003). Pages arrive with the held product-surface epics
 * (EPIC-005, EPIC-006, EPIC-010) once the BRS lands.
 */
function App(): React.ReactElement {
  return React.createElement('main', null, 'PMI Studio');
}

const el = document.getElementById('root');
if (el) createRoot(el).render(React.createElement(App));
