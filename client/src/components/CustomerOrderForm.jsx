import React, { useState, useEffect, useRef } from 'react';
import { apiUrl, getImageUrl } from '../config';
import { 
  Package, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  ShoppingBag, 
  User, 
  Phone, 
  MapPin, 
  Hash,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
  Printer,
  ChevronUp,
  X
} from 'lucide-react';

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

export default function CustomerOrderForm() {
  // Step state: 1 = Product Details, 2 = Customer Address Details, 3 = Order Success
  const [step, setStep] = useState(1);

  // Available active products from backend
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');

  // Step 1 fields
  const [promoterId, setPromoterId] = useState('');
  const [validatingPromoter, setValidatingPromoter] = useState(false);
  const [promoterVerified, setPromoterVerified] = useState(null);

  // Selected products for the order: array of { product_id, quantity }
  const [selectedItems, setSelectedItems] = useState([]);

  // Floating Order Widget Popover state
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // Step 2 fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [completeAddress, setCompleteAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');

  // Validation errors
  const [errors, setErrors] = useState({});

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderResult, setOrderResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Toast feedback state: { message, type: 'success' | 'error' | 'info' }
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch active products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    setProductsError('');
    try {
      const res = await fetch(apiUrl('/api/products'));
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setProductsError('Unable to load available products. Please refresh the page.');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Add a product to the selected list
  const handleAddItem = (pid) => {
    const idNum = parseInt(pid, 10);
    if (!idNum) return;
    const prod = products.find((p) => p.id === idNum);
    setSelectedItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.product_id === idNum);
      if (existingIndex >= 0) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product_id: idNum, quantity: 1 }];
    });
    setErrors((prev) => ({ ...prev, items: null }));
    if (prod) {
      showToast(`Added "${prod.name}" to cart`, 'success');
    }
  };

  // Update quantity of a selected product (reducing to 0 removes it)
  const handleUpdateQuantity = (pid, newQty) => {
    const qtyVal = parseInt(newQty, 10);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      handleRemoveItem(pid);
      return;
    }
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.product_id === pid
          ? { ...item, quantity: Math.max(1, qtyVal) }
          : item
      )
    );
  };

  // Remove a product from the selected list
  const handleRemoveItem = (pid) => {
    const prod = products.find((p) => p.id === pid);
    setSelectedItems((prev) => prev.filter((item) => item.product_id !== pid));
    if (prod) {
      showToast(`Removed "${prod.name}" from cart`, 'info');
    }
  };

  // Calculate items with full details, subtotals, and overall order total
  const itemsWithDetails = selectedItems
    .map((item) => {
      const prod = products.find((p) => p.id === item.product_id);
      if (!prod) return null;
      const unitPrice = Number(prod.price || 0);
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const subtotal = unitPrice * qty;
      return {
        ...item,
        name: prod.name,
        price: unitPrice,
        image_url: prod.image_url,
        quantity: qty,
        subtotal
      };
    })
    .filter(Boolean);

  const totalAmount = itemsWithDetails.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQuantity = itemsWithDetails.reduce((sum, item) => sum + item.quantity, 0);

  // Format currency in Indian Rupees (₹)
  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  // Hover handlers for floating widget
  const handleFloatingMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsSummaryExpanded(true);
  };

  const handleFloatingMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // 260ms delay ensures seamless cursor transit between trigger pill and popover body
    hoverTimeoutRef.current = setTimeout(() => {
      setIsSummaryExpanded(false);
    }, 260);
  };

  const handleFloatingClick = (e) => {
    e.stopPropagation();
    setIsSummaryExpanded((prev) => !prev);
  };

  // Close floating popover when clicking anywhere outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const container = document.getElementById('floating-order-summary-container');
      if (container && !container.contains(e.target)) {
        setIsSummaryExpanded(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Validate Promoter ID against backend
  const validatePromoterAsync = async (idToValidate) => {
    const cleanId = (idToValidate || promoterId).trim();
    if (!cleanId) {
      setErrors((prev) => ({ ...prev, promoterId: 'Promoter ID is required' }));
      return false;
    }
    setValidatingPromoter(true);
    try {
      const res = await fetch(apiUrl(`/api/promoters/validate/${encodeURIComponent(cleanId)}`));
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrors((prev) => ({
          ...prev,
          promoterId: data.error || 'Invalid Promoter ID. Only authorized promoters can place orders.'
        }));
        setPromoterVerified(null);
        return false;
      }
      setPromoterVerified(data.promoter);
      setErrors((prev) => ({ ...prev, promoterId: null }));
      showToast(`Promoter verified: ${data.promoter.name || data.promoter.promoter_id}`, 'success');
      return true;
    } catch (err) {
      console.error(err);
      setErrors((prev) => ({
        ...prev,
        promoterId: 'Unable to verify Promoter ID. Please check your connection.'
      }));
      return false;
    } finally {
      setValidatingPromoter(false);
    }
  };

  // Step 1 Validation -> Proceed to Step 2
  const handleNext = async (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    if (!promoterId.trim()) {
      newErrors.promoterId = 'Promoter ID is required';
    }
    if (itemsWithDetails.length === 0) {
      newErrors.items = 'Please select at least one product to order';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // If promoterId is missing, scroll to top
      if (newErrors.promoterId) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const isValid = await validatePromoterAsync(promoterId);
    if (!isValid) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setErrors({});
    setIsSummaryExpanded(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lookup India Post API to auto-fill City and State from 6-digit Pincode
  const handlePincodeLookup = async (pinValue) => {
    const cleanPin = (pinValue || '').replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      return;
    }

    setLoadingPincode(true);

    try {
      let res = await fetch(apiUrl(`/api/pincode/${cleanPin}`));
      let data = await res.json();

      if (!res.ok || !data.success) {
        try {
          const directRes = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
          const directData = await directRes.json();
          if (Array.isArray(directData) && directData[0]?.Status === 'Success' && directData[0]?.PostOffice?.length > 0) {
            const po = directData[0].PostOffice[0];
            data = {
              success: true,
              city: po.District || po.Block || po.Name,
              state: po.State
            };
          }
        } catch (e) {
          // ignore fallback error
        }
      }

      if (data && data.success) {
        if (data.city) setCity(data.city);
        if (data.state) setStateName(data.state);
        setErrors((prev) => ({ ...prev, city: null, stateName: null, pincode: null }));
        showToast(`Auto-detected ${data.city || 'City'}, ${data.state || 'State'}`);
      }
    } catch (err) {
      console.error('Error in pincode lookup:', err);
    } finally {
      setLoadingPincode(false);
    }
  };

  // Step 2 Return to Step 1 without losing any entered data
  const handleBack = () => {
    setErrors({});
    setSubmitError('');
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 Make Order Submission
  const handleSubmitOrder = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;

    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    }
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone Number is required';
    } else if (phoneNumber.trim().length < 7) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }
    if (!completeAddress.trim()) {
      newErrors.completeAddress = 'Complete Address is required';
    }
    if (!pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    }
    if (!city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!stateName.trim()) {
      newErrors.stateName = 'State is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitError('');
    setSubmitting(true);

    try {
      const payload = {
        promoter_id: promoterId.trim(),
        items: itemsWithDetails.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity
        })),
        customer_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        complete_address: completeAddress.trim(),
        pincode: pincode.trim(),
        city: city.trim(),
        state: stateName.trim()
      };

      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      setOrderResult({
        orderId: data.orderId,
        orderDate: data.orderDate,
        items: itemsWithDetails,
        totalAmount: data.totalAmount !== undefined ? data.totalAmount : totalAmount,
        totalQuantity: data.quantity !== undefined ? data.quantity : totalQuantity,
        customerName: payload.customer_name,
        phoneNumber: payload.phone_number,
        completeAddress: payload.complete_address,
        pincode: payload.pincode,
        city: payload.city,
        state: payload.state,
        promoterId: payload.promoter_id
      });

      setIsSummaryExpanded(false);
      setStep(3); // Success window
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setSubmitError(err.message || 'An error occurred while placing the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form to place another order
  const handleReset = () => {
    setStep(1);
    setPromoterId('');
    setPromoterVerified(null);
    setSelectedItems([]);
    setFullName('');
    setPhoneNumber('');
    setCompleteAddress('');
    setPincode('');
    setCity('');
    setStateName('');
    setErrors({});
    setSubmitError('');
    setOrderResult(null);
    setCopied(false);
    setIsSummaryExpanded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyOrderId = () => {
    if (orderResult?.orderId) {
      navigator.clipboard.writeText(orderResult.orderId);
      setCopied(true);
      showToast('Order ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans relative pb-28 sm:pb-32">
      
      {/* Toast Feedback Notification (Positioned safe above floating widget) */}
      {toast && (
        <div className="fixed bottom-24 right-5 sm:bottom-24 sm:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-medium shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-[940px] mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <ShoppingBag className="w-4.5 h-4.5" />
            </div>
            <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
              Product Ordering System
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified & Secure</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[940px] w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6">
        
        {/* Step Progress Indicator (Two-Step Checkout) */}
        {step < 3 && (
          <div className="mb-5 sm:mb-6 max-w-sm mx-auto px-2">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              {/* Step 1 Node */}
              <div className="flex items-center gap-2">
                <div 
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                    step === 1 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs' 
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {step > 1 ? <Check className="w-4 h-4 stroke-[2.5]" /> : '1'}
                </div>
                <span className={`text-xs sm:text-sm font-bold tracking-tight whitespace-nowrap ${step === 1 ? 'text-blue-700' : 'text-slate-700'}`}>
                  1. Product Details
                </span>
              </div>

              {/* Connecting Line */}
              <div className="w-10 sm:w-16 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-blue-600 transition-all duration-300 ${
                    step > 1 ? 'w-full' : 'w-0'
                  }`}
                />
              </div>

              {/* Step 2 Node */}
              <div className="flex items-center gap-2">
                <div 
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                    step === 2 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs' 
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  2
                </div>
                <span className={`text-xs sm:text-sm font-bold tracking-tight whitespace-nowrap ${step === 2 ? 'text-blue-700' : 'text-slate-400'}`}>
                  2. Address Details
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Global Catalog Error Alert */}
        {productsError && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs shadow-2xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold">{productsError}</p>
              <button
                type="button"
                onClick={fetchProducts}
                className="mt-1 font-bold text-red-800 underline hover:no-underline"
              >
                Click here to retry
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1: PRODUCT DETAILS                                */}
        {/* ======================================================== */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4 sm:space-y-5">
            
            {/* Promoter ID Section */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="promoter-id" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Promoter ID <span className="text-red-500">*</span></span>
                </label>
                {promoterVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Verified: {promoterVerified.name || promoterVerified.promoter_id}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    id="promoter-id"
                    type="text"
                    value={promoterId}
                    onChange={(e) => {
                      setPromoterId(e.target.value);
                      if (errors.promoterId) setErrors((prev) => ({ ...prev, promoterId: null }));
                      setPromoterVerified(null);
                    }}
                    onBlur={() => {
                      if (promoterId.trim() && !promoterVerified && !validatingPromoter) {
                        validatePromoterAsync(promoterId);
                      }
                    }}
                    placeholder="Enter your Promoter ID (e.g. PR-1001)"
                    className={`h-11 w-full pl-10 pr-3.5 rounded-lg border text-sm text-slate-900 bg-slate-50/50 hover:bg-white placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition ${
                      errors.promoterId 
                        ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                        : promoterVerified
                        ? 'border-emerald-300 focus:ring-emerald-100 focus:border-emerald-500'
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => validatePromoterAsync(promoterId)}
                  disabled={validatingPromoter || !promoterId.trim()}
                  className="px-4 h-11 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {validatingPromoter ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : promoterVerified ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span>Verify</span>
                  )}
                </button>
              </div>

              {errors.promoterId ? (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errors.promoterId}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Authorized promoter ID is required to place your order.
                </p>
              )}
            </div>

            {/* Product Selection Section */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Select Products <span className="text-red-500">*</span></span>
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  {products.length} {products.length === 1 ? 'product' : 'products'} available
                </span>
              </div>

              {loadingProducts ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-64 rounded-xl bg-white border border-slate-200/80 p-3.5 animate-pulse space-y-3">
                      <div className="w-full h-32 bg-slate-100 rounded-lg" />
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-5 bg-slate-100 rounded w-1/3" />
                      <div className="h-10 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
                  No active products are available right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {products.map((prod) => {
                    const existing = selectedItems.find((it) => it.product_id === prod.id);
                    const isSelected = !!existing;

                    return (
                      <div 
                        key={prod.id} 
                        className={`flex flex-col justify-between h-full rounded-xl border transition-all duration-200 p-3.5 sm:p-4 bg-white ${
                          isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10 shadow-xs' 
                            : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        <div>
                          {/* Product Image Container (Compact height, clear display) */}
                          <div className="w-full h-32 sm:h-36 rounded-lg bg-slate-50/80 border border-slate-100 flex items-center justify-center p-2 mb-2.5 overflow-hidden group">
                            <img
                              src={getImageUrl(prod.image_url)}
                              alt={prod.name}
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                              }}
                            />
                          </div>

                          {/* Product Name */}
                          <div className="h-10 mb-1 flex items-start">
                            <h3 
                              className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2" 
                              title={prod.name}
                            >
                              {prod.name}
                            </h3>
                          </div>

                          {/* Price in INR */}
                          <div className="h-6 flex items-baseline gap-1 mb-2.5">
                            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                              {formatINR(prod.price)}
                            </span>
                            <span className="text-xs text-slate-400 font-normal">/ unit</span>
                          </div>
                        </div>

                        {/* Action Slot & Subtotal */}
                        <div className="pt-2.5 border-t border-slate-100 mt-auto">
                          {isSelected ? (
                            <div className="space-y-1.5">
                              {/* Subtotal calculation for each selected product */}
                              <div className="flex items-center justify-between text-xs px-0.5 text-slate-600">
                                <span className="font-medium">Subtotal:</span>
                                <span className="font-mono font-bold text-blue-700">
                                  {formatINR(prod.price * existing.quantity)}
                                </span>
                              </div>

                              {/* Stepper with plus and minus buttons */}
                              <div className="w-full h-9.5 flex items-center justify-between border border-blue-500/40 rounded-lg overflow-hidden bg-blue-50/40 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(prod.id, existing.quantity - 1)}
                                  className="w-9 h-full flex items-center justify-center bg-blue-100/60 hover:bg-blue-200/80 text-blue-700 transition active:scale-90"
                                  title="Decrease quantity"
                                >
                                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <span className="flex-1 text-center font-bold font-mono text-xs text-slate-900">
                                  {existing.quantity} in order
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(prod.id, existing.quantity + 1)}
                                  className="w-9 h-full flex items-center justify-center bg-blue-100/60 hover:bg-blue-200/80 text-blue-700 transition active:scale-90"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddItem(prod.id)}
                              className="w-full h-9.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-2xs hover:shadow active:scale-[0.99]"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Add to Order</span>
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {errors.items && (
                <p className="text-xs text-red-600 flex items-center gap-1 font-medium pt-1 px-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errors.items}</span>
                </p>
              )}
            </div>

            {/* Bottom Checkout Navigation Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3.5 mt-6">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Current Selection
                </span>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
                  {totalQuantity > 0 ? (
                    <span>
                      <span className="font-bold text-blue-600">{totalQuantity}</span> {totalQuantity === 1 ? 'item' : 'items'} selected • <span className="font-mono font-bold text-slate-900">{formatINR(totalAmount)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">No products added yet. Select products above to proceed.</span>
                  )}
                </p>
              </div>

              <button
                type="submit"
                disabled={loadingProducts || products.length === 0 || validatingPromoter}
                className={`w-full sm:w-auto h-11 px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs ${
                  totalQuantity === 0 || !promoterId.trim()
                    ? 'bg-blue-600/70 hover:bg-blue-600 text-white cursor-pointer'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white hover:shadow active:scale-[0.99]'
                }`}
              >
                {validatingPromoter ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Promoter...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Address Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: ADDRESS DETAILS                                */}
        {/* ======================================================== */}
        {step === 2 && (
          <form onSubmit={handleSubmitOrder} className="w-full space-y-4 sm:space-y-5">
            
            {/* Order Review Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="bg-slate-50/80 px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                    Order Review
                  </h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                  </span>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Edit Products</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="p-3.5 sm:p-4 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {itemsWithDetails.map((it) => (
                  <div key={it.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/80 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={getImageUrl(it.image_url)}
                          alt={it.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 truncate block" title={it.name}>
                          {it.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Qty: {it.quantity} × {formatINR(it.price)}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatINR(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Review Footer with Promoter and Total */}
              <div className="bg-slate-50/70 p-3.5 sm:px-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Authorized Promoter:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                    {promoterId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-600">Total Payable:</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-blue-900">
                    {formatINR(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Address Form Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4 sm:space-y-5">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Customer Address</span>
                </h2>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Products</span>
                </button>
              </div>

              {submitError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Contact Information Group */}
              <div className="space-y-3.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Contact Information
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="full-name" className="block text-xs font-medium text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="full-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors({ ...errors, fullName: null });
                        }}
                        placeholder="e.g. Ananya Sharma"
                        className={`h-11 w-full pl-9 pr-3 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          errors.fullName 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                        }`}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.fullName}</p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label htmlFor="phone-number" className="block text-xs font-medium text-slate-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        id="phone-number"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                          if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: null });
                        }}
                        placeholder="e.g. 9876543210"
                        className={`h-11 w-full pl-9 pr-3 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          errors.phoneNumber 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                        }`}
                      />
                    </div>
                    {errors.phoneNumber && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.phoneNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Address Group */}
              <div className="space-y-3.5 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Delivery Address
                </span>

                {/* Complete Address */}
                <div>
                  <label htmlFor="complete-address" className="block text-xs font-medium text-slate-700 mb-1">
                    Complete Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="complete-address"
                    rows={2}
                    value={completeAddress}
                    onChange={(e) => {
                      setCompleteAddress(e.target.value);
                      if (errors.completeAddress) setErrors({ ...errors, completeAddress: null });
                    }}
                    placeholder="House/Flat number, Street name, Area, Landmark"
                    className={`w-full p-3 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition resize-none ${
                      errors.completeAddress 
                        ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                  {errors.completeAddress && (
                    <p className="text-xs text-red-600 mt-1 font-medium">{errors.completeAddress}</p>
                  )}
                </div>

                {/* Pincode, City, State Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Pincode */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="pincode" className="block text-xs font-medium text-slate-700">
                        Pincode <span className="text-red-500">*</span>
                      </label>
                      {loadingPincode && (
                        <span className="text-[10px] text-blue-600 flex items-center gap-1 font-semibold">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          <span>Detecting...</span>
                        </span>
                      )}
                    </div>
                    <input
                      id="pincode"
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPincode(val);
                        if (errors.pincode) setErrors({ ...errors, pincode: null });
                        const clean = val.replace(/\D/g, '');
                        if (clean.length === 6) {
                          handlePincodeLookup(clean);
                        }
                      }}
                      onBlur={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        if (clean.length === 6 && (!city || !stateName)) {
                          handlePincodeLookup(clean);
                        }
                      }}
                      placeholder="6 Digits"
                      className={`h-11 w-full px-3 rounded-lg border text-sm font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                        errors.pincode 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                      }`}
                    />
                    {errors.pincode && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.pincode}</p>
                    )}
                  </div>

                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block text-xs font-medium text-slate-700 mb-1">
                      City / District <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (errors.city) setErrors({ ...errors, city: null });
                      }}
                      placeholder="e.g. Bengaluru"
                      className={`h-11 w-full px-3 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                        errors.city 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                      }`}
                    />
                    {errors.city && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.city}</p>
                    )}
                  </div>

                  {/* State Dropdown */}
                  <div>
                    <label htmlFor="state-name" className="block text-xs font-medium text-slate-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="state-name"
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        if (errors.stateName) setErrors({ ...errors, stateName: null });
                      }}
                      className={`h-11 w-full px-3 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 transition ${
                        errors.stateName 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                      }`}
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                      {stateName && !INDIAN_STATES.includes(stateName) && (
                        <option value={stateName}>{stateName}</option>
                      )}
                    </select>
                    {errors.stateName && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.stateName}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions (Back + Place Order) */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-11 px-4 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm transition shadow-xs disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <>
                      <span>Place Order ({formatINR(totalAmount)})</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 3: ORDER SUCCESS CONFIRMATION                       */}
        {/* ======================================================== */}
        {step === 3 && orderResult && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 sm:p-7 text-center space-y-4">
              
              {/* Emerald Success Checkmark Icon */}
              <div className="w-13 h-13 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Order Placed Successfully!
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Thank you for your order. A confirmation has been recorded.
                </p>
              </div>

              {/* Order ID Banner with Copy Option */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 max-w-xs mx-auto">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Generated Order ID
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="font-mono text-lg font-bold text-slate-900 tracking-wider">
                    {orderResult.orderId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    title="Copy Order ID"
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-blue-600 transition"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">
                    Order ID copied to clipboard!
                  </p>
                )}
              </div>

              {/* Order Receipt Details */}
              <div className="text-left bg-slate-50 rounded-lg p-3.5 sm:p-4 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    Order Receipt
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {orderResult.orderDate ? new Date(orderResult.orderDate).toLocaleString('en-IN') : 'Just now'}
                  </span>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Customer Name:</span>
                    <span className="font-medium text-slate-900">{orderResult.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Phone Number:</span>
                    <span className="font-medium text-slate-900">{orderResult.phoneNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block mb-0.5">Address:</span>
                    <span className="font-normal text-slate-800">
                      {orderResult.completeAddress}, {orderResult.city}, {orderResult.state} - {orderResult.pincode}
                    </span>
                  </div>
                </div>

                {/* Itemized List */}
                <div className="border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] block mb-1.5">
                    Ordered Products ({orderResult.items?.length || 0})
                  </span>
                  <div className="space-y-1">
                    {(orderResult.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <span className="font-medium text-slate-800 block truncate">
                            {it.name || it.product_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Qty: {it.quantity} × {formatINR(it.price || it.product_price)}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {formatINR(it.subtotal !== undefined ? it.subtotal : (it.price || it.product_price) * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Total Amount:</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {formatINR(orderResult.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto h-9 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 transition inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto h-9 px-4 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition shadow-2xs inline-flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Place Another Order</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* ======================================================== */}
      {/* FLOATING ORDER TOTAL WIDGET & HOVER/TAP EXPANDED POPOVER */}
      {/* ======================================================== */}
      {totalQuantity > 0 && step < 3 && (
        <>
          {/* Subtle Mobile Backdrop when summary is expanded */}
          {isSummaryExpanded && (
            <div 
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-35 sm:hidden transition-opacity duration-200"
              onClick={() => setIsSummaryExpanded(false)}
            />
          )}

          <div
            id="floating-order-summary-container"
            onMouseEnter={handleFloatingMouseEnter}
            onMouseLeave={handleFloatingMouseLeave}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 select-none"
          >
            {/* Expanded Popover (Above the Widget, 280–320px width) */}
            {isSummaryExpanded && (
              <div 
                className="absolute bottom-full right-0 mb-3 w-[calc(100vw-1.75rem)] sm:w-[310px] max-w-[320px] bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-bottom-right z-50 text-slate-800"
              >
                {/* Popover Header */}
                <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      Your Order
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                      {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSummaryExpanded(false);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    title="Close summary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Scrollable Items List (Compact 280-320px width without cutting off text) */}
                <div className="p-2.5 sm:p-3 max-h-56 sm:max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {itemsWithDetails.map((it) => (
                    <div key={it.product_id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                      {/* Product Thumbnail & Name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-slate-50 border border-slate-200/80 p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={getImageUrl(it.image_url)}
                            alt={it.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 text-xs truncate block" title={it.name}>
                            {it.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatINR(it.price)} each
                          </span>
                        </div>
                      </div>

                      {/* Quantity Controls, Subtotal, Remove */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Stepper */}
                        <div className="inline-flex items-center border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs h-6">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(it.product_id, it.quantity - 1)}
                            className="w-5.5 h-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition"
                            title="Decrease quantity"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="px-1 text-[11px] font-bold font-mono text-slate-800 min-w-[16px] text-center">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(it.product_id, it.quantity + 1)}
                            className="w-5.5 h-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition"
                            title="Increase quantity"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Individual Subtotal */}
                        <span className="font-mono font-bold text-slate-900 text-xs min-w-[48px] text-right">
                          {formatINR(it.subtotal)}
                        </span>

                        {/* Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.product_id)}
                          title="Remove item"
                          className="p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Popover Footer with Grand Total & Action */}
                <div className="bg-slate-50/80 p-2.5 sm:p-3 border-t border-slate-100 space-y-2.5">
                  <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block leading-tight">
                        Grand Total
                      </span>
                      <span className="text-[9px] text-blue-600 font-medium">
                        {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <span className="text-base font-black font-mono text-blue-900">
                      {formatINR(totalAmount)}
                    </span>
                  </div>

                  {step === 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSummaryExpanded(false);
                        handleNext();
                      }}
                      disabled={validatingPromoter}
                      className="w-full h-9.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs hover:shadow active:scale-[0.99]"
                    >
                      <span>Continue to Address Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Floating Pill Trigger Widget */}
            <button
              type="button"
              onClick={handleFloatingClick}
              className="flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg hover:shadow-xl shadow-blue-600/25 transition-all duration-200 cursor-pointer select-none ring-2 ring-white/30 active:scale-95 group text-xs sm:text-sm"
              aria-expanded={isSummaryExpanded}
              title="View order summary"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white transition-transform group-hover:scale-110" />
                <span className="absolute -top-1.5 -right-2 bg-amber-400 text-slate-900 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-blue-600 shadow-2xs">
                  {totalQuantity}
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-bold tracking-tight">
                <span>{totalQuantity} {totalQuantity === 1 ? 'Item' : 'Items'}</span>
                <span className="text-blue-300 font-light">|</span>
                <span className="font-mono font-black tracking-tight">
                  {formatINR(totalAmount)}
                </span>
              </div>

              <ChevronUp 
                className={`w-3.5 h-3.5 text-blue-200 transition-transform duration-200 ${isSummaryExpanded ? 'rotate-180' : ''}`} 
              />
            </button>
          </div>
        </>
      )}

    </div>
  );
}
