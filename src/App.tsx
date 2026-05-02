import { useState } from 'react';
import Home from './pages/Home';
import ExchangeTerminal from './pages/ExchangeTerminal';
import Fortune from './pages/Fortune';

type Page = 'home' | 'exchange' | 'fortune';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  if (page === 'exchange') return <ExchangeTerminal onBack={() => setPage('home')} />;
  if (page === 'fortune') return <Fortune onBack={() => setPage('home')} />;
  return <Home onNavigate={(p) => setPage(p)} />;
}
