import React, { useContext, useEffect, useState } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import LogoSvg from './components/LogoSvg';
import Navigation from './components/EnterpriseNavigation';
import Header from './components/EnterpriseHeader';
import Login from './views/EnterpriseLogin';
import Dashboard from './views/EnterpriseDashboard';
import Clients from './views/Clients';
import Projects from './views/Projects';
import DailyAgenda from './views/DailyAgenda';
import Tickets from './views/Tickets';
import JcView from './views/JcView';
import Layouts from './views/Layouts';
import Employees from './views/Employees';
import Analytics from './views/Analytics';
import Audit from './views/Audit';
import UserManagement from './views/UserManagement';
import Backups from './views/Backups';

// ─────────────────────────────────────────────
//  SPLASH SCREEN  – JC logo + 3 bouncing dots
// ─────────────────────────────────────────────
function SplashScreen({ visible }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        gap: '32px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: visible ? 'all' : 'none'
      }}
    >
      {/* Logo */}
      <LogoSvg style={{ width: '120px', height: '120px', color: 'var(--primary)', animation: 'splashPulse 2s ease-in-out infinite' }} />

      {/* Three falling dots */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'hsl(222,85%,55%)',
              animation: `splashDot 1.4s ease-in-out ${i * 0.25}s infinite`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px hsla(222,85%,55%,0.45)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 35px hsla(222,85%,55%,0.75)); }
        }
        @keyframes splashDot {
          0% { transform: translateY(-16px); opacity: 0; }
          40% { opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translateY(16px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN PORTAL ROUTER
// ─────────────────────────────────────────────
function PortalRouter() {
  const { isAuthenticated, activeTab, setActiveTab, currentUser, loading, splashDone, saveError } = useContext(AppContext);
  const [showSplash, setShowSplash] = useState(true);

  // Keep splash visible until both: db loaded AND 2.5s timer elapsed
  const splashVisible = !loading && splashDone ? false : true;

  // After fade out, unmount splash
  useEffect(() => {
    if (!splashVisible) {
      const t = setTimeout(() => setShowSplash(false), 600);
      return () => clearTimeout(t);
    }
  }, [splashVisible]);

  // Check if a section is allowed for the current user
  const isTabAllowed = (tab) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Administrador') return true;
    if (tab === 'backups') return currentUser.role !== 'Cliente' && (currentUser.role === 'Administrador' || currentUser.allowedSections?.includes('clients') || currentUser.allowedSections?.includes('backups'));
    if (currentUser.id === 'emp-master') return true;
    if (tab === 'jc') {
      return currentUser.allowedSections && (
        currentUser.allowedSections.includes('wiki') || 
        currentUser.allowedSections.includes('jc') || 
        currentUser.allowedSections.includes('utilitarios')
      );
    }
    if (currentUser.allowedSections && Array.isArray(currentUser.allowedSections)) {
      return currentUser.allowedSections.includes(tab);
    }
    // Fallback role based checks
    if (currentUser.role === 'Cliente') {
      return ['dashboard', 'projects', 'tickets', 'jc'].includes(tab);
    }
    if (tab === 'users') {
      return currentUser.role === 'Administrador';
    }
    if (tab === 'audit') {
      return currentUser.role === 'Administrador' || currentUser.role === 'Gerente';
    }
    return true;
  };

  // Redirect if tab is forbidden
  useEffect(() => {
    if (isAuthenticated && currentUser && !isTabAllowed(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isAuthenticated, currentUser]);

  // Active view mapping
  const renderActiveView = () => {
    const targetTab = isTabAllowed(activeTab) ? activeTab : 'dashboard';
    switch (targetTab) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <Clients />;
      case 'backups': return <Backups />;
      case 'projects': return <Projects />;
      case 'agenda': return <DailyAgenda />;
      case 'tickets': return <Tickets />;
      case 'jc': return <JcView />;
      case 'layouts': return <Layouts />;
      case 'employees': return <Employees />;
      case 'analytics': return <Analytics />;
      case 'audit': return <Audit />;
      case 'users': return <UserManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      {/* Splash overlay */}
      {showSplash && <SplashScreen visible={splashVisible} />}

      {/* Main content (rendered behind splash) */}
      {!splashVisible && (
        isAuthenticated ? (
          <div className="app-container">
            <Navigation />
            <div className="main-content">
              <Header />
              {saveError && <div className="notice error" role="alert">{saveError}</div>}
              <ErrorBoundary key={activeTab}>
                {renderActiveView()}
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <Login />
        )
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <PortalRouter />
    </AppProvider>
  );
}
