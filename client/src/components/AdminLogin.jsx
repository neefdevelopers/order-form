import React, { useState } from 'react';
import { apiUrl } from '../config';
import { 
  Lock, 
  User, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  Leaf
} from 'lucide-react';

export default function AdminLogin({ onLoginSuccess, onBackToOrderForm }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store in session storage so a new session/browser window always requires login
      sessionStorage.setItem('admin_token', data.token);
      localStorage.removeItem('admin_token');
      onLoginSuccess(data.token, data.admin);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6ee] text-[#374011] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <img 
              src="/dhaara-logo-dark.png" 
              alt="dhaara wellness" 
              className="h-10 sm:h-12 w-auto object-contain" 
            />
          </div>
          <h2 className="text-xl font-bold text-[#374011] tracking-tight">
            Administrator Portal
          </h2>
          <p className="text-xs text-[#374011]/70 mt-1">
            Sign in to manage products, orders, and promoters
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#d8dec2] p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Input */}
            <div>
              <label 
                htmlFor="admin-username"
                className="block text-xs font-semibold uppercase tracking-wider text-[#374011] mb-1.5"
              >
                Administrator Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter admin username"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#d8dec2] text-sm text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                />
              </div>
            </div>

            {/* Password Input with Visibility Toggle */}
            <div>
              <label 
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#374011] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter admin password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#d8dec2] text-sm text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#374011]/50 hover:text-[#374011] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#7f8f55] text-white text-sm font-semibold hover:bg-[#6f7e49] active:bg-[#5c6a38] transition focus:outline-none focus:ring-4 focus:ring-[#7f8f55]/20 disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In to Admin Panel</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Customer Order Form */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onBackToOrderForm}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374011]/70 hover:text-[#7f8f55] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Customer Order Form</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
