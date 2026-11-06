import React, { useState, useEffect } from 'react';
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
  ChevronDown
} from 'lucide-react';

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
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false);
  const [screen2CartExpanded, setScreen2CartExpanded] = useState(false);

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

  // Fetch active products on mount (avoid automatic product selection)
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
    setSelectedItems((prev) => prev.filter((item) => item.product_id !== pid));
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

  // Step 1 Validation -> Proceed to Step 2 (Screen 2)
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
      return;
    }

    // Validate Promoter ID against database
    setValidatingPromoter(true);
    try {
      const res = await fetch(apiUrl(`/api/promoters/validate/${encodeURIComponent(promoterId.trim())}`));
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrors({
          promoterId: data.error || 'Invalid Promoter ID. Only authorized promoters can place orders.'
        });
        setValidatingPromoter(false);
        return;
      }
      setPromoterVerified(data.promoter);
    } catch (err) {
      console.error(err);
      setErrors({ promoterId: 'Unable to verify Promoter ID. Please check your connection.' });
      setValidatingPromoter(false);
      return;
    } finally {
      setValidatingPromoter(false);
    }

    setErrors({});
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

      // Direct fallback to postalpincode.in if backend was unreachable
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
    if (submitting) return; // Prevent duplicate clicks

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyOrderId = () => {
    if (orderResult?.orderId) {
      navigator.clipboard.writeText(orderResult.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans pb-16 lg:pb-0">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-13 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <span className="font-semibold text-slate-900 text-sm sm:text-base tracking-tight">
              Product Ordering System
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified & Secure</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6">
        
        {/* Checkout Progress Indicator (Minimal, Compact & Centered) */}
        {step < 3 && (
          <div className="mb-6 max-w-sm mx-auto px-2">
            <div className="flex items-center justify-center gap-3">
              {/* Step 1 Node */}
              <div className="flex items-center gap-2">
                <div 
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 1 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs' 
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {step > 1 ? <Check className="w-4 h-4 stroke-[2.5]" /> : '1'}
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${step === 1 ? 'text-blue-700' : 'text-slate-700'}`}>
                  Product Details
                </span>
              </div>

              {/* Connecting Line */}
              <div className="w-12 sm:w-16 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-blue-600 transition-all duration-300 ${
                    step > 1 ? 'w-full' : 'w-0'
                  }`}
                />
              </div>

              {/* Step 2 Node */}
              <div className="flex items-center gap-2">
                <div 
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 2 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs' 
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  2
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${step === 2 ? 'text-blue-700' : 'text-slate-400'}`}>
                  Address Details
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Global Catalog Error Alert */}
        {productsError && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs shadow-2xs">
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
          <form onSubmit={handleNext} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column (Promoter ID + Product Cards) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              
              {/* Promoter ID Card */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="promoter-id" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Promoter ID <span className="text-red-500">*</span></span>
                  </label>
                  {promoterVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Verified: {promoterVerified.name || promoterVerified.promoter_id}
                    </span>
                  )}
                </div>

                <div className="relative">
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
                    placeholder="Enter Promoter ID (e.g. PR-1001)"
                    className={`h-11 w-full pl-10 pr-3.5 rounded-lg border text-sm text-slate-900 bg-slate-50/50 hover:bg-white placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition ${
                      errors.promoterId 
                        ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                </div>

                {errors.promoterId && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.promoterId}</span>
                  </p>
                )}
              </div>

              {/* Product Selection Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    <span>Select Products <span className="text-red-500">*</span></span>
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    {products.length} {products.length === 1 ? 'product' : 'products'} available
                  </span>
                </div>

                {loadingProducts ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-64 rounded-xl bg-white border border-slate-200/80 p-4 animate-pulse space-y-3">
                        <div className="w-full h-36 bg-slate-100 rounded-lg" />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {products.map((prod) => {
                      const existing = selectedItems.find((it) => it.product_id === prod.id);
                      const isSelected = !!existing;

                      return (
                        <div 
                          key={prod.id} 
                          className={`flex flex-col justify-between h-full rounded-xl border transition-all duration-200 p-4 bg-white ${
                            isSelected 
                              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm' 
                              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            {/* Product Thumbnail (Fixed height, no distortion) */}
                            <div className="w-full h-36 sm:h-40 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-center p-3 mb-3.5 overflow-hidden">
                              <img
                                src={getImageUrl(prod.image_url)}
                                alt={prod.name}
                                className="w-full h-full object-contain transition-transform duration-200 hover:scale-105"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                }}
                              />
                            </div>

                            {/* Product Info (Fixed text height ensures alignment) */}
                            <div className="mb-3">
                              <h3 
                                className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 h-10 block" 
                                title={prod.name}
                              >
                                {prod.name}
                              </h3>
                              <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-lg font-bold text-slate-900 font-mono">
                                  {formatINR(prod.price)}
                                </span>
                                <span className="text-xs text-slate-400 font-normal">/ unit</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Slot (Consistent height of 40px) */}
                          <div className="pt-2 border-t border-slate-100">
                            {isSelected ? (
                              <div className="w-full h-10 flex items-center justify-between border border-blue-500/40 rounded-lg overflow-hidden bg-blue-50/30 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(prod.id, existing.quantity - 1)}
                                  className="w-11 h-full flex items-center justify-center bg-blue-100/60 hover:bg-blue-200/70 text-blue-700 transition font-bold"
                                  title="Decrease quantity"
                                >
                                  <Minus className="w-4 h-4 stroke-[2.5]" />
                                </button>
                                <span className="flex-1 text-center font-bold font-mono text-sm text-slate-900">
                                  {existing.quantity} in order
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(prod.id, existing.quantity + 1)}
                                  className="w-11 h-full flex items-center justify-center bg-blue-100/60 hover:bg-blue-200/70 text-blue-700 transition font-bold"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-4 h-4 stroke-[2.5]" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddItem(prod.id)}
                                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
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
            </div>

            {/* Right Column: Mini Checkout / Cart Panel */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-18 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
                
                {/* 1. Cart Header */}
                <div className="bg-slate-50/80 px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                      Your Cart
                    </h3>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-all ${
                    totalQuantity > 0 
                      ? 'bg-blue-600 text-white shadow-2xs' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* 2. Cart Body (Selected Products or Compact Empty State) */}
                <div className="p-4 sm:p-5 flex-1">
                  {itemsWithDetails.length === 0 ? (
                    <div className="py-6 px-2 text-center space-y-2">
                      <div className="w-11 h-11 rounded-full bg-blue-50/80 text-blue-500 flex items-center justify-center mx-auto border border-blue-100/70 shadow-2xs">
                        <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700">Your cart is waiting</p>
                        <p className="text-[11px] text-slate-400">Select products on the left to add</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1 divide-y divide-slate-100">
                      {itemsWithDetails.map((it) => (
                        <div key={it.product_id} className="pt-3 first:pt-0 flex items-center gap-3">
                          {/* Product Thumbnail */}
                          <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200/80 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
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

                          {/* Product Info & Controls */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block" title={it.name}>
                                {it.name}
                              </span>
                              <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                                {formatINR(it.subtotal)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-slate-500 font-mono">
                                {formatINR(it.price)} each
                              </span>

                              <div className="flex items-center gap-1.5">
                                {/* Inline Mini Quantity Stepper */}
                                <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(it.product_id, it.quantity - 1)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition active:scale-90"
                                    title="Decrease quantity"
                                  >
                                    <Minus className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                  <span className="px-1.5 text-xs font-bold font-mono text-slate-800 min-w-[20px] text-center">
                                    {it.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(it.product_id, it.quantity + 1)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition active:scale-90"
                                    title="Increase quantity"
                                  >
                                    <Plus className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                </div>

                                {/* Remove Icon */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(it.product_id)}
                                  title="Remove product"
                                  className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition active:scale-95"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Total Amount & Action Section */}
                <div className="bg-slate-50/70 p-4 sm:p-5 border-t border-slate-100/90 space-y-3.5">
                  {/* Subtotal Row */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">Subtotal ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})</span>
                    <span className="font-mono font-bold text-slate-800">{formatINR(totalAmount)}</span>
                  </div>

                  {/* Prominent Highlighted Total Box */}
                  <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block leading-tight">
                        Total Amount
                      </span>
                      <span className="text-[10px] text-blue-600 font-medium">Final order value</span>
                    </div>
                    <span className="text-2xl font-black font-mono text-blue-900 tracking-tight">
                      {formatINR(totalAmount)}
                    </span>
                  </div>

                  {/* Continue to Address Button (Prominent & Full-Width) */}
                  <button
                    type="submit"
                    disabled={loadingProducts || products.length === 0 || validatingPromoter || itemsWithDetails.length === 0}
                    className={`w-full h-12 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                      itemsWithDetails.length === 0 || validatingPromoter
                        ? 'bg-slate-200/80 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white hover:shadow-md active:scale-[0.99]'
                    }`}
                  >
                    {validatingPromoter ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Promoter...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Address</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* Mobile Bottom Expandable Checkout Bar */}
            {itemsWithDetails.length > 0 && (
              <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-xl z-30 transition-all">
                {/* Expandable itemized drawer */}
                {mobileCartExpanded && (
                  <div className="p-3.5 border-b border-slate-100 max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100 bg-slate-50/60">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cart Items ({totalQuantity})</span>
                      <button
                        type="button"
                        onClick={() => setMobileCartExpanded(false)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Hide
                      </button>
                    </div>
                    {itemsWithDetails.map((it) => (
                      <div key={it.product_id} className="pt-2 first:pt-0 flex items-center gap-2.5 text-xs">
                        <div className="w-8 h-8 rounded-md bg-white border border-slate-200 p-0.5 flex-shrink-0 flex items-center justify-center">
                          <img
                            src={getImageUrl(it.image_url)}
                            alt={it.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-slate-800 truncate block">{it.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {it.quantity} × {formatINR(it.price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center border border-slate-200 rounded-md bg-white">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(it.product_id, it.quantity - 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="px-1.5 font-mono font-bold text-[11px]">{it.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(it.product_id, it.quantity + 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatINR(it.subtotal)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.product_id)}
                            className="text-slate-300 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Compact Bottom Bar */}
                <div className="p-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileCartExpanded(!mobileCartExpanded)}
                    className="flex items-center gap-1.5 text-left focus:outline-none"
                  >
                    <div>
                      <span className="text-[11px] text-slate-500 block leading-tight flex items-center gap-1">
                        <span>{totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}</span>
                        {mobileCartExpanded ? (
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        ) : (
                          <ChevronUp className="w-3 h-3 text-slate-400" />
                        )}
                      </span>
                      <span className="text-base font-bold font-mono text-slate-900">
                        {formatINR(totalAmount)}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={validatingPromoter}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
                  >
                    {validatingPromoter ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Address</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: ADDRESS DETAILS (Completely Separate Screen)   */}
        {/* ======================================================== */}
        {step === 2 && (
          <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column (Customer Address Form) */}
            <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-6 space-y-5">
              
              {/* Mobile Cart Review Accordion on Screen 2 */}
              <div className="lg:hidden bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setScreen2CartExpanded(!screen2CartExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span>Review Cart ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{formatINR(totalAmount)}</span>
                    {screen2CartExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </button>
                {screen2CartExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-200/60 divide-y divide-slate-100 space-y-2">
                    {itemsWithDetails.map((it) => (
                      <div key={it.product_id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate max-w-[150px] font-medium text-slate-800">{it.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">Qty: {it.quantity}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900">{formatINR(it.subtotal)}</span>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between text-xs font-semibold text-slate-900">
                      <span>Total Amount</span>
                      <span className="font-mono text-blue-700">{formatINR(totalAmount)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Customer Address</span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition"
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
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errors.fullName}
                      </p>
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
                        placeholder="e.g. +91 98765 43210"
                        className={`h-11 w-full pl-9 pr-3 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          errors.phoneNumber 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                        }`}
                      />
                    </div>
                    {errors.phoneNumber && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errors.phoneNumber}
                      </p>
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
                    rows={3}
                    value={completeAddress}
                    onChange={(e) => {
                      setCompleteAddress(e.target.value);
                      if (errors.completeAddress) setErrors({ ...errors, completeAddress: null });
                    }}
                    placeholder="House/Flat No., Building Name, Street, Area, Landmark"
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition resize-y ${
                      errors.completeAddress 
                        ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                  {errors.completeAddress && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.completeAddress}
                    </p>
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
                        <span className="text-[10px] text-blue-600 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
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
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {errors.pincode}
                      </p>
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
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {errors.city}
                      </p>
                    )}
                  </div>

                  {/* State */}
                  <div>
                    <label htmlFor="state-name" className="block text-xs font-medium text-slate-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="state-name"
                      type="text"
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        if (errors.stateName) setErrors({ ...errors, stateName: null });
                      }}
                      placeholder="e.g. Karnataka"
                      className={`h-11 w-full px-3 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                        errors.stateName 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                      }`}
                    />
                    {errors.stateName && (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {errors.stateName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="h-11 px-5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-xs sm:text-sm hover:bg-slate-50 transition inline-flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Products</span>
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

            {/* Right Column: Mini Checkout / Cart Panel on Screen 2 */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-18 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
                
                {/* 1. Header */}
                <div className="bg-slate-50/80 px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                      Your Cart
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* 2. Items List */}
                <div className="p-4 sm:p-5 flex-1">
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1 divide-y divide-slate-100">
                    {itemsWithDetails.map((it) => (
                      <div key={it.product_id} className="pt-3 first:pt-0 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200/80 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block" title={it.name}>
                              {it.name}
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                              {formatINR(it.subtotal)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                            <span>Qty: {it.quantity}</span>
                            <span>{formatINR(it.price)} each</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Footer Summary */}
                <div className="bg-slate-50/70 p-4 sm:p-5 border-t border-slate-100/90 space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">Promoter ID</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                      {promoterId}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">Subtotal ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})</span>
                    <span className="font-mono font-bold text-slate-800">{formatINR(totalAmount)}</span>
                  </div>

                  {/* Prominent Highlighted Total Box */}
                  <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block leading-tight">
                        Total Payable
                      </span>
                      <span className="text-[10px] text-blue-600 font-medium">Final order value</span>
                    </div>
                    <span className="text-2xl font-black font-mono text-blue-900 tracking-tight">
                      {formatINR(totalAmount)}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 3: ORDER SUCCESS CONFIRMATION                       */}
        {/* ======================================================== */}
        {step === 3 && orderResult && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 sm:p-7 text-center space-y-4">
              
              {/* Checkmark Icon */}
              <div className="w-13 h-13 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Order Placed Successfully!
                </h2>
              </div>

              {/* Order ID Banner */}
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
    </div>
  );
}
