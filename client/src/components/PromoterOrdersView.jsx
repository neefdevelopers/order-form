import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
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
  Hash,
  X,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Layers
} from 'lucide-react';
import OrderDetailsModal from './OrderDetailsModal';

export default function PromoterOrdersView({ promoter, token, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    fetchPromoterOrders();
  }, [promoter.promoter_code]);

  const fetchPromoterOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/orders?promoter_id=${encodeURIComponent(promoter.promoter_code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load orders for this promoter');
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

  // Search filtration
  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.product_name && o.product_name.toLowerCase().includes(q)) ||
      (o.phone_number && o.phone_number.toLowerCase().includes(q)) ||
      (o.city && o.city.toLowerCase().includes(q)) ||
      (o.state && o.state.toLowerCase().includes(q)) ||
      (o.complete_address && o.complete_address.toLowerCase().includes(q))
    );
  });

  // Export specifically for this promoter
  const handleExportExcel = async () => {
    if (orders.length === 0) return;
    setExporting(true);

    try {
      const res = await fetch(`/api/admin/orders/export?promoter_id=${encodeURIComponent(promoter.promoter_code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to download Excel file');
      }

      let filename = `Orders_${promoter.promoter_code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      console.error('Export error:', err);
      alert('Failed to export orders. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Metrics summary
  const totalRevenue = orders.reduce((sum, o) => {
    const priceVal = o.product_price !== undefined && o.product_price !== null ? o.product_price : 0;
    const totalVal = o.total_amount !== undefined && o.total_amount !== null ? o.total_amount : priceVal * o.quantity;
    return sum + Number(totalVal || 0);
  }, 0);

  const totalQuantity = orders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Promoters</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                Promoter Orders
              </h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                {promoter.promoter_code}
              </span>
            </div>
            {promoter.name && (
              <p className="text-xs text-slate-500 mt-0.5">
                {promoter.name}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls: Refresh & Export */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={fetchPromoterOrders}
            disabled={loading}
            title="Refresh Orders"
            className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting || orders.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>Exporting...</span>
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Export {promoter.promoter_code} Orders (.xlsx)</span>
                <span className="inline sm:hidden">Export .xlsx</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Orders
            </span>
            <span className="text-lg font-bold text-slate-900">
              {orders.length}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Items Sold
            </span>
            <span className="text-lg font-bold text-slate-900">
              {totalQuantity}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Revenue
            </span>
            <span className="text-lg font-bold text-emerald-700">
              {formatINR(totalRevenue)}
            </span>
          </div>
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
          placeholder="Search by customer, phone, product, city..."
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

      {/* Orders List / Table */}
      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading promoter orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {searchQuery ? 'No matching orders found' : `No orders for Promoter ${promoter.promoter_code}`}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery 
              ? 'Try a different search term.' 
              : `Orders placed by customers using Promoter ID "${promoter.promoter_code}" will appear here.`}
          </p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* DESKTOP TABLE VIEW                                       */}
          {/* ======================================================== */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-3">Date</th>
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
                      <tr key={order.id} className="hover:bg-slate-50/60 transition group">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {order.id}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(order.created_at)}
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
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
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
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="View Full Order Details"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition inline-flex items-center gap-1 text-[11px] font-medium px-2"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
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
          {/* MOBILE STACKED CARDS VIEW                                */}
          {/* ======================================================== */}
          <div className="block md:hidden space-y-3.5">
            {filteredOrders.map((order) => {
              const priceVal = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
              const totalVal = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : priceVal * order.quantity;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                >
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

                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{order.product_name}</span>
                      <span className="font-bold text-slate-700">Qty: {order.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/50">
                      <span>Unit Price: {formatINR(priceVal)}</span>
                      <span className="font-bold text-emerald-700 text-sm font-mono">
                        Total: {formatINR(totalVal)}
                      </span>
                    </div>
                  </div>

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

                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                      Address
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

      {/* Detail Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

