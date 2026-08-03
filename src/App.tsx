import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Background } from '@/components/Background';
import { AuthScreen } from '@/components/AuthScreen';
import { AppShell } from '@/components/AppShell';
import { BrowserRouter } from 'react-router-dom';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <Background />
        <div style={{ position: 'relative', zIndex: 1, padding: '80px 18px', textAlign: 'center', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: '12px' }}>
          Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <Background />
      {user ? <AppShell /> : <AuthScreen />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
