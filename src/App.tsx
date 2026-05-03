import { useState } from 'react';
import Home from './pages/Home';
import ExchangeTerminal from './pages/ExchangeTerminal';
import Fortune from './pages/Fortune';
import StencilCam from './pages/StencilCam';

type Page = 'home' | 'exchange' | 'fortune' | 'stencilcam';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  if (page === 'exchange') return <ExchangeTerminal onBack={() => setPage('home')} />;
  if (page === 'fortune') return <Fortune onBack={() => setPage('home')} />;
  if (page === 'stencilcam') return <StencilCam onBack={() => setPage('home')} />;
  return <Home onNavigate={(p) => setPage(p)} />;
}
