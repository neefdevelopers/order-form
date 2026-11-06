import React, { useState, useEffect } from 'react';
import CustomerOrderForm from './components/CustomerOrderForm';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import PromoterDashboard from './components/PromoterDashboard';
import { apiUrl } from './config';

function parseCurrentRoute() {
  if (typeof window === 'undefined') return { view: 'customer', promoterToken: null };
  const path = window.location.pathname;
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);

  // Check for promoter dashboard link:
  // e.g. /promoter/TOKEN, #promoter/TOKEN, #/promoter/TOKEN, or ?promoter_token=TOKEN
  const pathMatch = path.match(/^\/promoter\/([a-zA-Z0-9_-]+)/i);
  if (pathMatch && pathMatch[1]) {
    return { view: 'promoter', promoterToken: pathMatch[1] };
  }

  const hashMatch = hash.match(/^#\/?promoter\/([a-zA-Z0-9_-]+)/i);
  if (hashMatch && hashMatch[1]) {
    return { view: 'promoter', promoterToken: hashMatch[1] };
  }

  if (searchParams.get('promoter_token')) {
    return { view: 'promoter', promoterToken: searchParams.get('promoter_token') };
  }

  if (path.toLowerCase().startsWith('/admin') || hash.toLowerCase().includes('admin')) {
    return { view: 'admin', promoterToken: null };
  }

  return { view: 'customer', promoterToken: null };
}

export default function App() {
  const initialRoute = parseCurrentRoute();
  const [view, setView] = useState(initialRoute.view);
  const [promoterToken, setPromoterToken] = useState(initialRoute.promoterToken);
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
      const route = parseCurrentRoute();
      setView(route.view);
      setPromoterToken(route.promoterToken);
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
        const res = await fetch(apiUrl('/api/admin/me'), {
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
      await fetch(apiUrl('/api/admin/logout'), { method: 'POST' });
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
        {view === 'promoter' ? (
          <PromoterDashboard
            token={promoterToken}
            onNavigateHome={navigateToCustomer}
          />
        ) : view === 'customer' ? (
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
