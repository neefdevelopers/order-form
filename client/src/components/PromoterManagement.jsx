import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  Eye, 
  EyeOff, 
  Search,
  ShieldCheck,
  CheckCircle2,
  ShoppingCart,
  Download,
  ExternalLink,
  ListOrdered,
  FileSpreadsheet
} from 'lucide-react';
import PromoterOrdersView from './PromoterOrdersView';

export default function PromoterManagement({ token }) {
  const [selectedPromoterForOrders, setSelectedPromoterForOrders] = useState(null);
  const [promoters, setPromoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingCode, setExportingCode] = useState(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromoter, setEditingPromoter] = useState(null);

  // Form fields
  const [promoterCode, setPromoterCode] = useState('');
  const [promoterName, setPromoterName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deletingPromoter, setDeletingPromoter] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPromoters();
  }, []);

  // Export orders specifically for this promoter
  const handleExportPromoter = async (code) => {
    if (!code) return;
    setExportingCode(code);
    try {
      const res = await fetch(`/api/admin/orders/export?promoter_id=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export orders');

      let filename = `Orders_${code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    } catch (err) {
      console.error(err);
      alert(`Could not export orders for promoter ${code}`);
    } finally {
      setExportingCode(null);
    }
  };

  const fetchPromoters = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/promoters', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load promoters');
      const data = await res.json();
      setPromoters(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load promoter IDs. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingPromoter(null);
    setPromoterCode('');
    setPromoterName('');
    setIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (promoter) => {
    setEditingPromoter(promoter);
    setPromoterCode(promoter.promoter_code);
    setPromoterName(promoter.name || '');
    setIsActive(promoter.is_active === 1);
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPromoter(null);
    setFormError('');
  };

  const handleSavePromoter = async (e) => {
    e.preventDefault();
    if (!promoterCode.trim()) {
      setFormError('Promoter ID code is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        promoter_code: promoterCode.trim(),
        name: promoterName.trim(),
        is_active: isActive ? 1 : 0
      };

      let res;
      if (editingPromoter) {
        res = await fetch(`/api/admin/promoters/${editingPromoter.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/admin/promoters', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save promoter');
      }

      closeModal();
      fetchPromoters();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error saving promoter');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promoter) => {
    try {
      const res = await fetch(`/api/admin/promoters/${promoter.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          promoter_code: promoter.promoter_code,
          name: promoter.name,
          is_active: promoter.is_active === 1 ? 0 : 1
        })
      });

      if (!res.ok) throw new Error('Failed to update promoter status');
      fetchPromoters();
    } catch (err) {
      console.error(err);
      alert('Failed to update promoter status');
    }
  };

  const confirmDelete = async () => {
    if (!deletingPromoter) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/promoters/${deletingPromoter.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete promoter');
      setDeletingPromoter(null);
      fetchPromoters();
    } catch (err) {
      console.error(err);
      alert('Failed to delete promoter');
    } finally {
      setDeleting(false);
    }
  };

  const filteredPromoters = promoters.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.promoter_code.toLowerCase().includes(q) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  });

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  // If a promoter is selected to view orders, show the separate PromoterOrdersView
  if (selectedPromoterForOrders) {
    return (
      <PromoterOrdersView
        promoter={selectedPromoterForOrders}
        token={token}
        onBack={() => {
          setSelectedPromoterForOrders(null);
          fetchPromoters();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Promoter ID Management
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPromoters}
            disabled={loading}
            title="Refresh Promoters"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Promoter ID</span>
          </button>
        </div>
      </div>

      {/* Info notice: only authorized IDs can place orders */}
      <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center gap-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <p>
          <strong>Access Control:</strong> Only active Promoter IDs registered here are permitted to submit customer orders. Any unauthorized or inactive Promoter ID will be rejected.
        </p>
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
          placeholder="Search by Promoter Code or Name..."
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
          <p className="text-xs text-slate-500 font-medium">Loading promoter IDs...</p>
        </div>
      ) : filteredPromoters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {searchQuery ? 'No matching promoter IDs found' : 'No promoter IDs added yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add authorized promoter IDs so customer orders can be placed.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Promoter ID Now</span>
          </button>
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
                    <th className="py-3.5 px-4">Promoter ID Code</th>
                    <th className="py-3.5 px-4">Name / Label</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Orders Placed</th>
                    <th className="py-3.5 px-4">Date Added</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPromoters.map((p) => {
                    const orderCount = Number(p.order_count || 0);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition group">
                        {/* Clickable Promoter Code */}
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedPromoterForOrders(p)}
                            title={`Click to view order details for ${p.promoter_code}`}
                            className="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1.5 transition text-left group-hover:text-blue-800"
                          >
                            <span>{p.promoter_code}</span>
                            <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-600 opacity-60" />
                          </button>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                          {p.name || <span className="text-slate-400 italic">No name provided</span>}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              p.is_active === 1
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${p.is_active === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {p.is_active === 1 ? 'Active (Can Order)' : 'Inactive (Blocked)'}
                          </span>
                        </td>

                        {/* Order Count Badge - Clickable to View Orders */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedPromoterForOrders(p)}
                            title={`Click to view ${orderCount} orders for ${p.promoter_code}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                              orderCount > 0
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-2xs'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>{orderCount} {orderCount === 1 ? 'order' : 'orders'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>

                        {/* Actions: View Orders, Export, Toggle, Edit, Delete */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 1. Go to Promoter Orders */}
                            <button
                              type="button"
                              onClick={() => setSelectedPromoterForOrders(p)}
                              title={`View all order details for ${p.promoter_code}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition text-[11px] font-medium"
                            >
                              <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                              <span>View Orders</span>
                            </button>

                            {/* 2. Direct Export Excel for this Promoter */}
                            <button
                              type="button"
                              onClick={() => handleExportPromoter(p.promoter_code)}
                              disabled={exportingCode === p.promoter_code || orderCount === 0}
                              title={orderCount === 0 ? 'No orders to export' : `Export ${p.promoter_code} orders to Excel (.xlsx)`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition text-[11px] font-medium ${
                                orderCount > 0
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-2xs'
                                  : 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <Download className={`w-3.5 h-3.5 ${exportingCode === p.promoter_code ? 'animate-bounce' : ''}`} />
                              <span>Export</span>
                            </button>

                            {/* 3. Quick Toggle Active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(p)}
                              title={p.is_active === 1 ? 'Deactivate (block orders)' : 'Activate (allow orders)'}
                              className={`p-1.5 rounded-lg border transition ${
                                p.is_active === 1
                                  ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {p.is_active === 1 ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>

                            {/* 4. Edit */}
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              title="Edit Promoter Details"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* 5. Delete */}
                            <button
                              type="button"
                              onClick={() => setDeletingPromoter(p)}
                              title="Delete Promoter ID"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* MOBILE ADAPTIVE CARDS VIEW                               */}
          {/* ======================================================== */}
          <div className="block md:hidden space-y-3.5">
            {filteredPromoters.map((p) => {
              const orderCount = Number(p.order_count || 0);

              return (
                <div 
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedPromoterForOrders(p)}
                        className="font-mono text-sm font-bold text-blue-700 hover:underline flex items-center gap-1"
                      >
                        <span>{p.promoter_code}</span>
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      </button>
                      <p className="text-xs font-medium text-slate-800 mt-0.5">
                        {p.name || <span className="text-slate-400 italic">No name</span>}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        p.is_active === 1
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.is_active === 1 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {p.is_active === 1 ? 'Active' : 'Blocked'}
                    </span>
                  </div>

                  {/* Order Count & Date Added */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={() => setSelectedPromoterForOrders(p)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        orderCount > 0
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>{orderCount} {orderCount === 1 ? 'order' : 'orders'}</span>
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Added: {formatDate(p.created_at)}
                    </span>
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPromoterForOrders(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        <span>Orders</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportPromoter(p.promoter_code)}
                        disabled={exportingCode === p.promoter_code || orderCount === 0}
                        className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition ${
                          orderCount > 0
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-slate-400 bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      >
                        {p.is_active === 1 ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingPromoter(p)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT PROMOTER MODAL                                */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900">
                {editingPromoter ? 'Edit Promoter ID' : 'Add Authorized Promoter ID'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromoter} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Promoter Code */}
              <div>
                <label 
                  htmlFor="promoter-code-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Promoter ID Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="promoter-code-input"
                  type="text"
                  value={promoterCode}
                  onChange={(e) => setPromoterCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PR-1005"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Customers must enter this exact Promoter ID to place an order.
                </p>
              </div>

              {/* Promoter Name */}
              <div>
                <label 
                  htmlFor="promoter-name-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Promoter Name / Label (Optional)
                </label>
                <input
                  id="promoter-name-input"
                  type="text"
                  value={promoterName}
                  onChange={(e) => setPromoterName(e.target.value)}
                  placeholder="e.g. John Doe / City Agency"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition"
                />
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
                    Active (Authorized to place customer orders)
                  </span>
                </label>
              </div>

              {/* Submit & Cancel */}
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
                    <span>{editingPromoter ? 'Update Promoter' : 'Save Promoter ID'}</span>
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
      {deletingPromoter && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Delete Promoter ID?
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Are you sure you want to delete Promoter ID <strong className="font-mono text-slate-800">"{deletingPromoter.promoter_code}"</strong>? Customers using this ID will no longer be able to place orders.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingPromoter(null)}
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

