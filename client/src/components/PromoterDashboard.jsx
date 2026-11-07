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
  Calendar, 
  Leaf 
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
      <div className="min-h-screen bg-[#f4f6ee] flex items-center justify-center p-4 text-[#374011]">
        <div className="bg-white rounded-2xl border border-[#d8dec2] p-8 shadow-xs text-center max-w-sm w-full">
          <RefreshCw className="w-8 h-8 text-[#7f8f55] animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#374011]">Verifying Promoter Access...</h3>
          <p className="text-xs text-[#374011]/70 mt-1">Loading your personalized promoter dashboard</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f4f6ee] flex items-center justify-center p-4 text-[#374011]">
        <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-xs text-center max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#374011]">Access Restricted</h3>
          <p className="text-xs text-[#374011]/80 mt-2 leading-relaxed">
            {error || 'Unable to load promoter dashboard. Please contact your administrator for a valid access link.'}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={fetchDashboardData}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#d8dec2] bg-white text-[#374011] text-xs font-semibold hover:bg-[#d8dec2]/40 transition"
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
    <div className="min-h-screen bg-[#f4f6ee] text-[#374011] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-[#d8dec2] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand / Title */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <img 
                src="/dhaara-logo.png" 
                alt="Dhaara Wellness" 
                className="w-9 h-9 rounded-xl object-cover bg-black flex-shrink-0 shadow-xs ring-1 ring-black/10" 
              />
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <img 
                    src="/dhaara-logo-dark.png" 
                    alt="dhaara wellness" 
                    className="h-4.5 sm:h-5 w-auto object-contain object-left" 
                  />
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#d8dec2]/60 text-[#374011] border border-[#a9b48a]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7f8f55]" />
                    Promoter Portal
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-[#7f8f55] tracking-wide block leading-none mt-0.5">
                  Sales & Orders Dashboard
                </span>
              </div>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                title="Refresh Data"
                className="p-2 rounded-xl border border-[#d8dec2] bg-white text-[#374011] hover:bg-[#d8dec2]/30 transition shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleCopyDashboardLink}
                title="Copy shareable dashboard link"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#d8dec2] bg-white text-[#374011] text-xs font-semibold hover:bg-[#d8dec2]/30 transition shadow-2xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[#7f8f55]" /> : <Copy className="w-3.5 h-3.5 text-[#7f8f55]" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleGoToOrderForm}
                title="Place customer order with this Promoter ID"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] active:bg-[#5c6a38] transition shadow-xs"
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
        <div className="bg-white rounded-2xl border border-[#d8dec2] p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#d8dec2]/50 border border-[#a9b48a] text-[#374011] flex items-center justify-center font-bold text-lg font-mono">
              {promoter.promoter_code.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base sm:text-lg font-bold text-[#374011] tracking-tight">
                  {promoter.promoter_code}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(promoter.promoter_code, 'promoter_code')}
                  title="Copy Promoter ID"
                  className="p-1 rounded-md text-[#374011]/60 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition"
                >
                  {copiedId === 'promoter_code' ? (
                    <Check className="w-3.5 h-3.5 text-[#7f8f55]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#374011]/70 font-medium">
                {promoter.name ? promoter.name : 'Authorized Promoter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#d8dec2]/60 justify-between sm:justify-end">
            <span className="text-xs text-[#374011]/70">
              Promoter Status:
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#d8dec2]/60 text-[#374011] border border-[#a9b48a]">
              <span className="w-2 h-2 rounded-full bg-[#7f8f55]" />
              Active
            </span>
          </div>
        </div>

        {/* 3 Key Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Orders */}
          <div className="bg-white rounded-2xl border border-[#d8dec2] p-5 shadow-xs relative overflow-hidden group hover:border-[#a9b48a] transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#374011]/70 uppercase tracking-wider">
                Total Orders
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#d8dec2]/40 text-[#7f8f55] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#374011] tracking-tight">
              {stats.total_orders || 0}
            </div>
            <p className="text-[11px] text-[#374011]/60 mt-1 font-medium">
              Orders placed with your Promoter ID
            </p>
          </div>

          {/* Card 2: Total Products Sold */}
          <div className="bg-white rounded-2xl border border-[#d8dec2] p-5 shadow-xs relative overflow-hidden group hover:border-[#a9b48a] transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#374011]/70 uppercase tracking-wider">
                Total Products Sold
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#d8dec2]/40 text-[#7f8f55] flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#374011] tracking-tight">
              {stats.total_products_sold || 0}
            </div>
            <p className="text-[11px] text-[#374011]/60 mt-1 font-medium">
              Individual units ordered by customers
            </p>
          </div>

          {/* Card 3: Total Order Amount */}
          <div className="bg-white rounded-2xl border border-[#d8dec2] p-5 shadow-xs relative overflow-hidden group hover:border-[#a9b48a] transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#374011]/70 uppercase tracking-wider">
                Total Order Amount
              </span>
              <div className="w-9 h-9 rounded-xl bg-[#d8dec2]/40 text-[#7f8f55] flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#374011] tracking-tight font-mono">
              {formatINR(stats.total_order_amount || 0)}
            </div>
            <p className="text-[11px] text-[#374011]/60 mt-1 font-medium">
              Cumulative gross sales value
            </p>
          </div>
        </div>

        {/* Orders Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#374011] flex items-center gap-2">
                <span>Orders History</span>
                <span className="px-2 py-0.5 rounded-full bg-[#d8dec2]/40 text-[#374011] text-xs font-semibold border border-[#d8dec2]">
                  {orders.length}
                </span>
              </h2>
              <p className="text-xs text-[#374011]/70">
                Detailed record of all customer orders associated with your Promoter ID
              </p>
            </div>

            {/* Search filter */}
            {orders.length > 0 && (
              <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID or Product..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#d8dec2] text-xs text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-[#374011]/60 hover:text-[#374011]"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Orders Content */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#d8dec2] p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#f4f6ee] text-[#7f8f55] mx-auto flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#374011]">No Orders Yet</h3>
              <p className="text-xs text-[#374011]/70 mt-1 max-w-sm mx-auto leading-relaxed">
                No customer orders have been placed with your Promoter ID ({promoter.promoter_code}) yet. Share your Promoter ID with customers to start tracking orders here!
              </p>
              <button
                onClick={handleGoToOrderForm}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] transition shadow-xs"
              >
                <span>Open Order Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#d8dec2] p-8 text-center shadow-xs">
              <p className="text-xs text-[#374011]/70 font-medium">
                No orders match your search term "{searchQuery}".
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-semibold text-[#7f8f55] hover:underline"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-2xl border border-[#d8dec2] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#d8dec2]/40 border-b border-[#d8dec2] text-[#374011] font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-4">Order ID</th>
                        <th className="py-3.5 px-4">Order Date</th>
                        <th className="py-3.5 px-4">Products & Quantities</th>
                        <th className="py-3.5 px-4 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d8dec2]/40">
                      {filteredOrders.map((order) => {
                        const items = Array.isArray(order.items) ? order.items : [];
                        return (
                          <tr key={order.id} className="hover:bg-[#d8dec2]/15 transition group">
                            {/* Order ID */}
                            <td className="py-4 px-4 font-mono font-bold text-[#374011] whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[#7f8f55] font-semibold">{order.id}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(order.id, order.id)}
                                  title="Copy Order ID"
                                  className="p-1 rounded-md text-[#374011]/40 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition opacity-0 group-hover:opacity-100"
                                >
                                  {copiedId === order.id ? (
                                    <Check className="w-3.5 h-3.5 text-[#7f8f55]" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Order Date */}
                            <td className="py-4 px-4 text-[#374011]/80 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[#7f8f55]" />
                                <span>{formatDate(order.created_at)}</span>
                              </div>
                            </td>

                            {/* Products & Individual Quantities */}
                            <td className="py-4 px-4">
                              <div className="space-y-1.5 max-w-md">
                                {items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-3 text-xs bg-[#d8dec2]/25 px-2.5 py-1.5 rounded-lg border border-[#d8dec2]/60"
                                  >
                                    <div className="font-semibold text-[#374011] truncate">
                                      {it.product_name}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[11px]">
                                      <span className="px-2 py-0.5 rounded-md bg-[#d8dec2]/70 text-[#374011] font-semibold">
                                        Qty: {it.quantity}
                                      </span>
                                      <span className="text-[#374011] font-bold">
                                        {formatINR(it.subtotal || it.product_price * it.quantity)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Total Amount */}
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <span className="text-sm font-bold text-[#374011] font-mono">
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
                      className="bg-white rounded-2xl border border-[#d8dec2] p-4 shadow-xs space-y-3"
                    >
                      {/* Card Header: Order ID & Date */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#d8dec2]/60">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#7f8f55]">
                            <span>{order.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.id, order.id)}
                              className="p-1 rounded text-[#374011]/50 hover:text-[#374011]"
                            >
                              {copiedId === order.id ? (
                                <Check className="w-3 h-3 text-[#7f8f55]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-[#374011]/60 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#7f8f55]" />
                            <span>{formatDate(order.created_at)}</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-[#374011] font-mono">
                            {formatINR(order.total_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Products List */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-[#374011]/70 uppercase tracking-wider block">
                          Ordered Products
                        </span>
                        {items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-[#d8dec2]/25 px-2.5 py-1.5 rounded-lg border border-[#d8dec2]/60"
                          >
                            <span className="font-semibold text-[#374011] truncate mr-2">
                              {it.product_name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-[#d8dec2]/70 text-[#374011] font-semibold text-[10px]">
                                Qty: {it.quantity}
                              </span>
                              <span className="text-[#374011] font-bold">
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
      <footer className="mt-auto py-6 border-t border-[#d8dec2] bg-white text-center text-xs text-[#374011]/70">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Dhaara Herbal Hair Oil • Promoter Portal</span>
          <span className="text-[#374011]/60">
            Promoter ID: <strong className="font-mono text-[#374011]">{promoter.promoter_code}</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}

