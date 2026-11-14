import React, { useState, useEffect, useRef } from 'react';
import { apiUrl, getImageUrl, UPI_ID } from '../config';
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
  X,
  Truck,
  CreditCard,
  QrCode,
  Upload,
  ExternalLink,
  Image as ImageIcon
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
  const [promoterId, setPromoterId] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('promoter') || '';
    }
    return '';
  });

  // Selected products for the order: array of { product_id, quantity }
  const [selectedItems, setSelectedItems] = useState([]);

  // Floating Order Widget Popover state
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Step 2 fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [completeAddress, setCompleteAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [postOffice, setPostOffice] = useState('');
  const [postOffices, setPostOffices] = useState([]);
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');

  // Payment & Shipping state (Prepaid: +₹40, COD: +₹60, or Free)
  const [paymentMethod, setPaymentMethod] = useState('prepaid'); // 'prepaid' | 'cod'
  const [paymentScreenshotFile, setPaymentScreenshotFile] = useState(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const fileInputPaymentRef = useRef(null);

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
        subtotal,
        shipping_type: prod.shipping_type || 'standard',
        prepaid_shipping_fee: prod.prepaid_shipping_fee !== undefined ? Number(prod.prepaid_shipping_fee) : 40,
        cod_shipping_fee: prod.cod_shipping_fee !== undefined ? Number(prod.cod_shipping_fee) : 60,
        allowed_payment_types: prod.allowed_payment_types || 'both'
      };
    })
    .filter(Boolean);

  const totalAmount = itemsWithDetails.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQuantity = itemsWithDetails.reduce((sum, item) => sum + item.quantity, 0);

  // Check if any product restricts payment method
  const hasPrepaidOnly = itemsWithDetails.some((it) => it.allowed_payment_types === 'prepaid');
  const hasCodOnly = itemsWithDetails.some((it) => it.allowed_payment_types === 'cod');

  // Auto-switch paymentMethod if restricted by products
  useEffect(() => {
    if (hasPrepaidOnly && paymentMethod !== 'prepaid') {
      setPaymentMethod('prepaid');
    } else if (hasCodOnly && paymentMethod !== 'cod') {
      setPaymentMethod('cod');
    }
  }, [hasPrepaidOnly, hasCodOnly, paymentMethod]);

  // Shipping Fee calculation (Free if all items are free, else max of prepaid/cod fee)
  const isAllFreeShipping = itemsWithDetails.length > 0 && itemsWithDetails.every(
    (it) => it.shipping_type === 'free' || (it.prepaid_shipping_fee === 0 && it.cod_shipping_fee === 0)
  );

  const prepaidShippingFee = isAllFreeShipping ? 0 : Math.max(
    ...itemsWithDetails.map((it) => (it.shipping_type === 'free' ? 0 : it.prepaid_shipping_fee)),
    40
  );

  const codShippingFee = isAllFreeShipping ? 0 : Math.max(
    ...itemsWithDetails.map((it) => (it.shipping_type === 'free' ? 0 : it.cod_shipping_fee)),
    60
  );

  const currentShippingFee = paymentMethod === 'prepaid' ? prepaidShippingFee : codShippingFee;
  const grandTotal = totalAmount + currentShippingFee;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopiedUpi(true);
    showToast('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, paymentScreenshot: 'Please select an image file (PNG, JPG, WEBP)' }));
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, paymentScreenshot: 'Screenshot image size must be under 15MB' }));
        return;
      }
      setPaymentScreenshotFile(file);
      setPaymentScreenshotPreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, paymentScreenshot: null }));
      showToast('Payment screenshot attached successfully');
    }
  };

  // Format currency in Indian Rupees (₹)
  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  // Toggle floating order summary popover on click
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

  // If promoter ID is present in URL params, auto-fill on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const urlPromoter = sp.get('promoter');
      if (urlPromoter && urlPromoter.trim()) {
        setPromoterId(urlPromoter.trim());
      }
    }
  }, []);

  // Step 1 Validation -> Proceed to Step 2
  const handleNext = (e) => {
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

    setErrors({});
    setIsSummaryExpanded(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lookup India Post API to auto-fill City, State, and Post Offices from 6-digit Pincode
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
            const offices = directData[0].PostOffice.map((p) => (p.Name || '').trim()).filter(Boolean);
            data = {
              success: true,
              city: po.District || po.Block || po.Name,
              state: po.State,
              postOffices: offices
            };
          }
        } catch (e) {
          // ignore fallback error
        }
      }

      if (data && data.success) {
        if (data.city) setCity(data.city);
        if (data.state) setStateName(data.state);
        if (Array.isArray(data.postOffices) && data.postOffices.length > 0) {
          setPostOffices(data.postOffices);
          // If 1 post office, auto-select it; if current postOffice not in new list, reset it so user picks from dropdown
          if (data.postOffices.length === 1) {
            setPostOffice(data.postOffices[0]);
          } else if (!data.postOffices.includes(postOffice)) {
            setPostOffice('');
          }
        } else {
          setPostOffices([]);
        }
        setErrors((prev) => ({ ...prev, city: null, stateName: null, pincode: null, postOffice: null }));
        showToast(`Auto-detected ${data.city || 'City'}, ${data.state || 'State'}${data.postOffices?.length ? ` (${data.postOffices.length} Post Offices loaded)` : ''}`);
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
    if (!postOffice.trim()) {
      newErrors.postOffice = postOffices.length > 0 ? 'Please select your Post Office' : 'Post Office is required';
    }
    if (!city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!stateName.trim()) {
      newErrors.stateName = 'State is required';
    }
    if (paymentMethod === 'prepaid' && !paymentScreenshotFile) {
      newErrors.paymentScreenshot = 'Please upload your payment screenshot to confirm your Prepaid order';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.paymentScreenshot && !newErrors.fullName && !newErrors.phoneNumber && !newErrors.completeAddress && !newErrors.pincode && !newErrors.postOffice && !newErrors.city && !newErrors.stateName) {
        const payEl = document.getElementById('payment-section');
        if (payEl) payEl.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setErrors({});
    setSubmitError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('promoter_id', promoterId.trim());
      formData.append('customer_name', fullName.trim());
      formData.append('phone_number', phoneNumber.trim());
      formData.append('complete_address', completeAddress.trim());
      formData.append('pincode', pincode.trim());
      formData.append('post_office', postOffice.trim());
      formData.append('city', city.trim());
      formData.append('state', stateName.trim());
      formData.append('items', JSON.stringify(itemsWithDetails.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity
      }))));
      formData.append('payment_method', paymentMethod);
      formData.append('shipping_amount', currentShippingFee);
      if (transactionId.trim()) {
        formData.append('transaction_id', transactionId.trim());
      }
      if (paymentScreenshotFile) {
        formData.append('payment_screenshot', paymentScreenshotFile);
      }

      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      setOrderResult({
        orderId: data.orderId,
        orderDate: data.orderDate,
        items: itemsWithDetails,
        itemsAmount: data.itemsAmount !== undefined ? data.itemsAmount : totalAmount,
        shippingAmount: data.shippingAmount !== undefined ? data.shippingAmount : currentShippingFee,
        totalAmount: data.totalAmount !== undefined ? data.totalAmount : grandTotal,
        paymentMethod: data.paymentMethod || paymentMethod,
        paymentScreenshotUrl: data.paymentScreenshotUrl || paymentScreenshotPreview,
        transactionId: transactionId.trim(),
        totalQuantity: data.quantity !== undefined ? data.quantity : totalQuantity,
        customerName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        completeAddress: completeAddress.trim(),
        pincode: pincode.trim(),
        postOffice: postOffice.trim(),
        city: city.trim(),
        state: stateName.trim(),
        promoterId: promoterId.trim()
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
    setSelectedItems([]);
    setFullName('');
    setPhoneNumber('');
    setCompleteAddress('');
    setPincode('');
    setPostOffice('');
    setPostOffices([]);
    setCity('');
    setStateName('');
    setPaymentMethod('prepaid');
    setPaymentScreenshotFile(null);
    setPaymentScreenshotPreview('');
    setTransactionId('');
    setCopiedUpi(false);
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
    <div className="w-full min-h-screen bg-[#f4f6ee] text-[#374011] flex flex-col font-sans relative pb-28 sm:pb-32 overflow-x-hidden">
      
      {/* Soft Ambient Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[280px] bg-gradient-to-b from-[#d8dec2]/35 via-[#d8dec2]/10 to-transparent pointer-events-none blur-3xl" />
      
      {/* Toast Feedback Notification (Positioned safe above floating widget) */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#374011] text-white text-xs sm:text-sm font-medium shadow-2xl border border-[#7f8f55]/40 animate-in fade-in slide-in-from-bottom-3 duration-200 whitespace-nowrap">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#a9b48a] flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#d8dec2] sticky top-0 z-30 shadow-2xs">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 h-14 sm:h-16 flex items-center justify-between">
          <a 
            href="/" 
            className="flex items-center transition-opacity hover:opacity-90 focus:outline-hidden"
            title="Dhaara Wellness"
          >
            <img 
              src="/dhaara-logo-dark.png" 
              alt="dhaara wellness" 
              className="h-6 sm:h-7 w-auto object-contain" 
            />
          </a>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f6ee] border border-[#d8dec2] text-[#374011] text-xs font-semibold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#7f8f55]" />
            <span>100% Ayurvedic</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[940px] w-full mx-auto px-3.5 sm:px-6 py-5 sm:py-7">
        
        {/* Step Progress Indicator (Two-Step Checkout) */}
        {step < 3 && (
          <div className="mb-6 max-w-sm mx-auto">
            <div className="bg-white/90 backdrop-blur-xs p-1 rounded-full border border-[#d8dec2] shadow-2xs flex items-center justify-between">
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                step === 1 
                  ? 'bg-[#7f8f55] text-white shadow-xs' 
                  : 'text-[#7f8f55]'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 1 ? 'bg-white/20 text-white' : 'bg-[#d8dec2]/60 text-[#374011]'
                }`}>
                  {step > 1 ? <Check className="w-3 h-3 stroke-[2.5]" /> : '1'}
                </span>
                <span>Product Details</span>
              </div>

              <div className="w-8 h-0.5 bg-[#d8dec2] rounded-full mx-1 overflow-hidden">
                <div className={`h-full bg-[#7f8f55] transition-all duration-300 ${step > 1 ? 'w-full' : 'w-0'}`} />
              </div>

              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                step === 2 
                  ? 'bg-[#7f8f55] text-white shadow-xs' 
                  : 'text-[#374011]/50'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 2 ? 'bg-white/20 text-white' : 'bg-[#d8dec2]/40 text-[#374011]/40'
                }`}>
                  2
                </span>
                <span>Address Details</span>
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
            
            {/* Promoter ID Section (Ultra-Compact Height) */}
            <div className="bg-white rounded-xl border border-[#d8dec2] shadow-2xs px-3.5 sm:px-4 py-2 sm:py-2.5 transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <label htmlFor="promoter-id" className="text-xs font-bold text-[#374011] uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-[#7f8f55]" />
                  <span>Promoter ID <span className="text-red-500">*</span></span>
                </label>

                <div className="w-full sm:w-64 md:w-72 flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                      <Hash className="w-3.5 h-3.5" />
                    </div>
                    <input
                      id="promoter-id"
                      type="text"
                      value={promoterId}
                      onChange={(e) => {
                        setPromoterId(e.target.value);
                        if (errors.promoterId) setErrors((prev) => ({ ...prev, promoterId: null }));
                      }}
                      placeholder="e.g. PR-1001"
                      className={`h-9 w-full pl-8 pr-7 rounded-lg border text-xs sm:text-sm font-semibold text-[#374011] bg-white placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 transition shadow-2xs ${
                        errors.promoterId 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : promoterId.trim()
                          ? 'border-[#7f8f55] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                          : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                      }`}
                    />
                    {promoterId.trim() && (
                      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[#7f8f55]">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                  {errors.promoterId && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{errors.promoterId}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Product Selection Section */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-xs font-bold text-[#374011] uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#7f8f55]" />
                  <span>Select Products <span className="text-red-500">*</span></span>
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#374011]/80 font-semibold bg-[#d8dec2]/40 px-2.5 py-0.5 rounded-full border border-[#a9b48a]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7f8f55]" />
                  {products.length} Formulations Available
                </span>
              </div>

              {loadingProducts ? (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-56 sm:h-64 rounded-2xl bg-white border border-[#d8dec2] p-2.5 sm:p-3.5 animate-pulse space-y-2 sm:space-y-3">
                      <div className="w-full h-28 sm:h-32 bg-[#f4f6ee] rounded-xl" />
                      <div className="h-3 sm:h-4 bg-[#f4f6ee] rounded w-3/4" />
                      <div className="h-4 sm:h-5 bg-[#f4f6ee] rounded w-1/3" />
                      <div className="h-8 sm:h-10 bg-[#f4f6ee] rounded" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#d8dec2] text-[#374011]/70 text-sm">
                  No active products are available right now.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  {products.map((prod) => {
                    const existing = selectedItems.find((it) => it.product_id === prod.id);
                    const isSelected = !!existing;

                    return (
                      <div 
                        key={prod.id} 
                        className={`group relative flex flex-col justify-between h-full rounded-2xl border transition-all duration-300 p-2.5 sm:p-4 bg-white ${
                          isSelected 
                            ? 'border-[#7f8f55] ring-2 ring-[#7f8f55]/30 bg-gradient-to-b from-white via-white to-[#f4f6ee]/40 shadow-sm' 
                            : 'border-[#d8dec2] hover:border-[#a9b48a] hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        <div>
                          {/* Product Image Container */}
                          <div className="relative w-full h-28 sm:h-40 rounded-xl bg-gradient-to-b from-[#f8f9f4] via-[#f4f6ee] to-[#ebeece]/40 border border-[#d8dec2]/60 flex items-center justify-center p-2 sm:p-3 mb-2 sm:mb-3 overflow-hidden">
                            <img
                              src={getImageUrl(prod.image_url)}
                              alt={prod.name}
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                if (!e.target.dataset.triedLocal && prod.image_url) {
                                  e.target.dataset.triedLocal = 'true';
                                  e.target.src = prod.image_url.startsWith('/') ? prod.image_url : `/${prod.image_url}`;
                                  return;
                                }
                                e.target.onerror = null;
                                e.target.src = '/uploads/products/dhaara-oil-100ml.svg';
                              }}
                            />
                          </div>

                          {/* Product Name */}
                          <div className="min-h-[2.2rem] sm:min-h-[2.5rem] mb-1 sm:mb-1.5 flex items-start">
                            <h3 
                              className="text-xs sm:text-sm font-bold text-[#374011] leading-snug line-clamp-2" 
                              title={prod.name}
                            >
                              {prod.name}
                            </h3>
                          </div>

                          {/* Price in INR & Delivery Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2.5 sm:mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-base sm:text-xl font-black text-[#374011] font-mono tracking-tight">
                                {formatINR(prod.price)}
                              </span>
                              <span className="text-[10px] sm:text-xs text-[#374011]/60 font-semibold">/unit</span>
                            </div>

                            {prod.shipping_type === 'free' ? (
                              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-[#7f8f55]/15 text-[#374011] border border-[#7f8f55]/30 w-fit">
                                <Truck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#7f8f55]" />
                                <span>Free Delivery</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-[#f4f6ee] text-[#374011]/70 border border-[#d8dec2] w-fit" title="Prepaid: +₹40 | COD: +₹60">
                                <Truck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#7f8f55]" />
                                <span className="inline sm:hidden">+Delivery</span>
                                <span className="hidden sm:inline">Prepaid +₹40 | COD +₹60</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Slot & Subtotal */}
                        <div className="pt-2 sm:pt-3 border-t border-[#d8dec2]/70 mt-auto">
                          {isSelected ? (
                            <div className="space-y-1.5 sm:space-y-2">
                              {/* Subtotal calculation for each selected product */}
                              <div className="flex items-center justify-between text-[11px] sm:text-xs px-0.5 text-[#374011]">
                                <span className="font-semibold text-[#374011]/70">Subtotal:</span>
                                <span className="font-mono font-bold text-xs sm:text-sm text-[#7f8f55]">
                                  {formatINR(prod.price * existing.quantity)}
                                </span>
                              </div>

                              {/* Stepper with plus and minus buttons */}
                              <div className="w-full h-8 sm:h-10 flex items-center justify-between border border-[#7f8f55]/40 rounded-xl overflow-hidden bg-[#d8dec2]/30 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(prod.id, existing.quantity - 1)}
                                  className="w-7 sm:w-10 h-full flex items-center justify-center bg-[#d8dec2]/70 hover:bg-[#d8dec2] text-[#374011] transition active:scale-90"
                                  title="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                                </button>
                                <span className="flex-1 text-center font-bold font-mono text-[11px] sm:text-sm text-[#374011]">
                                  <span className="inline sm:hidden">{existing.quantity}</span>
                                  <span className="hidden sm:inline">{existing.quantity} in order</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(prod.id, existing.quantity + 1)}
                                  className="w-7 sm:w-10 h-full flex items-center justify-center bg-[#d8dec2]/70 hover:bg-[#d8dec2] text-[#374011] transition active:scale-90"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddItem(prod.id)}
                              className="w-full h-8 sm:h-10 rounded-xl bg-[#7f8f55] hover:bg-[#6d7d45] active:bg-[#5c6a38] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition shadow-xs hover:shadow active:scale-[0.98]"
                            >
                              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                              <span>
                                <span className="inline sm:hidden">Add</span>
                                <span className="hidden sm:inline">Add to Order</span>
                              </span>
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

            

          </form>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: ADDRESS DETAILS                                */}
        {/* ======================================================== */}
        {step === 2 && (
          <form id="address-order-form" onSubmit={handleSubmitOrder} className="w-full space-y-4 sm:space-y-5">
            {/* Customer Address Form Card */}
            <div className="bg-white rounded-2xl border border-[#d8dec2] shadow-xs p-4 sm:p-5 space-y-4 sm:space-y-5">
              <div className="border-b border-[#d8dec2]/70 pb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#374011] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#7f8f55]" />
                  <span>Customer Delivery Address</span>
                </h2>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#7f8f55] hover:text-[#374011] transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Products</span>
                </button>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Contact Information Group */}
              <div className="space-y-3.5">
                <span className="text-[11px] font-bold text-[#374011]/60 uppercase tracking-wider block">
                  Contact Information
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="full-name" className="block text-xs font-bold text-[#374011] mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4 text-[#7f8f55]/70" />
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
                        className={`h-11 w-full pl-9 pr-3 rounded-xl border text-sm text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          errors.fullName 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                        }`}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.fullName}</p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label htmlFor="phone-number" className="block text-xs font-bold text-[#374011] mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4 text-[#7f8f55]/70" />
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
                        className={`h-11 w-full pl-9 pr-3 rounded-xl border text-sm text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          errors.phoneNumber 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
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
              <div className="space-y-3.5 pt-2 border-t border-[#d8dec2]/70">
                <span className="text-[11px] font-bold text-[#374011]/60 uppercase tracking-wider block">
                  Delivery Address Details
                </span>

                {/* Complete Address */}
                <div>
                  <label htmlFor="complete-address" className="block text-xs font-bold text-[#374011] mb-1">
                    Complete Address (House No, Building, Road, Area, Landmark) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="complete-address"
                    rows={2}
                    value={completeAddress}
                    onChange={(e) => {
                      setCompleteAddress(e.target.value);
                      if (errors.completeAddress) setErrors({ ...errors, completeAddress: null });
                    }}
                    placeholder="House/Flat number, Building name, Street name, Area, Landmark"
                    className={`w-full p-3 rounded-xl border text-sm text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition resize-none ${
                      errors.completeAddress 
                        ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                        : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                    }`}
                  />
                  {errors.completeAddress && (
                    <p className="text-xs text-red-600 mt-1 font-medium">{errors.completeAddress}</p>
                  )}
                </div>

                {/* Pincode, Post Office, City, State Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Pincode */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="pincode" className="block text-xs font-bold text-[#374011]">
                        Pincode <span className="text-red-500">*</span>
                      </label>
                      {loadingPincode && (
                        <span className="text-[10px] text-[#7f8f55] flex items-center gap-1 font-semibold">
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
                        } else {
                          setPostOffices([]);
                          setPostOffice('');
                        }
                      }}
                      onBlur={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        if (clean.length === 6 && (!city || !stateName || postOffices.length === 0)) {
                          handlePincodeLookup(clean);
                        }
                      }}
                      placeholder="6 Digits"
                      className={`h-11 w-full px-3 rounded-xl border text-sm font-mono text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                        errors.pincode 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                      }`}
                    />
                    {errors.pincode && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.pincode}</p>
                    )}
                  </div>

                  {/* Post Office Dropdown / Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="post-office" className="block text-xs font-bold text-[#374011]">
                        Post Office <span className="text-red-500">*</span>
                      </label>
                      {postOffices.length > 0 && (
                        <span className="text-[10px] text-[#7f8f55] font-semibold">
                          {postOffices.length} options
                        </span>
                      )}
                    </div>
                    {postOffices.length > 0 ? (
                      <select
                        id="post-office"
                        value={postOffice}
                        onChange={(e) => {
                          setPostOffice(e.target.value);
                          if (errors.postOffice) setErrors((prev) => ({ ...prev, postOffice: null }));
                        }}
                        className={`h-11 w-full px-3 rounded-xl border text-sm text-[#374011] bg-white focus:outline-none focus:ring-2 transition ${
                          errors.postOffice 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                        }`}
                      >
                        <option value="">Select Post Office</option>
                        {postOffices.map((po) => (
                          <option key={po} value={po}>
                            {po}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="post-office"
                        type="text"
                        value={postOffice}
                        onChange={(e) => {
                          setPostOffice(e.target.value);
                          if (errors.postOffice) setErrors((prev) => ({ ...prev, postOffice: null }));
                        }}
                        placeholder={pincode.length === 6 ? "Enter Post Office" : "Enter Pincode first"}
                        className={`h-11 w-full px-3 rounded-xl border text-sm text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          errors.postOffice 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                            : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                        }`}
                      />
                    )}
                    {errors.postOffice && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.postOffice}</p>
                    )}
                  </div>

                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block text-xs font-bold text-[#374011] mb-1">
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
                      className={`h-11 w-full px-3 rounded-xl border text-sm text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                        errors.city 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
                      }`}
                    />
                    {errors.city && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{errors.city}</p>
                    )}
                  </div>

                  {/* State Dropdown */}
                  <div>
                    <label htmlFor="state-name" className="block text-xs font-bold text-[#374011] mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="state-name"
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        if (errors.stateName) setErrors({ ...errors, stateName: null });
                      }}
                      className={`h-11 w-full px-3 rounded-xl border text-sm text-[#374011] bg-white focus:outline-none focus:ring-2 transition ${
                        errors.stateName 
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-500' 
                          : 'border-[#d8dec2] focus:ring-[#7f8f55]/20 focus:border-[#7f8f55]'
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

              {/* Payment & Shipping Method Selection */}
              <div id="payment-section" className="space-y-3.5 pt-3 border-t border-[#d8dec2]/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#374011]/60 uppercase tracking-wider block">
                    Payment & Delivery Method <span className="text-red-500">*</span>
                  </span>
                  {currentShippingFee === 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7f8f55] bg-[#7f8f55]/15 px-2 py-0.5 rounded-full border border-[#7f8f55]/30">
                      <Truck className="w-3 h-3" />
                      <span>Free Delivery Applied</span>
                    </span>
                  )}
                </div>

                {/* Method Selection Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Prepaid UPI / QR */}
                  <div
                    onClick={() => {
                      if (!hasCodOnly) setPaymentMethod('prepaid');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMethod === 'prepaid'
                        ? 'border-[#7f8f55] bg-[#7f8f55]/10 ring-2 ring-[#7f8f55]/30 shadow-xs'
                        : 'border-[#d8dec2] bg-white hover:border-[#a9b48a]'
                    } ${hasCodOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="pay-prepaid"
                        name="payment_method"
                        value="prepaid"
                        disabled={hasCodOnly}
                        checked={paymentMethod === 'prepaid'}
                        onChange={() => setPaymentMethod('prepaid')}
                        className="text-[#7f8f55] focus:ring-[#7f8f55] w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="pay-prepaid" className="text-xs sm:text-sm font-bold text-[#374011] cursor-pointer flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-[#7f8f55]" />
                        <span>Prepaid (UPI / QR)</span>
                      </label>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      prepaidShippingFee === 0
                        ? 'bg-[#7f8f55]/20 text-[#374011] border border-[#7f8f55]/40'
                        : 'bg-[#7f8f55] text-white'
                    }`}>
                      {prepaidShippingFee === 0 ? 'FREE Delivery' : '+₹40 Delivery'}
                    </span>
                  </div>

                  {/* Option 2: Cash on Delivery */}
                  <div
                    onClick={() => {
                      if (!hasPrepaidOnly) setPaymentMethod('cod');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMethod === 'cod'
                        ? 'border-[#7f8f55] bg-[#7f8f55]/10 ring-2 ring-[#7f8f55]/30 shadow-xs'
                        : 'border-[#d8dec2] bg-white hover:border-[#a9b48a]'
                    } ${hasPrepaidOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="pay-cod"
                        name="payment_method"
                        value="cod"
                        disabled={hasPrepaidOnly}
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="text-[#7f8f55] focus:ring-[#7f8f55] w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="pay-cod" className="text-xs sm:text-sm font-bold text-[#374011] cursor-pointer flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#7f8f55]" />
                        <span>Cash on Delivery</span>
                      </label>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      codShippingFee === 0
                        ? 'bg-[#7f8f55]/20 text-[#374011] border border-[#7f8f55]/40'
                        : 'bg-[#d8dec2]/70 text-[#374011] border border-[#a9b48a]'
                    }`}>
                      {codShippingFee === 0 ? 'FREE Delivery' : '+₹60 Delivery'}
                    </span>
                  </div>
                </div>

                {/* Expanded Prepaid UPI QR & Payment Screenshot Box */}
                {paymentMethod === 'prepaid' && (
                  <div className="rounded-2xl border border-[#7f8f55]/40 bg-gradient-to-b from-[#f8f9f4] via-[#f4f6ee] to-white p-4 sm:p-5 text-center shadow-xs space-y-4">
                    {/* Header banner */}
                    <div>
                      <span className="text-[11px] font-bold text-[#7f8f55] uppercase tracking-wider block">
                        Scan & Pay
                      </span>
                      <div className="mt-1 flex items-baseline justify-center gap-1.5">
                        <span className="text-xs text-[#374011]/70 font-medium">Total Payable:</span>
                        <span className="font-mono text-2xl sm:text-3xl font-black text-[#374011] tracking-tight">
                          {formatINR(grandTotal)}
                        </span>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="relative mx-auto max-w-[250px] sm:max-w-[270px] bg-white rounded-2xl p-2.5 shadow-sm border border-[#d8dec2]">
                      <img
                        src="/dhaara-payment-qr.jpg"
                        alt="DHAARA WELLNESS UPI Payment QR Code"
                        className="w-full h-auto rounded-xl object-contain"
                      />
                    </div>

                    {/* UPI ID Row with Copy button */}
                    <div className="max-w-sm mx-auto bg-white border border-[#d8dec2] rounded-xl p-2 flex items-center justify-between shadow-2xs">
                      <div className="text-left px-2 min-w-0">
                        <span className="text-[9px] uppercase font-bold text-[#374011]/50 block">UPI ID</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-[#374011] truncate block select-all">
                          {UPI_ID}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-2.5 py-1.5 rounded-lg bg-[#f4f6ee] hover:bg-[#d8dec2]/50 border border-[#d8dec2] text-[#374011] text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-95 flex-shrink-0"
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#7f8f55]" />
                            <span className="text-[#7f8f55]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#7f8f55]" />
                            <span>Copy UPI</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Direct UPI Intent Link for Mobile Devices */}
                    <div className="max-w-sm mx-auto sm:hidden">
                      <a
                        href={`upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=Dhaara%20Wellness&am=${grandTotal}&cu=INR`}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#7f8f55] hover:bg-[#6f7e49] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Pay {formatINR(grandTotal)} via UPI App</span>
                      </a>
                    </div>

                    {/* Payment Screenshot Upload Section */}
                    <div className="pt-3 border-t border-[#d8dec2]/70 text-left max-w-md mx-auto space-y-2">
                      <label className="block text-xs font-bold text-[#374011]">
                        Upload Payment Screenshot <span className="text-red-500">*</span>
                      </label>

                      {paymentScreenshotPreview ? (
                        <div className="relative rounded-xl border border-[#7f8f55] bg-white p-3 flex items-center gap-3 shadow-xs">
                          <div className="w-14 h-14 rounded-lg bg-[#f4f6ee] border border-[#d8dec2] overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <img
                              src={paymentScreenshotPreview}
                              alt="Payment Screenshot Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-xs font-bold text-[#7f8f55]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Screenshot Attached</span>
                            </div>
                            <p className="text-[11px] text-[#374011]/70 truncate font-mono mt-0.5">
                              {paymentScreenshotFile?.name || 'payment_screenshot.jpg'}
                            </p>
                            <button
                              type="button"
                              onClick={() => fileInputPaymentRef.current?.click()}
                              className="text-[11px] text-[#7f8f55] font-bold hover:underline mt-0.5 cursor-pointer block"
                            >
                              Change Screenshot
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentScreenshotFile(null);
                              setPaymentScreenshotPreview('');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remove screenshot"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputPaymentRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition bg-white hover:bg-[#f4f6ee]/60 ${
                            errors.paymentScreenshot
                              ? 'border-red-400 bg-red-50/40'
                              : 'border-[#a9b48a] hover:border-[#7f8f55]'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-[#f4f6ee] text-[#7f8f55] flex items-center justify-center mx-auto mb-2 border border-[#d8dec2]">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-[#374011] block">
                            Click to upload Payment Screenshot
                          </span>
                          <span className="text-[11px] text-[#374011]/60 block mt-0.5">
                            JPG, PNG, or WEBP (Max 15MB)
                          </span>
                        </div>
                      )}

                      <input
                        type="file"
                        ref={fileInputPaymentRef}
                        onChange={handleScreenshotChange}
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        className="hidden"
                      />

                      {errors.paymentScreenshot && (
                        <p className="text-xs text-red-600 flex items-center gap-1 font-semibold pt-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{errors.paymentScreenshot}</span>
                        </p>
                      )}

                      {/* Optional UTR / Transaction ID */}
                      <div className="pt-2">
                        <label htmlFor="transaction-id" className="block text-[11px] font-bold text-[#374011] mb-1">
                          UPI / UTR Transaction ID <span className="text-[#374011]/50 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="transaction-id"
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="e.g. 12-digit UTR from payment receipt"
                          className="h-10 w-full px-3 rounded-xl border border-[#d8dec2] text-xs font-mono text-[#374011] bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 3: ORDER SUCCESS CONFIRMATION                       */}
        {/* ======================================================== */}
        {step === 3 && orderResult && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white rounded-2xl border border-[#d8dec2] shadow-sm p-5 sm:p-7 text-center space-y-4">
              
              {/* Brand Logo */}
              <div className="flex flex-col items-center">
                <img 
                  src="/dhaara-logo-dark.png" 
                  alt="dhaara wellness" 
                  className="h-8 w-auto object-contain mb-1" 
                />
              </div>

              <div className="w-12 h-12 rounded-full bg-[#d8dec2]/50 text-[#7f8f55] mx-auto flex items-center justify-center border border-[#a9b48a] shadow-2xs">
                <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#374011] tracking-tight">
                  Order Placed Successfully!
                </h2>
                <p className="text-xs text-[#374011]/70 mt-1 font-medium">
                  Thank you for ordering with Dhaara Wellness. Your order has been recorded.
                </p>
              </div>

              {/* Order ID Banner with Copy Option */}
              <div className="p-3 rounded-xl bg-[#f4f6ee] border border-[#d8dec2] max-w-xs mx-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#374011]/60 block mb-1">
                  Generated Order ID
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="font-mono text-lg font-bold text-[#374011] tracking-wider">
                    {orderResult.orderId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    title="Copy Order ID"
                    className="p-1.5 rounded-lg bg-white border border-[#d8dec2] text-[#374011] hover:text-[#7f8f55] transition shadow-2xs"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[#7f8f55]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-[11px] text-[#7f8f55] font-bold mt-1">
                    Order ID copied to clipboard!
                  </p>
                )}
              </div>

              {/* Order Receipt Details */}
              <div className="text-left bg-[#f4f6ee] rounded-xl p-3.5 sm:p-4 border border-[#d8dec2] space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-[#d8dec2]/80 pb-2">
                  <span className="font-bold text-[#374011] uppercase tracking-wider text-[11px]">
                    Order Receipt
                  </span>
                  <span className="text-[#374011]/70 font-mono text-[11px] font-semibold">
                    {orderResult.orderDate ? new Date(orderResult.orderDate).toLocaleString('en-IN') : 'Just now'}
                  </span>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#374011]/60 block mb-0.5 font-medium">Customer Name:</span>
                    <span className="font-bold text-[#374011]">{orderResult.customerName}</span>
                  </div>
                  <div>
                    <span className="text-[#374011]/60 block mb-0.5 font-medium">Phone Number:</span>
                    <span className="font-bold text-[#374011]">{orderResult.phoneNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[#374011]/60 block mb-0.5 font-medium">Delivery Address:</span>
                    <span className="font-medium text-[#374011]">
                      {orderResult.completeAddress}{orderResult.postOffice ? `, PO: ${orderResult.postOffice}` : ''}, {orderResult.city}, {orderResult.state} - {orderResult.pincode}
                    </span>
                  </div>
                </div>

                {/* Itemized List */}
                <div className="border-t border-[#d8dec2]/80 pt-2">
                  <span className="font-bold text-[#374011] uppercase tracking-wider text-[11px] block mb-1.5">
                    Ordered Products ({orderResult.items?.length || 0})
                  </span>
                  <div className="space-y-1">
                    {(orderResult.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#d8dec2]/70">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-[#374011] block truncate">
                            {it.name || it.product_name}
                          </span>
                          <span className="text-[10px] text-[#374011]/60 font-mono">
                            Qty: {it.quantity} × {formatINR(it.price || it.product_price)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#374011] whitespace-nowrap">
                          {formatINR(it.subtotal !== undefined ? it.subtotal : (it.price || it.product_price) * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="border-t border-[#d8dec2]/80 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[#374011]/80">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-[#374011]">
                      {orderResult.paymentMethod === 'prepaid' ? 'Prepaid (UPI / QR)' : 'Cash on Delivery (COD)'}
                    </span>
                  </div>

                  {orderResult.transactionId && (
                    <div className="flex justify-between items-center text-[#374011]/80">
                      <span>Transaction / UTR:</span>
                      <span className="font-mono font-semibold text-[#374011]">
                        {orderResult.transactionId}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[#374011]/80">
                    <span>Items Subtotal:</span>
                    <span className="font-mono font-semibold">
                      {formatINR(orderResult.itemsAmount !== undefined ? orderResult.itemsAmount : (orderResult.totalAmount - (orderResult.shippingAmount || 0)))}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[#374011]/80">
                    <span>Delivery Fee:</span>
                    <span className="font-mono font-semibold">
                      {(orderResult.shippingAmount || 0) === 0 ? (
                        <span className="text-[#7f8f55] font-bold uppercase text-[10px]">Free Delivery</span>
                      ) : (
                        `+${formatINR(orderResult.shippingAmount)}`
                      )}
                    </span>
                  </div>

                  <div className="border-t border-[#d8dec2]/80 pt-1.5 flex items-center justify-between">
                    <span className="font-bold text-[#374011]">Total Amount:</span>
                    <span className="text-base font-black text-[#374011] font-mono">
                      {formatINR(orderResult.totalAmount)}
                    </span>
                  </div>
                </div>

                {orderResult.paymentMethod === 'prepaid' && (
                  <div className="p-2.5 rounded-xl bg-white border border-[#7f8f55]/40 flex items-center gap-2 text-[11px] text-[#374011]">
                    <CheckCircle2 className="w-4 h-4 text-[#7f8f55] flex-shrink-0" />
                    <span>Payment screenshot uploaded. Verification in progress.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl border border-[#d8dec2] bg-white text-[#374011] font-bold text-xs hover:bg-[#d8dec2]/30 transition inline-flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl bg-[#7f8f55] text-white font-bold text-xs hover:bg-[#6d7d45] active:bg-[#5c6a38] transition shadow-xs inline-flex items-center justify-center gap-1.5"
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
              className="fixed inset-0 bg-[#374011]/30 backdrop-blur-[2px] z-35 sm:hidden transition-opacity duration-200"
              onClick={() => setIsSummaryExpanded(false)}
            />
          )}

          <div
            id="floating-order-summary-container"
            className="fixed bottom-0 inset-x-0 w-full sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto z-40 select-none bg-white/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t sm:border-0 border-[#d8dec2] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] sm:shadow-none px-3.5 sm:px-0 py-2.5 sm:py-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
          >
            {/* Expanded Popover (Above the Widget, centered on desktop, full-card drawer on mobile) */}
            {isSummaryExpanded && (
              <div 
                className="absolute bottom-full mb-2.5 sm:mb-3 bg-white rounded-2xl border border-[#d8dec2] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50 text-[#374011] left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto w-auto sm:w-[340px] max-w-none sm:max-w-[360px]"
              >
                {/* Popover Header */}
                <div className="bg-[#d8dec2]/35 px-3.5 py-2.5 border-b border-[#d8dec2] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-[#7f8f55] text-white flex items-center justify-center">
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-[#374011] text-xs sm:text-sm">
                      Your Order
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#7f8f55] text-white shadow-2xs">
                      {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSummaryExpanded(false);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-[#374011] hover:bg-[#d8dec2]/50 transition cursor-pointer"
                    title="Close summary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Scrollable Items List (Compact 280-320px width without cutting off text) */}
                <div className="p-2.5 sm:p-3 max-h-56 sm:max-h-64 overflow-y-auto divide-y divide-[#d8dec2]/60">
                  {itemsWithDetails.map((it) => (
                    <div key={it.product_id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                      {/* Product Thumbnail & Name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#f4f6ee] border border-[#d8dec2]/80 p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={getImageUrl(it.image_url)}
                            alt={it.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              if (!e.target.dataset.triedLocal && it.image_url) {
                                e.target.dataset.triedLocal = 'true';
                                e.target.src = it.image_url.startsWith('/') ? it.image_url : `/${it.image_url}`;
                                return;
                              }
                              e.target.onerror = null;
                              e.target.src = '/uploads/products/dhaara-oil-100ml.svg';
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-[#374011] text-xs truncate block" title={it.name}>
                            {it.name}
                          </span>
                          <span className="text-[10px] text-[#374011]/60 font-mono">
                            {formatINR(it.price)} each
                          </span>
                        </div>
                      </div>

                      {/* Quantity Controls, Subtotal, Remove */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Stepper */}
                        <div className="inline-flex items-center border border-[#d8dec2] rounded-lg bg-white overflow-hidden shadow-2xs h-6">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(it.product_id, it.quantity - 1)}
                            className="w-5.5 h-full flex items-center justify-center text-[#374011]/70 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition"
                            title="Decrease quantity"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="px-1 text-[11px] font-bold font-mono text-[#374011] min-w-[16px] text-center">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(it.product_id, it.quantity + 1)}
                            className="w-5.5 h-full flex items-center justify-center text-[#374011]/70 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition"
                            title="Increase quantity"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Individual Subtotal */}
                        <span className="font-mono font-bold text-[#374011] text-xs min-w-[48px] text-right">
                          {formatINR(it.subtotal)}
                        </span>

                        {/* Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.product_id)}
                          title="Remove item"
                          className="p-0.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Popover Footer with Grand Total & Action */}
                <div className="bg-[#f4f6ee] p-2.5 sm:p-3 border-t border-[#d8dec2] space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-white border border-[#d8dec2] space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#374011]/80">
                      <span>Items Subtotal:</span>
                      <span className="font-mono font-bold text-[#374011]">{formatINR(totalAmount)}</span>
                    </div>
                    {step === 2 && (
                      <div className="flex items-center justify-between text-xs text-[#374011]/80">
                        <span>Delivery ({paymentMethod === 'prepaid' ? 'Prepaid UPI' : 'COD'}):</span>
                        <span className="font-mono font-bold text-[#374011]">
                          {currentShippingFee === 0 ? 'FREE' : `+${formatINR(currentShippingFee)}`}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-[#d8dec2] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#374011]/70 uppercase tracking-wider block leading-tight">
                          Total Amount
                        </span>
                        <span className="text-[9px] text-[#7f8f55] font-semibold">
                          {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <span className="text-base font-black font-mono text-[#374011]">
                        {formatINR(step === 2 ? grandTotal : totalAmount)}
                      </span>
                    </div>
                  </div>

                  {step === 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSummaryExpanded(false);
                        handleNext();
                      }}
                      className="w-full h-9.5 rounded-xl bg-[#7f8f55] hover:bg-[#6d7d45] active:bg-[#5c6a38] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs hover:shadow active:scale-[0.99] cursor-pointer"
                    >
                      <span>Continue to Address Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {step === 2 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSummaryExpanded(false);
                          handleBack();
                        }}
                        className="h-9.5 px-3 rounded-xl border border-[#d8dec2] bg-white hover:bg-[#d8dec2]/30 text-[#374011] font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSummaryExpanded(false);
                          handleSubmitOrder();
                        }}
                        className="flex-1 h-9.5 rounded-xl bg-[#7f8f55] hover:bg-[#6d7d45] active:bg-[#5c6a38] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs hover:shadow active:scale-[0.99] cursor-pointer disabled:opacity-60"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Placing Order...</span>
                          </>
                        ) : (
                          <>
                            <span>Confirm & Place Order</span>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Bar: Order Items & Total Button + Attached Action Buttons (Centered) */}
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 max-w-lg sm:max-w-none mx-auto w-full sm:w-auto sm:bg-white/95 sm:backdrop-blur-md sm:rounded-full sm:border sm:border-[#d8dec2] sm:shadow-xl sm:p-1.5 sm:ring-2 sm:ring-[#7f8f55]/20">
              {/* Your Order Items & Total Button (Click to toggle summary popover) */}
              <button
                type="button"
                onClick={handleFloatingClick}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-full hover:bg-[#f4f6ee] active:bg-[#d8dec2]/40 text-[#374011] transition cursor-pointer text-xs sm:text-sm font-bold flex-shrink-0"
                aria-expanded={isSummaryExpanded}
                title="Click to view order items breakdown"
              >
                <div className="relative flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto rounded-full bg-[#f4f6ee] sm:bg-transparent border border-[#d8dec2]/60 sm:border-0 flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-[#7f8f55]" />
                  <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-2 bg-[#7f8f55] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-2xs">
                    {totalQuantity}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1.5 leading-tight sm:leading-normal text-left">
                  <span className="text-[10px] sm:text-xs text-[#7f8f55] sm:text-[#374011] font-bold">
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                  </span>
                  <span className="hidden sm:inline text-[#d8dec2]">|</span>
                  <span className="font-mono font-black text-[#374011] text-xs sm:text-sm">
                    {formatINR(step === 2 ? grandTotal : totalAmount)}
                  </span>
                </div>

                <ChevronUp 
                  className={`w-3.5 h-3.5 text-[#7f8f55] transition-transform duration-200 ml-0.5 sm:ml-0 ${isSummaryExpanded ? 'rotate-180' : ''}`} 
                />
              </button>

              {/* Step 1: Continue to Address Button directly attached */}
              {step === 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSummaryExpanded(false);
                    handleNext();
                  }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 h-10 sm:h-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full bg-[#7f8f55] hover:bg-[#6d7d45] active:bg-[#5c6a38] text-white shadow-md hover:shadow-lg shadow-[#7f8f55]/25 font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <span>Continue to Address</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </button>
              )}

              {/* Step 2: Back Button & Confirm Order Button directly attached to item button */}
              {step === 2 && (
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-center">
                  {/* Attached Back Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSummaryExpanded(false);
                      handleBack();
                    }}
                    className="flex items-center justify-center gap-1 h-10 sm:h-auto px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-full border border-[#d8dec2] bg-white hover:bg-[#f4f6ee] active:bg-[#d8dec2]/40 text-[#374011] font-bold text-xs sm:text-sm transition shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap flex-shrink-0"
                    title="Return to select products"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Back</span>
                  </button>

                  {/* Attached Confirm Order Button */}
                  <button
                    type="submit"
                    form="address-order-form"
                    disabled={submitting}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSummaryExpanded(false);
                      handleSubmitOrder();
                    }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 h-10 sm:h-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full bg-[#7f8f55] hover:bg-[#6d7d45] active:bg-[#5c6a38] text-white shadow-md hover:shadow-lg shadow-[#7f8f55]/25 font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Placing...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm Order</span>
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
