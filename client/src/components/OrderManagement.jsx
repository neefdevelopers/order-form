import React, { useState, useEffect } from 'react';
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
  IndianRupee
} from 'lucide-react';
import OrderDetailsModal from './OrderDetailsModal';

export default function OrderManagement({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/orders', {
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

  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  // Direct Excel (.xlsx) Export
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/orders/export', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to download Excel file');
      }

      // Extract filename from header or fallback
      let filename = `Orders_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  // Filter orders by search query
  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.promoter_id && o.promoter_id.toLowerCase().includes(q)) ||
      (o.product_name && o.product_name.toLowerCase().includes(q)) ||
      (o.phone_number && o.phone_number.toLowerCase().includes(q)) ||
      (o.city && o.city.toLowerCase().includes(q)) ||
      (o.state && o.state.toLowerCase().includes(q))
    );
  });

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

  return (
    <div className="space-y-6">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Order Management
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh button */}
          <button
            onClick={fetchOrders}
            disabled={loading}
            title="Refresh Orders"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Excel (.xlsx) button */}
          <button
            onClick={handleExportExcel}
            disabled={exporting || orders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Order ID, Customer, Promoter, Product, City..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition shadow-xs"
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

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading orders from database...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {searchQuery ? 'No matching orders found' : 'No orders submitted yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search query or clear the filter.'
              : 'Customer submissions will automatically appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* DESKTOP TABLE VIEW (Full columns with Price & Total)    */}
          {/* ======================================================== */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-3">Order Date</th>
                    <th className="py-3.5 px-3">Promoter ID</th>
                    <th className="py-3.5 px-3">Product</th>
                    <th className="py-3.5 px-3 text-right">Price</th>
                    <th className="py-3.5 px-2 text-center">Qty</th>
                    <th className="py-3.5 px-3 text-right">Total Amount</th>
                    <th className="py-3.5 px-3">Customer Name</th>
                    <th className="py-3.5 px-3">Phone</th>
                    <th className="py-3.5 px-3 min-w-[180px]">Complete Address</th>
                    <th className="py-3.5 px-2">Pincode</th>
                    <th className="py-3.5 px-3">City</th>
                    <th className="py-3.5 px-3">State</th>
                    <th className="py-3.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const priceVal = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
                    const totalVal = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : priceVal * order.quantity;

                    return (
                      <tr 
                        key={order.id} 
                        className="hover:bg-slate-50/60 transition group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {order.id}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 font-medium whitespace-nowrap">
                          {order.promoter_id}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900 max-w-[140px] truncate" title={order.product_name}>
                          {order.product_name}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatINR(priceVal)}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-slate-800">
                          {order.quantity}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                          {formatINR(totalVal)}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {order.customer_name}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {order.phone_number}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[200px]">
                          <span className="line-clamp-2" title={order.complete_address}>
                            {order.complete_address}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-600 whitespace-nowrap font-mono">
                          {order.pincode}
                        </td>
                        <td className="py-3 px-3 text-slate-800 whitespace-nowrap">
                          {order.city}
                        </td>
                        <td className="py-3 px-3 text-slate-800 whitespace-nowrap">
                          {order.state}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition inline-flex items-center gap-1"
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
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                >
                  {/* Header: ID, Date, View button */}
                  <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                    <div>
                      <span className="font-mono text-sm font-bold text-blue-700 block">
                        {order.id}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>

                  {/* Product, Price, Qty & Total Amount */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Product:</span>
                      <span className="font-semibold text-slate-800 text-right truncate max-w-[180px]">
                        {order.product_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Price × Qty:</span>
                      <span className="text-slate-700 font-mono">
                        {formatINR(priceVal)} × {order.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-semibold">
                      <span className="text-slate-700">Total Amount:</span>
                      <span className="text-blue-700 font-bold font-mono text-sm">
                        {formatINR(totalVal)}
                      </span>
                    </div>
                  </div>

                  {/* Customer & Phone */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-50">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Customer</span>
                      <span className="font-medium text-slate-800">{order.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Phone</span>
                      <span className="text-slate-700">{order.phone_number}</span>
                    </div>
                  </div>

                  {/* Promoter ID */}
                  <div className="text-xs">
                    <span className="text-[11px] text-slate-400 block">Promoter ID</span>
                    <span className="font-mono font-medium text-slate-700">{order.promoter_id}</span>
                  </div>

                  {/* Complete Address */}
                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                      Complete Address
                    </span>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {order.complete_address}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-600 font-medium">
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
    </div>
  );
}
