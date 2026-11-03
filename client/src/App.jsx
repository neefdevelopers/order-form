import React, { useState, useEffect } from 'react';
import CustomerOrderForm from './components/CustomerOrderForm';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import { Shield, ShoppingBag } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('customer'); // 'customer' | 'admin'
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || null);
  const [admin, setAdmin] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check existing token validity on startup
  useEffect(() => {
    const verifyExistingToken = async () => {
      const storedToken = localStorage.getItem('admin_token');
      if (!storedToken) {
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
          localStorage.removeItem('admin_token');
          setToken(null);
          setAdmin(null);
        }
      } catch (err) {
        console.error('Error verifying admin token:', err);
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyExistingToken();
  }, []);

  const handleLoginSuccess = (newToken, adminUser) => {
    setToken(newToken);
    setAdmin(adminUser);
    setView('admin');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('admin_token');
    setToken(null);
    setAdmin(null);
    setView('customer');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top minimal switcher header (hidden when logged in as admin to avoid duplicate stacked headers) */}
      {!(view === 'admin' && token) && (
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
            <button
              onClick={() => setView('customer')}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-900 hover:text-blue-600 transition"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="truncate">Product Ordering</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setView('customer')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  view === 'customer'
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Order Form
              </button>

              <button
                onClick={() => setView('admin')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  view === 'admin'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Body */}
      <div className="flex-1 flex flex-col">
        {view === 'customer' ? (
          <CustomerOrderForm onNavigateToAdmin={() => setView('admin')} />
        ) : token ? (
          <AdminPanel
            token={token}
            admin={admin}
            onLogout={handleLogout}
            onNavigateToCustomer={() => setView('customer')}
          />
        ) : (
          <AdminLogin
            onLoginSuccess={handleLoginSuccess}
            onBackToOrderForm={() => setView('customer')}
          />
        )}
      </div>
    </div>
  );
}
