import React, { useState, useEffect, useRef } from 'react';
import { apiUrl, getImageUrl } from '../config';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Upload, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Package, 
  Eye, 
  EyeOff,
  Image as ImageIcon,
  IndianRupee
} from 'lucide-react';

export default function ProductManagement({ token }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null if adding new

  // Form fields
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('500');
  const [isActive, setIsActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal state
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/admin/products'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load products. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProductName('');
    setProductPrice('500');
    setIsActive(true);
    setSelectedFile(null);
    setPreviewUrl('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price !== undefined ? product.price.toString() : '0');
    setIsActive(product.is_active === 1);
    setSelectedFile(null);
    setPreviewUrl(product.image_url);
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setSelectedFile(null);
    setPreviewUrl('');
    setFormError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFormError('Please select a valid image file (PNG, JPG, SVG, WEBP)');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFormError('');
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productName.trim()) {
      setFormError('Product name is required');
      return;
    }

    const parsedPrice = parseFloat(productPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Please enter a valid product price (₹)');
      return;
    }

    if (!editingProduct && !selectedFile) {
      setFormError('Please upload a product image');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('name', productName.trim());
      formData.append('price', parsedPrice);
      formData.append('is_active', isActive ? '1' : '0');
      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      let res;
      if (editingProduct) {
        // Edit existing product
        res = await fetch(apiUrl(`/api/admin/products/${editingProduct.id}`), {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      } else {
        // Add new product
        res = await fetch(apiUrl('/api/admin/products'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      closeModal();
      fetchProducts();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle active status
  const handleToggleActive = async (product) => {
    try {
      const formData = new FormData();
      formData.append('name', product.name);
      formData.append('price', product.price || 0);
      formData.append('is_active', product.is_active === 1 ? '0' : '1');

      const res = await fetch(apiUrl(`/api/admin/products/${product.id}`), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Failed to update product status');
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  // Delete product
  const confirmDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/products/${deletingProduct.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete product');
      setDeletingProduct(null);
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  return (
    <div className="space-y-6">
      {/* Top toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Product Management
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProducts}
            disabled={loading}
            title="Refresh Products"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
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
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            No products added yet
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Click "Add Product" to add your first product to the catalog.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
            >
              <div>
                {/* Product Image & Status Header */}
                <div className="relative w-full h-44 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-3 overflow-hidden mb-3.5">
                  <img
                    src={getImageUrl(product.image_url)}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                    }}
                  />

                  {/* Status Badge */}
                  <span
                    className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                      product.is_active === 1
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    <span 
                      className={`w-1.5 h-1.5 rounded-full ${
                        product.is_active === 1 ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} 
                    />
                    {product.is_active === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Product Name */}
                <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">
                  {product.name}
                </h3>
                
                {/* Product Price Tag */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {formatINR(product.price)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: #{product.id}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {/* Quick Toggle Active Button */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(product)}
                  title={product.is_active === 1 ? 'Deactivate product' : 'Activate product'}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition ${
                    product.is_active === 1
                      ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {product.is_active === 1 ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Activate</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(product)}
                    title="Edit Product"
                    className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingProduct(product)}
                    title="Delete Product"
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT PRODUCT MODAL                                 */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label 
                  htmlFor="product-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Wireless Noise-Canceling Headphones"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                />
              </div>

              {/* Product Price (₹) */}
              <div>
                <label 
                  htmlFor="product-price"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Product Price in INR (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                    ₹
                  </div>
                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="1"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="500"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  This price will be displayed to customers and used for total calculation.
                </p>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Image {!editingProduct && <span className="text-red-500">*</span>}
                </label>

                {previewUrl ? (
                  <div className="relative w-full h-36 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center p-2 mb-2">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl('');
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 text-xs text-slate-600 flex items-center justify-center gap-2 transition"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>{previewUrl ? 'Change image file' : 'Upload product image (PNG, JPG, SVG)'}</span>
                </button>
              </div>

              {/* Active Toggle Checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Product is active (visible in customer order form)
                  </span>
                </label>
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Update Product' : 'Save Product'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                                */}
      {/* ======================================================== */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 sm:p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Delete Product?
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Are you sure you want to delete <strong className="text-slate-700">"{deletingProduct.name}"</strong>? This action cannot be undone.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
