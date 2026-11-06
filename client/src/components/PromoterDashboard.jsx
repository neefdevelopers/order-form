import React, { useState, useEffect } from 'react';
import { apiUrl } from '../config';
import { 
  ShoppingBag, 
  Package, 
  IndianRupee, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  Share2
} from 'lucide-react';

export default function PromoterDashboard({ token, onNavigateHome }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    } else {
      setError('No promoter access link provided. Please use the valid link shared by your administrator.');
      setLoading(false);
    }
  }, [token]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/promoters/dashboard/${encodeURIComponent(token)}`));
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Unable to access promoter dashboard');
      }
      setData(resData);
    } catch (err) {
      console.error('Error loading promoter dashboard:', err);
      setError(err.message || 'Failed to load promoter dashboard. Please verify your link.');
    } finally {
      setLoading(false);
    }
  };

  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString || '-';
    }
  };

  const handleCopy = (text, id) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyDashboardLink = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGoToOrderForm = () => {
    const code = data?.promoter?.promoter_code;
    const targetUrl = code ? `/?promoter=${encodeURIComponent(code)}` : '/';
    if (onNavigateHome) {
      window.history.pushState({}, '', targetUrl);
      onNavigateHome(code);
    } else {
      window.location.href = targetUrl;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center max-w-sm w-full">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Verifying Promoter Access...</h3>
          <p className="text-xs text-slate-500 mt-1">Loading your personalized promoter dashboard</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-xs text-center max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {error || 'Unable to load promoter dashboard. Please contact your administrator for a valid access link.'}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={fetchDashboardData}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
            >
              <span>Go to Order Form</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { promoter, stats, orders = [] } = data;

  // Filter orders by search term (Order ID or Product Name)
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = order.id && order.id.toLowerCase().includes(q);
    const itemMatch = Array.isArray(order.items) && order.items.some(
      (it) => it.product_name && it.product_name.toLowerCase().includes(q)
    );
    return idMatch || itemMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand / Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-none">
                    Promoter Dashboard
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Authorized
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  Personal Sales & Orders Overview
                </p>
              </div>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                title="Refresh Data"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleCopyDashboardLink}
                title="Copy shareable dashboard link"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleGoToOrderForm}
                title="Place customer order with this Promoter ID"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition shadow-xs"
              >
                <span>Place Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Promoter Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
              {promoter.promoter_code.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {promoter.promoter_code}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(promoter.promoter_code, 'promoter_code')}
                  title="Copy Promoter ID"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  {copiedId === 'promoter_code' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {promoter.name ? promoter.name : 'Authorized Promoter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-between sm:justify-end">
            <span className="text-xs text-slate-500">
              Promoter Status:
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
        </div>

        {/* 3 Key Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Orders */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-blue-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Orders
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.total_orders || 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Orders placed with your Promoter ID
            </p>
          </div>

          {/* Card 2: Total Products Sold */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-indigo-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Products Sold
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.total_products_sold || 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Individual units ordered by customers
            </p>
          </div>

          {/* Card 3: Total Order Amount */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Order Amount
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatINR(stats.total_order_amount || 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Cumulative gross sales value
            </p>
          </div>
        </div>

        {/* Orders Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Orders History</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                  {orders.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Detailed record of all customer orders associated with your Promoter ID
              </p>
            </div>

            {/* Search filter */}
            {orders.length > 0 && (
              <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID or Product..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Orders Content */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Orders Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                No customer orders have been placed with your Promoter ID ({promoter.promoter_code}) yet. Share your Promoter ID with customers to start tracking orders here!
              </p>
              <button
                onClick={handleGoToOrderForm}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
              >
                <span>Open Order Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <p className="text-xs text-slate-600 font-medium">
                No orders match your search term "{searchQuery}".
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-4">Order ID</th>
                        <th className="py-3.5 px-4">Order Date</th>
                        <th className="py-3.5 px-4">Products & Quantities</th>
                        <th className="py-3.5 px-4 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map((order) => {
                        const items = Array.isArray(order.items) ? order.items : [];
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/60 transition group">
                            {/* Order ID */}
                            <td className="py-4 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-blue-700 font-semibold">{order.id}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(order.id, order.id)}
                                  title="Copy Order ID"
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition opacity-0 group-hover:opacity-100"
                                >
                                  {copiedId === order.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Order Date */}
                            <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{formatDate(order.created_at)}</span>
                              </div>
                            </td>

                            {/* Products & Individual Quantities */}
                            <td className="py-4 px-4">
                              <div className="space-y-1.5 max-w-md">
                                {items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-3 text-xs bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {it.product_name}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[11px]">
                                      <span className="px-2 py-0.5 rounded-md bg-blue-100/70 text-blue-800 font-semibold">
                                        Qty: {it.quantity}
                                      </span>
                                      <span className="text-slate-600 font-semibold">
                                        {formatINR(it.subtotal || it.product_price * it.quantity)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Total Amount */}
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <span className="text-sm font-bold text-slate-900 font-mono">
                                {formatINR(order.total_amount)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Adaptive Cards View */}
              <div className="block md:hidden space-y-3">
                {filteredOrders.map((order) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                    >
                      {/* Card Header: Order ID & Date */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-blue-700">
                            <span>{order.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.id, order.id)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700"
                            >
                              {copiedId === order.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formatDate(order.created_at)}</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-slate-900 font-mono">
                            {formatINR(order.total_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Products List */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Ordered Products
                        </span>
                        {items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                          >
                            <span className="font-medium text-slate-800 truncate mr-2">
                              {it.product_name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-800 font-semibold text-[10px]">
                                Qty: {it.quantity}
                              </span>
                              <span className="text-slate-700 font-semibold">
                                {formatINR(it.subtotal || it.product_price * it.quantity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Product Ordering System • Promoter Portal</span>
          <span className="text-slate-400">
            Promoter ID: <strong className="font-mono text-slate-600">{promoter.promoter_code}</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
