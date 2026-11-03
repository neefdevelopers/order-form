import React, { useState, useEffect } from 'react';
import CustomerOrderForm from './components/CustomerOrderForm';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';

function getInitialView() {
  if (typeof window === 'undefined') return 'customer';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path.startsWith('/admin') || hash.includes('admin')) {
    return 'admin';
  }
  return 'customer';
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('admin_token') || null;
    }
    return null;
  });
  const [admin, setAdmin] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Sync view state with browser URL navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const currentPath = window.location.pathname.toLowerCase();
      const currentHash = window.location.hash.toLowerCase();
      if (currentPath.startsWith('/admin') || currentHash.includes('admin')) {
        setView('admin');
      } else {
        setView('customer');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Check existing token validity on startup
  useEffect(() => {
    // Purge any legacy persistent localStorage token to enforce session isolation
    try {
      localStorage.removeItem('admin_token');
    } catch (e) {
      // Ignore storage restrictions
    }

    const verifyExistingToken = async () => {
      const storedToken = sessionStorage.getItem('admin_token');
      if (!storedToken) {
        setToken(null);
        setAdmin(null);
        setCheckingAuth(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });

        if (res.ok) {
          const data = await res.json();
          setToken(storedToken);
          setAdmin(data.admin);
        } else {
          // Token is invalid/expired
          sessionStorage.removeItem('admin_token');
          setToken(null);
          setAdmin(null);
        }
      } catch (err) {
        console.error('Error verifying admin token:', err);
        sessionStorage.removeItem('admin_token');
        setToken(null);
        setAdmin(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyExistingToken();
  }, []);

  const handleLoginSuccess = (newToken, adminUser) => {
    sessionStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setAdmin(adminUser);
    setView('admin');
    window.history.pushState({}, '', '/admin');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    }
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token');
    setToken(null);
    setAdmin(null);
    window.history.pushState({}, '', '/admin');
    setView('admin');
  };

  const navigateToCustomer = () => {
    window.history.pushState({}, '', '/');
    setView('customer');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Main Content View */}
      <div className="flex-1 flex flex-col">
        {view === 'customer' ? (
          <CustomerOrderForm />
        ) : token ? (
          <AdminPanel
            token={token}
            admin={admin}
            onLogout={handleLogout}
            onNavigateToCustomer={navigateToCustomer}
          />
        ) : (
          <AdminLogin
            onLoginSuccess={handleLoginSuccess}
            onBackToOrderForm={navigateToCustomer}
          />
        )}
      </div>
    </div>
  );
}
