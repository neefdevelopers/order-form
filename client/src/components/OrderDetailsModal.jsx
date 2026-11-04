import React from 'react';
import { X, User, Phone, MapPin, Package, Calendar, Hash, Copy, Check } from 'lucide-react';

export default function OrderDetailsModal({ order, onClose }) {
  const [copied, setCopied] = React.useState(false);

  if (!order) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  const formattedDate = () => {
    try {
      const d = new Date(order.created_at);
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return order.created_at;
    }
  };

  const unitPrice = order.product_price !== undefined && order.product_price !== null ? order.product_price : 0;
  const total = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount : unitPrice * order.quantity;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Order Details
            </h3>
            <p className="text-xs text-slate-500">
              Submitted on {formattedDate()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Order ID Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                Order ID
              </span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {order.id}
              </span>
            </div>
            <button
              onClick={handleCopyId}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          {/* Product, Price, Quantity & Total Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium block">Product</span>
              <span className="text-sm font-semibold text-slate-800 block mt-0.5 truncate" title={order.product_name}>
                {order.product_name}
              </span>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                <span>Price: <strong className="font-mono">{formatINR(unitPrice)}</strong></span>
                <span>Qty: <strong className="text-slate-800">{order.quantity}</strong></span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="text-[11px] text-blue-600 font-medium block">Total Amount</span>
              <span className="text-base font-bold text-blue-700 block mt-0.5 font-mono">
                {formatINR(total)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Promoter ID: <strong className="font-mono text-slate-700">{order.promoter_id}</strong>
              </span>
            </div>
          </div>

          {/* Customer Details */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Customer Contact
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Full Name:</span>
                <span className="font-semibold text-slate-800 text-sm">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone Number:</span>
                <span className="font-semibold text-slate-800 text-sm">{order.phone_number}</span>
              </div>
            </div>
          </div>

          {/* Address Details */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Delivery Address
            </span>

            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {order.complete_address}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-400 block">Pincode:</span>
                <span className="font-semibold text-slate-800">{order.pincode}</span>
              </div>
              <div>
                <span className="text-slate-400 block">City:</span>
                <span className="font-semibold text-slate-800">{order.city}</span>
              </div>
              <div>
                <span className="text-slate-400 block">State:</span>
                <span className="font-semibold text-slate-800">{order.state}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
