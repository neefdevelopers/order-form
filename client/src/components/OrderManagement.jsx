import React, { useState, useEffect } from 'react';
import { apiUrl, getImageUrl } from '../config';
import { 
  Download, 
  Search,
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  User, 
  MapPin, 
  Package, 
  Eye, 
  FileSpreadsheet, 
  CheckCircle2, 
  IndianRupee,
  Filter,
  X,
  UserCheck,
  Camera,
  CreditCard,
  ExternalLink,
  Users,
  ShoppingBag,
  Truck
} from 'lucide-react';
import OrderDetailsModal from './OrderDetailsModal';

export default function OrderManagement({ 
  token, 
  initialPromoterFilter = '', 
  onClearInitialPromoter 
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtration state (Promoter ID filter + Search Bar)
  const [promoterIdFilter, setPromoterIdFilter] = useState(initialPromoterFilter || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [registeredPromoters, setRegisteredPromoters] = useState([]);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewingScreenshot, setViewingScreenshot] = useState(null); // { url, orderId, customerName }
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchRegisteredPromoters();
  }, []);

  useEffect(() => {
    if (initialPromoterFilter !== undefined && initialPromoterFilter !== null) {
      setPromoterIdFilter(initialPromoterFilter);
    }
  }, [initialPromoterFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/admin/orders'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load orders. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegisteredPromoters = async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/promoters?_t=${Date.now()}`), {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRegisteredPromoters(data);
      }
    } catch (err) {
      console.error('Failed to load registered promoters:', err);
    }
  };

  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  // Distinct promoter IDs from registered promoters, order records, and active filter
  const distinctPromoters = Array.from(
    new Set([
      ...registeredPromoters.map((p) => p.promoter_code),
      ...orders.map((o) => o.promoter_id),
      promoterIdFilter
    ].filter(Boolean))
  ).sort();

  // Filter by Promoter ID and Search Query
  const filteredOrders = orders.filter((o) => {
    // 1. Filter by Promoter ID
    if (promoterIdFilter.trim()) {
      if (!o.promoter_id || o.promoter_id.toLowerCase() !== promoterIdFilter.trim().toLowerCase()) {
        return false;
      }
    }

    // 2. Search query (matches order id, customer name, promoter id, product name, phone, post office, city, state)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches = (
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.promoter_id && o.promoter_id.toLowerCase().includes(q)) ||
        (o.product_name && o.product_name.toLowerCase().includes(q)) ||
        (o.phone_number && o.phone_number.toLowerCase().includes(q)) ||
        (o.post_office && o.post_office.toLowerCase().includes(q)) ||
        (o.city && o.city.toLowerCase().includes(q)) ||
        (o.state && o.state.toLowerCase().includes(q))
      );
      if (!matches) return false;
    }

    return true;
  });

  const isFiltered = Boolean(promoterIdFilter.trim() || searchQuery.trim());

  const clearAllFilters = () => {
    setPromoterIdFilter('');
    setSearchQuery('');
    if (onClearInitialPromoter) onClearInitialPromoter();
  };

  // Direct Excel (.xlsx) Export — Exports ONLY filtered orders if filter is applied!
  const handleExportExcel = async () => {
    if (filteredOrders.length === 0) return;
    setExporting(true);

    try {
      let res;
      if (isFiltered) {
        // Export ONLY the filtered data
        const filteredIds = filteredOrders.map((o) => o.id);
        res = await fetch(apiUrl('/api/admin/orders/export'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            ids: filteredIds,
            promoter_id: promoterIdFilter.trim() || undefined
          })
        });
      } else {
        // Export all orders
        res = await fetch(apiUrl('/api/admin/orders/export'), {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (!res.ok) {
        throw new Error('Failed to download Excel file');
      }

      let filename = isFiltered
        ? `Orders_Filtered_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Orders_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="?([^"]+)"?/.exec(disposition);
        if (matches && matches[1]) filename = matches[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Dynamic summary metrics calculated strictly from filteredOrders
  // When filters (Order ID, Promoter ID, Search) change, these recalculate immediately!
  const totalOrdersCount = filteredOrders.length;

  const uniqueCustomersCount = new Set(
    filteredOrders
      .map((o) => (o.phone_number || o.customer_name || '').trim().toLowerCase())
      .filter(Boolean)
  ).size;

  const totalProductsCount = filteredOrders.reduce((sum, o) => {
    if (o.quantity !== undefined && o.quantity !== null && !isNaN(Number(o.quantity))) {
      return sum + Number(o.quantity);
    }
    let items = [];
    if (Array.isArray(o.items) && o.items.length > 0) {
      items = o.items;
    } else if (o.items_json) {
      try {
        items = JSON.parse(o.items_json);
      } catch (e) {
        items = [];
      }
    }
    if (items.length > 0) {
      return sum + items.reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
    }
    return sum + 1;
  }, 0);

  const totalCodOrdersCount = filteredOrders.filter(
    (o) => (o.payment_method || 'cod').toLowerCase() === 'cod'
  ).length;

  const totalPrepaidOrdersCount = filteredOrders.filter(
    (o) => (o.payment_method || '').toLowerCase() === 'prepaid'
  ).length;

  const totalAmountGenerated = filteredOrders.reduce((sum, o) => {
    const val = o.total_amount !== undefined && o.total_amount !== null
      ? Number(o.total_amount)
      : (Number(o.product_price) || 0) * (Number(o.quantity) || 1);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#374011]">
            Order Management
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh button */}
          <button
            onClick={fetchOrders}
            disabled={loading}
            title="Refresh Orders"
            className="p-2.5 rounded-xl border border-[#d8dec2] bg-white text-[#374011] hover:bg-[#d8dec2]/30 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Excel (.xlsx) button - Exports filtered data when filtered */}
          <button
            onClick={handleExportExcel}
            disabled={exporting || filteredOrders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold bg-[#7f8f55] hover:bg-[#6f7e49] active:bg-[#5c6a38] transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">
                  {isFiltered 
                    ? `Export Filtered Orders (${filteredOrders.length}) (.xlsx)` 
                    : 'Export Excel (.xlsx)'}
                </span>
                <span className="inline sm:hidden">
                  {isFiltered ? `Export (${filteredOrders.length})` : 'Export .xlsx'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Promoter Orders Focus Banner */}
      {promoterIdFilter && (
        <div className="p-4 rounded-2xl bg-[#d8dec2]/40 border border-[#a9b48a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3 text-[#374011]">
            <div className="w-9 h-9 rounded-xl bg-[#7f8f55] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#374011] leading-snug">
                Orders for Promoter: <span className="font-mono text-[#374011] bg-white border border-[#a9b48a] px-2 py-0.5 rounded-md">{promoterIdFilter}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={exporting || filteredOrders.length === 0}
              title={`Download Excel (.xlsx) file containing only ${promoterIdFilter} orders`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#7f8f55] text-white font-semibold hover:bg-[#6f7e49] active:bg-[#5c6a38] transition shadow-xs disabled:opacity-50 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export {promoterIdFilter} Orders (.xlsx)</span>
              <span className="inline sm:hidden">Export .xlsx</span>
            </button>
            <button
              onClick={() => {
                setPromoterIdFilter('');
                if (onClearInitialPromoter) onClearInitialPromoter();
              }}
              title="Show all orders from all promoters"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-[#d8dec2] bg-white text-[#374011] font-medium hover:bg-[#d8dec2]/40 transition shadow-xs text-xs"
            >
              <X className="w-3.5 h-3.5 text-[#374011]/70" />
              <span>Show All</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FILTRATION: PROMOTER ID & SEARCH BAR                    */}
      {/* ======================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-[#d8dec2] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Filter by Promoter ID */}
          <div>
            <label 
              htmlFor="filter-promoter-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[#374011]/80 mb-1"
            >
              Filter by Promoter ID
            </label>
            <div className="relative">
              <select
                id="filter-promoter-select"
                value={promoterIdFilter}
                onChange={(e) => setPromoterIdFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#d8dec2] text-xs font-mono text-[#374011] bg-white focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
              >
                <option value="">All Promoter IDs</option>
                {distinctPromoters.map((pid) => {
                  const pMatch = registeredPromoters.find((p) => p.promoter_code && p.promoter_code.toLowerCase() === pid.toLowerCase());
                  return (
                    <option key={pid} value={pid}>
                      {pid}{pMatch?.name ? ` — ${pMatch.name}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 2. Search Bar */}
          <div>
            <label 
              htmlFor="orders-search-input"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[#374011]/80 mb-1"
            >
              Search Orders
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                id="orders-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer, phone, order ID, product, city..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-[#d8dec2] text-xs text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#374011]/40 hover:text-[#374011] transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Summary & Reset */}
        {isFiltered && (
          <div className="pt-2 border-t border-[#d8dec2]/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-[#374011]">
              <Filter className="w-3.5 h-3.5 text-[#7f8f55]" />
              <span>
                Showing <strong>{filteredOrders.length}</strong> of {orders.length} orders
              </span>
              {promoterIdFilter && (
                <span className="px-2 py-0.5 rounded-full bg-[#d8dec2]/50 text-[#374011] border border-[#a9b48a] font-mono text-[11px]">
                  Promoter: {promoterIdFilter}
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-full bg-[#d8dec2]/40 text-[#374011] border border-[#d8dec2] text-[11px]">
                  Search: "{searchQuery}"
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 6-METRIC DYNAMIC SUMMARY STATS CARDS                    */}
      {/* Dynamically re-calculated based on filteredOrders       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Customers */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d8dec2] shadow-xs flex items-center justify-between transition hover:border-[#a9b48a]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#374011]/70">
              Total Customer
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#374011] mt-1 font-mono">
              {loading ? '—' : uniqueCustomersCount}
            </p>
            <p className="text-[10px] text-[#374011]/50 mt-0.5">
              Unique buyers
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#7f8f55]/15 text-[#374011]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Total Orders */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d8dec2] shadow-xs flex items-center justify-between transition hover:border-[#a9b48a]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#374011]/70">
              Total Order
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#374011] mt-1 font-mono">
              {loading ? '—' : totalOrdersCount}
            </p>
            <p className="text-[10px] text-[#374011]/50 mt-0.5">
              {isFiltered ? 'Matching filter' : 'All orders'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#7f8f55]/20 text-[#7f8f55]">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Total Products */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d8dec2] shadow-xs flex items-center justify-between transition hover:border-[#a9b48a]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#374011]/70">
              Total Product
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#374011] mt-1 font-mono">
              {loading ? '—' : totalProductsCount}
            </p>
            <p className="text-[10px] text-[#374011]/50 mt-0.5">
              Units ordered
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100/70 text-amber-800">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Total COD Orders */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d8dec2] shadow-xs flex items-center justify-between transition hover:border-[#a9b48a]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#374011]/70">
              Total COD Order
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#374011] mt-1 font-mono">
              {loading ? '—' : totalCodOrdersCount}
            </p>
            <p className="text-[10px] text-[#374011]/50 mt-0.5">
              Cash on delivery
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100/70 text-orange-800">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* 5. Prepaid Orders */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d8dec2] shadow-xs flex items-center justify-between transition hover:border-[#a9b48a]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#374011]/70">
              Prepaid Order
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#374011] mt-1 font-mono">
              {loading ? '—' : totalPrepaidOrdersCount}
            </p>
            <p className="text-[10px] text-[#374011]/50 mt-0.5">
              Online / UPI
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100/80 text-emerald-800">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* 6. Total Amount Generated */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#d8dec2] shadow-xs flex items-center justify-between transition hover:border-[#a9b48a]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#374011]/70">
              Total Amount
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#374011] mt-1 font-mono">
              {loading ? '—' : formatINR(totalAmountGenerated)}
            </p>
            <p className="text-[10px] text-[#374011]/50 mt-0.5">
              {isFiltered ? 'Filtered revenue' : 'Total revenue'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#7f8f55]/15 text-[#374011]">
            <IndianRupee className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 text-[#7f8f55] animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#374011]/70 font-medium">Loading orders from database...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#d8dec2] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f4f6ee] text-[#7f8f55] mx-auto flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#374011]">
            {isFiltered ? 'No orders match your filter or search criteria' : 'No orders submitted yet'}
          </h3>
          <p className="text-xs text-[#374011]/70 mt-1 max-w-sm mx-auto">
            {isFiltered
              ? 'Try modifying your Promoter ID selection or search terms.'
              : 'Customer submissions will automatically appear here.'}
          </p>
          {isFiltered && (
            <button
              onClick={clearAllFilters}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d8dec2]/50 hover:bg-[#d8dec2] text-xs font-medium text-[#374011] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Show All Orders</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* DESKTOP TABLE VIEW (Full columns with Price & Total)    */}
          {/* ======================================================== */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#d8dec2] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d8dec2]/40 border-b border-[#d8dec2] text-[#374011] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-3">Order Date</th>
                    <th className="py-3.5 px-3">Promoter ID</th>
                    <th className="py-3.5 px-3">Product</th>
                    <th className="py-3.5 px-3 text-right">Price</th>
                    <th className="py-3.5 px-2 text-center">Qty</th>
                    <th className="py-3.5 px-3 text-right">Total Amount</th>
                    <th className="py-3.5 px-3">Payment</th>
                    <th className="py-3.5 px-3">Customer Name</th>
                    <th className="py-3.5 px-3">Phone</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Complete Address</th>
                    <th className="py-3.5 px-2">Pincode</th>
                    <th className="py-3.5 px-3">Post Office</th>
                    <th className="py-3.5 px-3">City</th>
                    <th className="py-3.5 px-3">State</th>
                    <th className="py-3.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8dec2]/50">
                  {filteredOrders.map((order) => {
                    const priceVal = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
                    const totalVal = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : priceVal * order.quantity;

                    return (
                      <tr 
                        key={order.id} 
                        className="hover:bg-[#d8dec2]/15 transition group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#7f8f55] whitespace-nowrap">
                          {order.id}
                        </td>
                        <td className="py-3 px-3 text-[#374011]/80 whitespace-nowrap">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="py-3 px-3 font-mono text-[#374011] font-medium whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setPromoterIdFilter(order.promoter_id)}
                            title={`Filter orders by promoter ${order.promoter_id}`}
                            className="hover:text-[#7f8f55] hover:underline inline-flex items-center gap-1 group/p font-semibold"
                          >
                            <span>{order.promoter_id}</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-medium text-[#374011] max-w-[180px]">
                          {order.items && order.items.length > 1 ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-[#374011]">
                                {order.items.length} Products ({order.quantity} items)
                              </span>
                              <span className="text-[11px] text-[#374011]/70 truncate" title={order.product_name}>
                                {order.product_name}
                              </span>
                            </div>
                          ) : (
                            <span className="truncate block" title={order.product_name}>
                              {order.product_name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#374011]/80 whitespace-nowrap">
                          {order.items && order.items.length > 1 ? (
                            <span className="text-xs text-[#374011]/60">Multiple</span>
                          ) : (
                            formatINR(priceVal)
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-[#374011]">
                          {order.quantity}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#374011] whitespace-nowrap">
                          {formatINR(totalVal)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              order.payment_method === 'prepaid'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {order.payment_method === 'prepaid' ? 'Prepaid' : 'COD'}
                            </span>
                            {order.payment_screenshot_url && (
                              <button
                                type="button"
                                onClick={() => setViewingScreenshot({
                                  url: getImageUrl(order.payment_screenshot_url),
                                  orderId: order.id,
                                  customerName: order.customer_name
                                })}
                                title="Click to view payment screenshot"
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#7f8f55] text-white hover:bg-[#6f7e49] transition shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Camera className="w-3 h-3" />
                                <span>SS</span>
                              </button>
                            )}
                          </div>
                          {order.shipping_amount !== undefined && order.shipping_amount > 0 && (
                            <span className="text-[10px] text-[#374011]/60 block mt-0.5">
                              (incl. ₹{order.shipping_amount} ship)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#374011] whitespace-nowrap">
                          {order.customer_name}
                        </td>
                        <td className="py-3 px-3 text-[#374011]/80 whitespace-nowrap">
                          {order.phone_number}
                        </td>
                        <td className="py-3 px-3 text-[#374011]/80 max-w-[200px]">
                          <span className="line-clamp-2" title={order.complete_address}>
                            {order.complete_address}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[#374011]/80 whitespace-nowrap font-mono">
                          {order.pincode}
                        </td>
                        <td className="py-3 px-3 text-[#374011] whitespace-nowrap font-medium">
                          {order.post_office || '—'}
                        </td>
                        <td className="py-3 px-3 text-[#374011] whitespace-nowrap">
                          {order.city}
                        </td>
                        <td className="py-3 px-3 text-[#374011] whitespace-nowrap">
                          {order.state}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#374011] bg-[#d8dec2]/60 hover:bg-[#d8dec2] transition inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* MOBILE STACKED CARD VIEW (Adaptive, no horizontal scroll)*/}
          {/* ======================================================== */}
          <div className="block md:hidden space-y-4">
            {filteredOrders.map((order) => {
              const priceVal = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
              const totalVal = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : priceVal * order.quantity;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-[#d8dec2] p-4 shadow-xs space-y-3"
                >
                  {/* Header: ID, Date, View button */}
                  <div className="flex items-start justify-between pb-2 border-b border-[#d8dec2]/60">
                    <div>
                      <span className="font-mono text-sm font-bold text-[#7f8f55] block">
                        {order.id}
                      </span>
                      <span className="text-[11px] text-[#374011]/60">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#374011] bg-[#d8dec2]/60 hover:bg-[#d8dec2] transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>

                  {/* Product, Price, Qty & Total Amount */}
                  <div className="bg-[#d8dec2]/25 p-3 rounded-xl border border-[#d8dec2]/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#374011]/70">Products:</span>
                      <span className="font-semibold text-[#374011] text-right truncate max-w-[190px]">
                        {order.items && order.items.length > 1
                          ? `${order.items.length} Products (${order.quantity} items)`
                          : order.product_name}
                      </span>
                    </div>
                    {order.items && order.items.length === 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#374011]/70">Price × Qty:</span>
                        <span className="text-[#374011] font-mono">
                          {formatINR(priceVal)} × {order.quantity}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-[#d8dec2] font-semibold">
                      <span className="text-[#374011]">Total Amount:</span>
                      <div className="text-right">
                        <span className="text-[#374011] font-bold font-mono text-sm block">
                          {formatINR(totalVal)}
                        </span>
                        {order.shipping_amount !== undefined && order.shipping_amount > 0 && (
                          <span className="text-[10px] text-[#374011]/60 block font-normal">
                            (incl. ₹{order.shipping_amount} ship)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment Method & SS */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#d8dec2]/60 text-xs">
                      <span className="text-[#374011]/70 font-medium">Payment:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.payment_method === 'prepaid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {order.payment_method === 'prepaid' ? 'Prepaid' : 'COD'}
                        </span>
                        {order.payment_screenshot_url && (
                          <button
                            type="button"
                            onClick={() => setViewingScreenshot({
                              url: getImageUrl(order.payment_screenshot_url),
                              orderId: order.id,
                              customerName: order.customer_name
                            })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#7f8f55] text-white hover:bg-[#6f7e49] transition cursor-pointer"
                          >
                            <Camera className="w-3 h-3" />
                            <span>View SS</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Phone */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#d8dec2]/40">
                    <div>
                      <span className="text-[11px] text-[#374011]/60 block">Customer</span>
                      <span className="font-semibold text-[#374011]">{order.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#374011]/60 block">Phone</span>
                      <span className="text-[#374011] font-medium">{order.phone_number}</span>
                    </div>
                  </div>

                  {/* Promoter ID */}
                  <div className="text-xs">
                    <span className="text-[11px] text-[#374011]/60 block">Promoter ID</span>
                    <button
                      type="button"
                      onClick={() => setPromoterIdFilter(order.promoter_id)}
                      title={`Filter by promoter ${order.promoter_id}`}
                      className="font-mono font-bold text-[#7f8f55] hover:text-[#5c6a38] hover:underline"
                    >
                      {order.promoter_id}
                    </button>
                  </div>

                  {/* Complete Address */}
                  <div className="text-xs bg-[#f4f6ee] p-2.5 rounded-lg border border-[#d8dec2]/70">
                    <span className="text-[10px] uppercase font-semibold text-[#374011]/70 block mb-0.5">
                      Complete Address
                    </span>
                    <p className="text-[#374011] leading-relaxed whitespace-pre-wrap">
                      {order.complete_address}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-[#374011] font-medium">
                      <span>Pin: {order.pincode}</span>
                      <span>City: {order.city}</span>
                      <span>State: {order.state}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Dedicated Screenshot Viewer Modal */}
      {viewingScreenshot && (
        <div 
          className="fixed inset-0 z-50 bg-[#374011]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setViewingScreenshot(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-[#d8dec2] w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#f4f6ee] border-b border-[#d8dec2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#d8dec2]/50 text-[#7f8f55] flex items-center justify-center border border-[#a9b48a]">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#374011]">
                    Payment Screenshot • {viewingScreenshot.orderId}
                  </h4>
                  <p className="text-[11px] text-[#374011]/70">
                    Customer: {viewingScreenshot.customerName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={viewingScreenshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg border border-[#d8dec2] bg-white hover:bg-[#f4f6ee] text-[#374011] text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                  title="Open full resolution in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#7f8f55]" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewingScreenshot(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Screenshot Display Area */}
            <div className="p-3 sm:p-4 bg-slate-900/5 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={viewingScreenshot.url}
                alt="Payment Screenshot"
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md border border-[#d8dec2]"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  const errDiv = document.createElement('div');
                  errDiv.className = 'p-8 text-center text-xs text-red-600 space-y-2';
                  errDiv.innerHTML = '<p class="font-bold">Screenshot image could not be loaded</p><p class="text-[11px] text-[#374011]/60">The image file may have been moved or removed from the server.</p>';
                  e.target.parentNode.appendChild(errDiv);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
