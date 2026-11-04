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
  Trash2
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
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.product_id === pid
          ? { ...item, quantity: isNaN(qtyVal) ? 1 : Math.max(1, qtyVal) }
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
    e.preventDefault();
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
  };

  // Lookup India Post API to auto-fill City and State from 6-digit Pincode
  const handlePincodeLookup = async (pinValue) => {
    const cleanPin = (pinValue || '').replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      return;
    }

    setLoadingPincode(true);

    try {
      // 1. Try our fast backend route /api/pincode/:pincode
      let res = await fetch(apiUrl(`/api/pincode/${cleanPin}`));
      let data = await res.json();

      // 2. Direct fallback to postalpincode.in if backend was unreachable
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
  };

  // Step 2 Make Order Submission
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
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
      newErrors.completeAddress = 'Complete Address is required (House Number, Building, Road, Area, Landmark)';
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
        city: payload.city,
        state: payload.state
      });

      setStep(3); // Success window
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
  };

  const handleCopyOrderId = () => {
    if (orderResult?.orderId) {
      navigator.clipboard.writeText(orderResult.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
      {/* Top Header Card */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 mb-2.5 sm:mb-3 shadow-sm border border-blue-100">
          <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          Product Order Form
        </h1>
      </div>

      {/* Progress Stepper Indicator */}
      {step < 3 && (
        <div className="mb-8">
          <div className="flex items-center justify-between relative max-w-md mx-auto">
            {/* Connecting Bar */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-200 -z-0">
              <div 
                className={`h-full bg-blue-600 transition-all duration-300 ${
                  step === 1 ? 'w-1/2' : 'w-full'
                }`}
              />
            </div>

            {/* Step 1 Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === 1 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {step > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${step === 1 ? 'text-blue-700 font-semibold' : 'text-slate-600'}`}>
                Product Details
              </span>
            </div>

            {/* Step 2 Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === 2 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </div>
              <span className={`text-xs mt-1.5 font-medium ${step === 2 ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                Address Details
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* ======================================================== */}
        {/* STEP 1: PRODUCT DETAILS                                 */}
        {/* ======================================================== */}
        {step === 1 && (
          <form onSubmit={handleNext} className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Step 1 – Product Details
              </h2>
            </div>

            {productsError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p>{productsError}</p>
                  <button
                    type="button"
                    onClick={fetchProducts}
                    className="mt-2 text-xs font-semibold text-red-800 underline hover:no-underline"
                  >
                    Retry loading products
                  </button>
                </div>
              </div>
            )}

            {/* Promoter ID */}
            <div>
              <label 
                htmlFor="promoter-id"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Promoter ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="promoter-id"
                  type="text"
                  value={promoterId}
                  onChange={(e) => {
                    setPromoterId(e.target.value);
                    if (errors.promoterId) setErrors({ ...errors, promoterId: null });
                    if (promoterVerified) setPromoterVerified(null);
                  }}
                  placeholder="Enter Promoter ID (e.g. PR-1001)"
                  className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                    errors.promoterId 
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                  }`}
                />
              </div>
              {promoterVerified && promoterVerified.code.toLowerCase() === promoterId.trim().toLowerCase() && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Authorized Promoter {promoterVerified.name ? `(${promoterVerified.name})` : ''}
                </p>
              )}
              {errors.promoterId && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.promoterId}
                </p>
              )}
            </div>

            {/* Multiple Product Selection Section */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Products <span className="text-red-500">*</span>
              </label>

              {loadingProducts ? (
                <div className="h-12 w-full rounded-xl bg-slate-100 animate-pulse flex items-center px-4 text-xs text-slate-400">
                  Loading available products...
                </div>
              ) : products.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  No active products are currently available. Please contact the administrator.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Dropdown Selector to Add Products */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={productToAdd}
                      onChange={(e) => setProductToAdd(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                    >
                      <option value="">Select a product to add...</option>
                      {products.map((prod) => {
                        const isAdded = selectedItems.some((it) => it.product_id === prod.id);
                        return (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} — {formatINR(prod.price)} {isAdded ? '(Already selected)' : ''}
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
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:bg-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  </div>

                  {/* Available Products Quick-Add Chips */}
                  {products.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Available Catalog:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {products.map((prod) => {
                          const isAdded = selectedItems.some((it) => it.product_id === prod.id);
                          return (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleAddItem(prod.id)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                                isAdded
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span className="font-semibold">{prod.name}</span>
                              <span className="text-slate-500 font-mono">({formatINR(prod.price)})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {errors.items && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.items}
                    </p>
                  )}

                  {/* Selected Products Table */}
                  {itemsWithDetails.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                      <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-medium">
                        No products selected yet. Select a product above to add to your order.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-slate-100/90 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 sm:px-4">Product</th>
                              <th className="py-2.5 px-2 sm:px-3 text-right">Price</th>
                              <th className="py-2.5 px-2 sm:px-3 text-center">Quantity</th>
                              <th className="py-2.5 px-3 sm:px-4 text-right">Subtotal</th>
                              <th className="py-2.5 px-2 text-center w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {itemsWithDetails.map((item) => (
                              <tr key={item.product_id} className="hover:bg-slate-50/60 transition">
                                <td className="py-2.5 px-3 sm:px-4">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white p-1 flex-shrink-0 flex items-center justify-center">
                                      <img
                                        src={getImageUrl(item.image_url)}
                                        alt={item.name}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                        }}
                                      />
                                    </div>
                                    <span className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-2">
                                      {item.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 sm:px-3 text-right font-mono text-slate-700 whitespace-nowrap text-xs sm:text-sm">
                                  {formatINR(item.price)}
                                </td>
                                <td className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">
                                  <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                                      className="w-6 h-7 sm:w-7 sm:h-8 flex items-center justify-center bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateQuantity(item.product_id, e.target.value)}
                                      className="w-9 sm:w-11 text-center text-xs font-semibold text-slate-900 border-x border-slate-200 py-1 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                                      className="w-6 h-7 sm:w-7 sm:h-8 flex items-center justify-center bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs sm:text-sm">
                                  {formatINR(item.subtotal)}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.product_id)}
                                    title="Remove product"
                                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Overall Order Total Bar */}
                  {itemsWithDetails.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-blue-50/80 border border-blue-200">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-900">
                          Total Amount
                        </span>
                        <span className="text-[11px] text-blue-600 font-medium">
                          {itemsWithDetails.length} {itemsWithDetails.length === 1 ? 'product' : 'products'} ({totalQuantity} total items)
                        </span>
                      </div>
                      <span className="text-xl font-bold font-mono text-blue-700 tracking-tight">
                        {formatINR(totalAmount)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Next Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loadingProducts || products.length === 0 || validatingPromoter}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {validatingPromoter ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Promoter ID...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Customer Address</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 2: CUSTOMER ADDRESS DETAILS                         */}
        {/* ======================================================== */}
        {step === 2 && (
          <form onSubmit={handleSubmitOrder} className="p-4 sm:p-6 md:p-8 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Step 2 – Customer Address Details
                </h2>
              </div>
            </div>

            {/* Order Price & Product Summary Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-800 border-b border-slate-200/60 pb-1.5 flex justify-between items-center">
                <span>Selected Products ({itemsWithDetails.length})</span>
                <span className="text-slate-500 font-normal">{totalQuantity} total items</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {itemsWithDetails.map((it) => (
                  <div key={it.product_id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate max-w-[220px]">
                      {it.name} <span className="text-slate-400 font-mono">× {it.quantity}</span>
                    </span>
                    <span className="font-mono font-medium text-slate-900 pl-2">
                      {formatINR(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200/80 pt-2 flex items-center justify-between">
                <span className="font-bold text-slate-900">Total Amount:</span>
                <span className="text-base font-bold text-blue-700 font-mono">
                  {formatINR(totalAmount)}
                </span>
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p>{submitError}</p>
                </div>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label 
                htmlFor="full-name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
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
                  placeholder="e.g. John Doe"
                  className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                    errors.fullName 
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                  }`}
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label 
                htmlFor="phone-number"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
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
                  className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                    errors.phoneNumber 
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                  }`}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.phoneNumber}
                </p>
              )}
            </div>

            {/* Complete Address */}
            <div>
              <label 
                htmlFor="complete-address"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Complete Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="complete-address"
                rows={4}
                value={completeAddress}
                onChange={(e) => {
                  setCompleteAddress(e.target.value);
                  if (errors.completeAddress) setErrors({ ...errors, completeAddress: null });
                }}
                placeholder="House Number, Building Name, Road / Street, Area / Sector, Landmark"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition resize-y ${
                  errors.completeAddress 
                    ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                    : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                }`}
              />
              {errors.completeAddress && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.completeAddress}
                </p>
              )}
            </div>

            {/* Pincode, City, State Grid */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Pincode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label 
                      htmlFor="pincode"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    {loadingPincode && (
                      <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
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
                    placeholder="6 digits (e.g. 560001)"
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      errors.pincode 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                  {errors.pincode && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.pincode}
                    </p>
                  )}
                </div>

                {/* City */}
                <div>
                  <label 
                    htmlFor="city"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
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
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      errors.city 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                  {errors.city && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.city}
                    </p>
                  )}
                </div>

                {/* State */}
                <div>
                  <label 
                    htmlFor="state-name"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
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
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      errors.stateName 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'
                    }`}
                  />
                  {errors.stateName && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.stateName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons: Back and Make Order */}
            <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 transition disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:flex-[2] flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Order...</span>
                  </>
                ) : (
                  <>
                    <span>Make Order ({formatINR(totalAmount)})</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 3: ORDER SUCCESS                                    */}
        {/* ======================================================== */}
        {step === 3 && orderResult && (
          <div className="p-5 sm:p-8 text-center space-y-5 sm:space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border-2 border-emerald-200 shadow-sm animate-bounce-short">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Order Placed Successfully!
              </h2>
            </div>

            {/* Generated Order ID Highlight */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-sm mx-auto">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Generated Order ID
              </span>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="font-mono text-lg font-bold text-slate-900 tracking-wide">
                  {orderResult.orderId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrderId}
                  title="Copy Order ID"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-[11px] text-emerald-600 font-medium mt-1">
                  Copied to clipboard!
                </p>
              )}
            </div>

            {/* Order Summary details */}
            <div className="text-left bg-slate-50/60 rounded-xl p-4 border border-slate-100 text-xs text-slate-600 space-y-2.5 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-slate-800">{orderResult.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <span className="font-semibold text-slate-800">{orderResult.city}, {orderResult.state}</span>
              </div>

              <div className="border-t border-slate-200/70 pt-2">
                <span className="text-slate-500 font-semibold block mb-1">Ordered Products:</span>
                <div className="space-y-1.5">
                  {(orderResult.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-slate-700 truncate max-w-[200px]">
                        {it.name || it.product_name} <span className="text-slate-400 font-mono">× {it.quantity}</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatINR(it.subtotal !== undefined ? it.subtotal : (it.price || it.product_price) * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-200/80">
                <span className="text-slate-700 font-bold">Total Amount:</span>
                <span className="font-bold text-blue-700 text-sm font-mono">{formatINR(orderResult.totalAmount)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 transition shadow-sm"
              >
                <span>Place Another Order</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
