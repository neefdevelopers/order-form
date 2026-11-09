import React from 'react';
import { apiUrl, getImageUrl } from '../config';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  Calendar, 
  Hash, 
  Copy, 
  Check, 
  Camera, 
  ExternalLink, 
  CreditCard, 
  Truck 
} from 'lucide-react';

export default function OrderDetailsModal({ order, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [fullscreenImage, setFullscreenImage] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

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

  let items = [];
  if (Array.isArray(order.items) && order.items.length > 0) {
    items = order.items;
  } else if (order.items_json) {
    try {
      items = JSON.parse(order.items_json);
    } catch (e) {
      items = [];
    }
  }
  if (!items || items.length === 0) {
    items = [{
      product_name: order.product_name,
      product_price: unitPrice,
      quantity: order.quantity,
      subtotal: total
    }];
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#374011]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-[#d8dec2] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#d8dec2] flex items-center justify-between bg-[#d8dec2]/25 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-[#374011] leading-tight">
              Order Details
            </h3>
            <p className="text-xs text-[#374011]/70">
              Submitted on {formattedDate()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#374011]/60 hover:text-[#374011] hover:bg-[#d8dec2]/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Order ID Banner */}
          <div className="p-3 bg-[#d8dec2]/35 border border-[#a9b48a]/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#7f8f55] uppercase tracking-wider block">
                Order ID
              </span>
              <span className="font-mono font-bold text-[#374011] text-sm">
                {order.id}
              </span>
            </div>
            <button
              onClick={handleCopyId}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-[#a9b48a] text-[#374011] hover:bg-[#d8dec2]/30 transition flex items-center gap-1 shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#7f8f55]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          {/* Ordered Products Table */}
          <div className="rounded-xl border border-[#d8dec2] overflow-hidden bg-white shadow-xs">
            <div className="px-3.5 py-2.5 bg-[#d8dec2]/30 border-b border-[#d8dec2] flex items-center justify-between text-xs">
              <span className="font-bold text-[#374011] uppercase tracking-wider text-[11px]">
                Ordered Products ({items.length})
              </span>
              <span className="text-[#374011]/80 font-medium">
                Promoter: <strong className="font-mono text-[#374011]">{order.promoter_id}</strong>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f4f6ee] text-[#374011]/70 uppercase font-semibold text-[10px] border-b border-[#d8dec2]/60">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-2 text-right">Price</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8dec2]/40">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[#d8dec2]/15 transition">
                      <td className="py-2.5 px-3 font-semibold text-[#374011]">
                        {it.product_name || it.name}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[#374011]/80">
                        {formatINR(it.product_price !== undefined ? it.product_price : it.price)}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-[#374011]">
                        {it.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#374011]">
                        {formatINR(it.subtotal !== undefined ? it.subtotal : (it.product_price * it.quantity))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-[#d8dec2]/35 border-t border-[#d8dec2] space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[#374011]/80">
                <span>Items Subtotal ({order.quantity} items):</span>
                <span className="font-mono font-semibold">
                  {formatINR(order.items_amount !== undefined ? order.items_amount : (total - (order.shipping_amount || 0)))}
                </span>
              </div>
              <div className="flex justify-between items-center text-[#374011]/80">
                <span>Shipping Fee:</span>
                <span className="font-mono font-semibold">
                  {(order.shipping_amount || 0) === 0 ? (
                    <span className="text-[#7f8f55] font-bold uppercase text-[10px]">Free Delivery</span>
                  ) : (
                    `+${formatINR(order.shipping_amount)}`
                  )}
                </span>
              </div>
              <div className="pt-1.5 border-t border-[#d8dec2] flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#374011] uppercase tracking-wider">
                  Total Order Amount
                </span>
                <span className="text-base font-bold font-mono text-[#374011]">
                  {formatINR(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="p-4 bg-[#f4f6ee] rounded-xl border border-[#d8dec2] space-y-3">
            <span className="text-[11px] font-bold text-[#7f8f55] uppercase tracking-wider block">
              Customer Contact
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#374011]/60 block text-[11px]">Full Name:</span>
                <span className="font-bold text-[#374011] text-sm">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-[#374011]/60 block text-[11px]">Phone Number:</span>
                <span className="font-bold text-[#374011] text-sm">{order.phone_number}</span>
              </div>
            </div>
          </div>

          {/* Address Details */}
          <div className="p-4 bg-[#f4f6ee] rounded-xl border border-[#d8dec2] space-y-3">
            <span className="text-[11px] font-bold text-[#7f8f55] uppercase tracking-wider block">
              Delivery Address
            </span>

            <div className="bg-white p-3 rounded-lg border border-[#d8dec2] text-xs text-[#374011] whitespace-pre-wrap leading-relaxed">
              {order.complete_address}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div>
                <span className="text-[#374011]/60 block text-[11px]">Pincode:</span>
                <span className="font-semibold text-[#374011]">{order.pincode}</span>
              </div>
              <div>
                <span className="text-[#374011]/60 block text-[11px]">Post Office:</span>
                <span className="font-semibold text-[#374011]">{order.post_office || '—'}</span>
              </div>
              <div>
                <span className="text-[#374011]/60 block text-[11px]">City:</span>
                <span className="font-semibold text-[#374011]">{order.city}</span>
              </div>
              <div>
                <span className="text-[#374011]/60 block text-[11px]">State:</span>
                <span className="font-semibold text-[#374011]">{order.state}</span>
              </div>
            </div>
          </div>

          {/* Payment & Verification Details */}
          <div className="p-4 bg-[#f4f6ee] rounded-xl border border-[#d8dec2] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#7f8f55] uppercase tracking-wider block">
                Payment Details
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                order.payment_method === 'prepaid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {order.payment_method === 'prepaid' ? 'Prepaid (UPI / QR)' : 'Cash on Delivery (COD)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#374011]/60 block text-[11px]">Payment Method:</span>
                <span className="font-semibold text-[#374011]">
                  {order.payment_method === 'prepaid' ? 'Prepaid UPI' : 'Cash on Delivery'}
                </span>
              </div>

              {order.transaction_id && (
                <div>
                  <span className="text-[#374011]/60 block text-[11px]">Transaction / UTR ID:</span>
                  <span className="font-mono font-bold text-[#374011]">{order.transaction_id}</span>
                </div>
              )}
            </div>

            {/* Payment Screenshot Section for prepaid orders */}
            {order.payment_method === 'prepaid' && (
              <div className="mt-2 pt-2 border-t border-[#d8dec2]/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#374011] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#7f8f55]" />
                    <span>Payment Screenshot</span>
                  </span>
                  {order.payment_screenshot_url && !imageError && (
                    <a
                      href={getImageUrl(order.payment_screenshot_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#7f8f55] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Full Size</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {order.payment_screenshot_url ? (
                  imageError ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-800 space-y-1">
                      <p className="font-bold">Screenshot file could not be loaded</p>
                      <p className="text-[11px] text-[#374011]/60 font-mono">
                        Path: {order.payment_screenshot_url}
                      </p>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setFullscreenImage(true)}
                      className="group relative w-full rounded-xl overflow-hidden bg-white border border-[#d8dec2] hover:border-[#7f8f55] flex items-center justify-center p-2 cursor-pointer transition shadow-2xs hover:shadow-sm"
                      title="Click to view full size"
                    >
                      <img
                        src={getImageUrl(order.payment_screenshot_url)}
                        alt="Payment Screenshot"
                        onError={() => setImageError(true)}
                        className="max-h-60 max-w-full object-contain rounded-lg"
                      />
                      <div className="absolute inset-0 bg-[#374011]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-full bg-white/95 text-[#374011] text-xs font-bold shadow-md">
                          Click to Enlarge
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    No payment screenshot was uploaded with this order.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-[#f4f6ee] border-t border-[#d8dec2] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] active:bg-[#5c6a38] transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Fullscreen Screenshot Overlay */}
      {fullscreenImage && order.payment_screenshot_url && (
        <div 
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          onClick={() => setFullscreenImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFullscreenImage(false)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 hover:bg-white text-white hover:text-black transition cursor-pointer"
              title="Close full view"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={getImageUrl(order.payment_screenshot_url)}
              alt="Payment Screenshot Fullscreen"
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
