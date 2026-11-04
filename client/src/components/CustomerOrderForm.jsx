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
  IndianRupee,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
  Printer
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
  const [productToAdd, setProductToAdd] = useState('');

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
      // Auto-select first product if none selected
      if (data.length > 0 && selectedItems.length === 0) {
        setSelectedItems([{ product_id: data[0].id, quantity: 1 }]);
      }
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

  // Update quantity of a selected product
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
    if (products.length > 0) {
      setSelectedItems([{ product_id: products[0].id, quantity: 1 }]);
    } else {
      setSelectedItems([]);
    }
    setProductToAdd('');
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
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Professional Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight block leading-tight">
                Product Ordering System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified & Secure</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        
        {/* Step Progress Tracker */}
        {step < 3 && (
          <div className="mb-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-between relative">
              {/* Connecting Progress Track */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-200 -z-0 rounded-full">
                <div 
                  className={`h-full bg-blue-600 rounded-full transition-all duration-300 ${
                    step === 1 ? 'w-1/2' : 'w-full'
                  }`}
                />
              </div>

              {/* Step 1 Node */}
              <div className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
                    step === 1 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {step > 1 ? <Check className="w-5 h-5" /> : '1'}
                </div>
                <span className={`text-xs mt-2 font-semibold ${step === 1 ? 'text-blue-700' : 'text-slate-600'}`}>
                  1. Product Details
                </span>
              </div>

              {/* Step 2 Node */}
              <div className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === 2 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  2
                </div>
                <span className={`text-xs mt-2 font-semibold ${step === 2 ? 'text-blue-700' : 'text-slate-400'}`}>
                  2. Address Details
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner if Products fail to load */}
        {productsError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm shadow-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load catalog</p>
              <p className="text-xs text-red-600 mt-0.5">{productsError}</p>
              <button
                type="button"
                onClick={fetchProducts}
                className="mt-2 text-xs font-bold text-red-800 underline hover:no-underline"
              >
                Click here to retry
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: PRODUCT DETAILS                                 */}
        {/* ======================================================== */}
        {step === 1 && (
          <form onSubmit={handleNext} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column (Catalog & Selection) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              
              {/* Promoter ID Card */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="promoter-id" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Promoter ID <span className="text-red-500">*</span></span>
                  </label>
                  {promoterVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Verified
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
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      errors.promoterId 
                        ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                </div>

                {errors.promoterId && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.promoterId}</span>
                  </p>
                )}
              </div>

              {/* Product Catalog Grid */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span>Select Products <span className="text-red-500">*</span></span>
                  </h2>
                </div>

                {loadingProducts ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-40 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="p-8 text-center bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                    No active products are available right now.
                  </div>
                ) : (
                  <>
                    {/* Visual Product Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {products.map((prod) => {
                        const existing = selectedItems.find((it) => it.product_id === prod.id);
                        const isSelected = !!existing;

                        return (
                          <div 
                            key={prod.id} 
                            className={`rounded-xl p-4 border transition-all flex flex-col justify-between ${
                              isSelected 
                                ? 'bg-blue-50/30 border-blue-500 ring-2 ring-blue-500/20 shadow-xs' 
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex gap-3.5 mb-3.5">
                              {/* Product Thumbnail */}
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 border border-slate-100 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                <img
                                  src={getImageUrl(prod.image_url)}
                                  alt={prod.name}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                  }}
                                />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-slate-900 text-sm block leading-snug line-clamp-2">
                                  {prod.name}
                                </span>
                                <div className="mt-1 flex items-baseline gap-1.5">
                                  <span className="text-base font-extrabold text-blue-700 font-mono">
                                    {formatINR(prod.price)}
                                  </span>
                                  <span className="text-[11px] text-slate-400">/ unit</span>
                                </div>
                              </div>
                            </div>

                            {/* Action Row */}
                            <div className="pt-2 border-t border-slate-100">
                              {isSelected ? (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5 text-blue-600" />
                                    <span>In Order</span>
                                  </span>
                                  <div className="inline-flex items-center border border-blue-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(prod.id, existing.quantity - 1)}
                                      className="w-7 h-7 flex items-center justify-center bg-blue-50 text-blue-800 hover:bg-blue-100 active:bg-blue-200 font-bold transition"
                                      title="Decrease quantity"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-8 text-center text-xs font-bold text-slate-900 font-mono">
                                      {existing.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(prod.id, existing.quantity + 1)}
                                      className="w-7 h-7 flex items-center justify-center bg-blue-50 text-blue-800 hover:bg-blue-100 active:bg-blue-200 font-bold transition"
                                      title="Increase quantity"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddItem(prod.id)}
                                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 text-white hover:bg-blue-600 text-xs font-semibold transition-colors shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add to Order</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Dropdown Selector for Fast Add */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={productToAdd}
                          onChange={(e) => setProductToAdd(e.target.value)}
                          className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                        >
                          <option value="">Select a product to add...</option>
                          {products.map((prod) => {
                            const isAdded = selectedItems.some((it) => it.product_id === prod.id);
                            return (
                              <option key={prod.id} value={prod.id}>
                                {prod.name} — {formatINR(prod.price)} {isAdded ? '(In order)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (productToAdd) {
                              handleAddItem(productToAdd);
                              setProductToAdd('');
                            }
                          }}
                          disabled={!productToAdd}
                          className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Product</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {errors.items && (
                  <p className="text-xs text-red-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errors.items}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right Column (Sticky Order Summary) */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-24 space-y-4">
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base">
                    Order Summary
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items Mini List */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {itemsWithDetails.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No items selected</p>
                  ) : (
                    itemsWithDetails.map((it) => (
                      <div key={it.product_id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate max-w-[170px]" title={it.name}>
                          {it.name} <span className="text-slate-400 font-mono">× {it.quantity}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900">
                            {formatINR(it.subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.product_id)}
                            title="Remove product"
                            className="text-slate-400 hover:text-red-500 transition p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Total Highlight */}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Total Amount</span>
                  <span className="text-2xl font-black font-mono text-blue-700 tracking-tight">
                    {formatINR(totalAmount)}
                  </span>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={loadingProducts || products.length === 0 || validatingPromoter || itemsWithDetails.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {validatingPromoter ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Promoter...</span>
                    </>
                  ) : (
                    <>
                      <span>Next: Customer Address</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 2: CUSTOMER ADDRESS DETAILS                         */}
        {/* ======================================================== */}
        {step === 2 && (
          <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column (Address Form) */}
            <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <span>Customer Address Details</span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Products</span>
                </button>
              </div>

              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">Order submission error</p>
                    <p className="text-xs text-red-600 mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Name & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="full-name" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
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
                  <label htmlFor="phone-number" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
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

              {/* Complete Address */}
              <div>
                <label htmlFor="complete-address" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
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
                  placeholder="Flat / House No., Apartment Name, Street, Landmark, Area"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition resize-y ${
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="pincode" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    {loadingPincode && (
                      <span className="text-[11px] text-blue-600 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Searching...</span>
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
                    placeholder="6 Digits (e.g. 560001)"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
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
                  <label htmlFor="city" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
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
                  <label htmlFor="state-name" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
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

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 active:bg-slate-100 transition inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Products</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 active:bg-blue-800 transition shadow-md hover:shadow-lg disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <>
                      <span>Make Order ({formatINR(totalAmount)})</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column (Review Order Summary) */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-24 space-y-4">
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base">
                    Review Order
                  </h3>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {totalQuantity} items
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {itemsWithDetails.map((it) => (
                    <div key={it.product_id} className="flex items-start justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 p-0.5 flex-shrink-0 flex items-center justify-center">
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
                          <span className="text-slate-800 font-semibold block truncate">
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

                {/* Promoters & Total */}
                <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Promoter ID</span>
                    <span className="font-mono font-semibold text-slate-800">{promoterId}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Total Payable</span>
                  <span className="text-2xl font-black font-mono text-blue-700 tracking-tight">
                    {formatINR(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 3: ORDER SUCCESS CONFIRMATION                       */}
        {/* ======================================================== */}
        {step === 3 && orderResult && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm text-center space-y-6">
              
              {/* Checkmark Icon */}
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border-4 border-emerald-100 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Order Placed Successfully!
                </h2>
              </div>

              {/* Order ID Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200/80 max-w-md mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block mb-1">
                  Generated Order ID
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                    {orderResult.orderId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    title="Copy Order ID"
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                    Order ID copied to clipboard!
                  </p>
                )}
              </div>

              {/* Order Receipt Details */}
              <div className="text-left bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Order Receipt
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {orderResult.orderDate ? new Date(orderResult.orderDate).toLocaleString('en-IN') : 'Just now'}
                  </span>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Customer Name:</span>
                    <span className="font-bold text-slate-900">{orderResult.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Phone Number:</span>
                    <span className="font-bold text-slate-900">{orderResult.phoneNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block mb-0.5">Address:</span>
                    <span className="font-medium text-slate-800">
                      {orderResult.completeAddress}, {orderResult.city}, {orderResult.state} - {orderResult.pincode}
                    </span>
                  </div>
                </div>

                {/* Itemized List */}
                <div className="border-t border-slate-200/70 pt-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Ordered Products ({orderResult.items?.length || 0})
                  </span>
                  <div className="space-y-2">
                    {(orderResult.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-slate-800 block truncate">
                            {it.name || it.product_name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Qty: {it.quantity} × {formatINR(it.price || it.product_price)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatINR(it.subtotal !== undefined ? it.subtotal : (it.price || it.product_price) * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total Paid / Payable:</span>
                  <span className="text-xl font-black text-blue-700 font-mono">
                    {formatINR(orderResult.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition inline-flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
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
