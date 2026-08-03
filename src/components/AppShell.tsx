import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Explore } from '@/components/Explore';
import { Inventory } from '@/components/Inventory';
import { AddPartForm } from '@/components/AddPartForm';
import { Builder } from '@/components/Builder';
import { Collection } from '@/components/Collection';
import { Decks } from '@/components/Decks';
import { DeckEditor } from '@/components/DeckEditor';

const NAV_ITEMS: { label: string; path: string }[] = [
  { label: 'Decks', path: '/decks' },
  { label: 'Collection', path: '/collection' },
  { label: 'Builder', path: '/builder' },
  { label: 'Inventory', path: '/inventory' },
  { label: 'Explore', path: '/explore' },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="app">
      <div className="top">
        <div className="brandbox">
          <div className="mark" role="img" aria-label="Beybox" />
          <div className="wordmark">BEYBOX</div>
        </div>

        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) => (isActive ? 'on' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hdr-r">
          <button className="b grey">Manage account</button>
          <button
            className="b grey icon"
            onClick={() => signOut()}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
          {user?.plan === 'pro' && <span className="badge-pro">Pro</span>}
        </div>
      </div>

      <Routes>
        <Route path="/decks" element={<Decks />} />
        <Route path="/decks/:deckId" element={<DeckEditor />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/add" element={<AddPartForm />} />
        <Route path="/inventory/edit/:partId" element={<AddPartForm />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/builder/:buildId" element={<Builder />} />
        <Route path="*" element={<Navigate to="/decks" replace />} />
      </Routes>

      <div className="foot">
        <div className="foot-l">
          <span>Signed in as {user?.email}</span>
        </div>
        <div className="foot-r">
          <span>Beybox</span>
        </div>
      </div>
    </div>
  );
}
