import React, { useState, useEffect } from 'react';
import { apiUrl } from '../config';
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
  FileSpreadsheet,
  Copy,
  Share2,
  Link2,
  Phone,
  MapPin,
  IdCard,
  User,
  Calendar
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
  const [promoterPhone, setPromoterPhone] = useState('');
  const [promoterAadhaar, setPromoterAadhaar] = useState('');
  const [promoterAddress, setPromoterAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Full Details Modal state
  const [viewingPromoterDetails, setViewingPromoterDetails] = useState(null);

  // Delete modal state
  const [deletingPromoter, setDeletingPromoter] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Link copy feedback & newly created promoter modal
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [createdPromoterInfo, setCreatedPromoterInfo] = useState(null);

  const getDashboardUrl = (accessToken) => {
    if (typeof window === 'undefined') return `/promoter/${accessToken}`;
    return `${window.location.origin}/promoter/${accessToken}`;
  };

  const handleCopyLink = (p) => {
    if (!p.access_token) return;
    const url = getDashboardUrl(p.access_token);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLinkId(p.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const handleShareWhatsApp = (p) => {
    if (!p.access_token) return;
    const url = getDashboardUrl(p.access_token);
    const msg = encodeURIComponent(
      `Hello ${p.name || p.promoter_code},\nHere is your unique Promoter Dashboard link:\n${url}\n\nYou can track all your orders and sales in real time without login.`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  useEffect(() => {
    fetchPromoters();
  }, []);

  // Export orders specifically for this promoter
  const handleExportPromoter = async (code) => {
    if (!code) return;
    setExportingCode(code);
    try {
      const res = await fetch(apiUrl(`/api/admin/orders/export?promoter_id=${encodeURIComponent(code)}`), {
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
      const res = await fetch(apiUrl('/api/admin/promoters'), {
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
    setPromoterPhone('');
    setPromoterAadhaar('');
    setPromoterAddress('');
    setIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (promoter) => {
    setEditingPromoter(promoter);
    setPromoterCode(promoter.promoter_code);
    setPromoterName(promoter.name || '');
    setPromoterPhone(promoter.phone_number || '');
    setPromoterAadhaar(promoter.aadhaar_number || '');
    setPromoterAddress(promoter.address || '');
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
    if (!promoterName.trim()) {
      setFormError('Promoter name is required');
      return;
    }
    if (!promoterPhone.trim()) {
      setFormError('Phone number is required');
      return;
    }
    if (!promoterAadhaar.trim()) {
      setFormError('Aadhaar number is required');
      return;
    }
    if (!promoterAddress.trim()) {
      setFormError('Promoter address is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        promoter_code: promoterCode.trim(),
        name: promoterName.trim(),
        phone_number: promoterPhone.trim(),
        aadhaar_number: promoterAadhaar.trim(),
        address: promoterAddress.trim(),
        is_active: isActive ? 1 : 0
      };

      let res;
      if (editingPromoter) {
        res = await fetch(apiUrl(`/api/admin/promoters/${editingPromoter.id}`), {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(apiUrl('/api/admin/promoters'), {
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

      const wasNew = !editingPromoter;
      const createdProm = data.promoter;

      // If this promoter was being viewed in details modal, update viewing state
      if (viewingPromoterDetails && data.promoter && viewingPromoterDetails.id === data.promoter.id) {
        setViewingPromoterDetails(prev => ({
          ...prev,
          ...data.promoter
        }));
      }

      closeModal();
      await fetchPromoters();

      if (wasNew && createdProm) {
        setCreatedPromoterInfo(createdProm);
      }
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error saving promoter');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promoter) => {
    try {
      const newActive = promoter.is_active === 1 ? 0 : 1;
      const res = await fetch(apiUrl(`/api/admin/promoters/${promoter.id}`), {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          is_active: newActive
        })
      });

      if (!res.ok) throw new Error('Failed to update promoter status');
      if (viewingPromoterDetails && viewingPromoterDetails.id === promoter.id) {
        setViewingPromoterDetails(prev => ({ ...prev, is_active: newActive }));
      }
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
      const res = await fetch(apiUrl(`/api/admin/promoters/${deletingPromoter.id}`), {
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
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.phone_number && p.phone_number.toLowerCase().includes(q)) ||
      (p.aadhaar_number && p.aadhaar_number.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
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
          <h2 className="text-xl font-bold text-[#374011]">
            Promoter ID Management
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPromoters}
            disabled={loading}
            title="Refresh Promoters"
            className="p-2.5 rounded-xl border border-[#d8dec2] bg-white text-[#374011] hover:bg-[#d8dec2]/30 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] active:bg-[#5c6a38] transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Promoter ID</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Promoter Code, Name, Phone, Aadhaar..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#d8dec2] text-xs text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-[#374011]/60 hover:text-[#374011]"
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
          <RefreshCw className="w-8 h-8 text-[#7f8f55] animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#374011]/70 font-medium">Loading promoter IDs...</p>
        </div>
      ) : filteredPromoters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#d8dec2] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f4f6ee] text-[#7f8f55] mx-auto flex items-center justify-center mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#374011]">
            {searchQuery ? 'No matching promoter IDs found' : 'No promoter IDs added yet'}
          </h3>
          <p className="text-xs text-[#374011]/70 mt-1 max-w-sm mx-auto">
            Add authorized promoter IDs so customer orders can be placed.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] transition shadow-xs"
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
          <div className="hidden md:block bg-white rounded-2xl border border-[#d8dec2] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d8dec2]/40 border-b border-[#d8dec2] text-[#374011] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Promoter ID Code</th>
                    <th className="py-3.5 px-4">Name / Label</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Orders Placed</th>
                    <th className="py-3.5 px-4">Dashboard Link</th>
                    <th className="py-3.5 px-4">Date Added</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8dec2]/40">
                  {filteredPromoters.map((p) => {
                    const orderCount = Number(p.order_count || 0);

                    return (
                      <tr key={p.id} className="hover:bg-[#d8dec2]/15 transition group">
                        {/* Clickable Promoter Code -> Opens Full Details */}
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingPromoterDetails(p)}
                            title={`Click to view full details for ${p.promoter_code}`}
                            className="text-[#7f8f55] hover:text-[#5c6a38] hover:underline inline-flex items-center gap-1.5 transition text-left"
                          >
                            <span>{p.promoter_code}</span>
                            <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-[#d8dec2]/40 text-[#374011]/80 group-hover:bg-[#d8dec2]">Details</span>
                          </button>
                        </td>

                        <td 
                          onClick={() => setViewingPromoterDetails(p)}
                          className="py-3.5 px-4 font-medium text-[#374011] whitespace-nowrap cursor-pointer hover:text-[#7f8f55] transition"
                          title="Click to view full details"
                        >
                          <div>{p.name || <span className="text-[#374011]/40 italic">No name provided</span>}</div>
                          {p.phone_number && (
                            <div className="text-[11px] text-[#374011]/60 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-[#7f8f55]" />
                              <span>{p.phone_number}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              p.is_active === 1
                                ? 'bg-[#d8dec2]/60 text-[#374011] border-[#a9b48a]'
                                : 'bg-[#f4f6ee] text-[#374011]/60 border-[#d8dec2]'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${p.is_active === 1 ? 'bg-[#7f8f55]' : 'bg-[#374011]/40'}`} />
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
                                ? 'bg-[#d8dec2]/40 text-[#374011] hover:bg-[#d8dec2] border border-[#a9b48a] shadow-xs'
                                : 'bg-[#f4f6ee] text-[#374011]/60 border border-[#d8dec2]'
                            }`}
                          >
                            <ShoppingCart className="w-3 h-3 text-[#7f8f55]" />
                            <span>{orderCount} {orderCount === 1 ? 'order' : 'orders'}</span>
                          </button>
                        </td>

                        {/* Shareable Dashboard Link */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(p)}
                              title="Copy unique dashboard link to clipboard"
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                                copiedLinkId === p.id
                                  ? 'bg-[#d8dec2] text-[#374011] border-[#a9b48a] shadow-xs'
                                  : 'bg-white text-[#374011] border-[#d8dec2] hover:bg-[#d8dec2]/30'
                              }`}
                            >
                              {copiedLinkId === p.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#7f8f55]" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-[#7f8f55]" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>

                            <a
                              href={getDashboardUrl(p.access_token)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open promoter dashboard in new tab"
                              className="p-1.5 rounded-lg border border-[#d8dec2] bg-white text-[#374011]/70 hover:text-[#7f8f55] hover:bg-[#d8dec2]/30 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#374011]/70 whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>

                        {/* Actions: View Details, View Orders, Export, Toggle, Edit, Delete */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 1. View Full Details Modal */}
                            <button
                              type="button"
                              onClick={() => setViewingPromoterDetails(p)}
                              title={`View full details for ${p.promoter_code}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#374011] bg-[#f4f6ee] hover:bg-[#d8dec2] border border-[#d8dec2] transition text-[11px] font-semibold"
                            >
                              <User className="w-3.5 h-3.5 text-[#7f8f55]" />
                              <span>Details</span>
                            </button>

                            {/* 2. Go to Promoter Orders */}
                            <button
                              type="button"
                              onClick={() => setSelectedPromoterForOrders(p)}
                              title={`View all order details for ${p.promoter_code}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#374011] bg-[#d8dec2]/50 hover:bg-[#d8dec2] border border-[#d8dec2] transition text-[11px] font-semibold"
                            >
                              <ListOrdered className="w-3.5 h-3.5 text-[#7f8f55]" />
                              <span>Orders</span>
                            </button>

                            {/* 3. Direct Export Excel for this Promoter */}
                            <button
                              type="button"
                              onClick={() => handleExportPromoter(p.promoter_code)}
                              disabled={exportingCode === p.promoter_code || orderCount === 0}
                              title={orderCount === 0 ? 'No orders to export' : `Export ${p.promoter_code} orders to Excel (.xlsx)`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition text-[11px] font-semibold ${
                                orderCount > 0
                                  ? 'text-white bg-[#7f8f55] border-[#7f8f55] hover:bg-[#6f7e49] shadow-xs'
                                  : 'text-[#374011]/40 bg-[#f4f6ee] border-[#d8dec2] cursor-not-allowed opacity-50'
                              }`}
                            >
                              <Download className={`w-3.5 h-3.5 ${exportingCode === p.promoter_code ? 'animate-bounce' : ''}`} />
                              <span>Export</span>
                            </button>

                            {/* 4. Quick Toggle Active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(p)}
                              title={p.is_active === 1 ? 'Deactivate (block orders)' : 'Activate (allow orders)'}
                              className={`p-1.5 rounded-lg border transition ${
                                p.is_active === 1
                                  ? 'bg-white text-[#374011] border-[#d8dec2] hover:bg-[#d8dec2]/30'
                                  : 'bg-[#d8dec2]/50 text-[#374011] border-[#a9b48a] hover:bg-[#d8dec2]'
                              }`}
                            >
                              {p.is_active === 1 ? <EyeOff className="w-3.5 h-3.5 text-[#374011]/60" /> : <Eye className="w-3.5 h-3.5 text-[#7f8f55]" />}
                            </button>

                            {/* 5. Edit */}
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              title="Edit Promoter Details"
                              className="p-1.5 rounded-lg text-[#374011] hover:text-[#7f8f55] hover:bg-[#d8dec2]/40 border border-[#d8dec2] transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* 6. Delete */}
                            <button
                              type="button"
                              onClick={() => setDeletingPromoter(p)}
                              title="Delete Promoter ID"
                              className="p-1.5 rounded-lg text-[#374011]/80 hover:text-red-600 hover:bg-red-50 border border-[#d8dec2] transition"
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
                  className="bg-white rounded-2xl border border-[#d8dec2] p-4 shadow-xs space-y-3"
                >
                  <div 
                    onClick={() => setViewingPromoterDetails(p)}
                    className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#d8dec2]/60 cursor-pointer hover:opacity-90 transition"
                    title="Tap to view full details"
                  >
                    <div>
                      <div className="font-mono text-sm font-bold text-[#7f8f55] flex items-center gap-1.5">
                        <span>{p.promoter_code}</span>
                        <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-[#d8dec2]/50 text-[#374011]">Details</span>
                      </div>
                      <p className="text-xs font-semibold text-[#374011] mt-0.5">
                        {p.name || <span className="text-[#374011]/40 italic">No name</span>}
                      </p>
                      {p.phone_number && (
                        <p className="text-[11px] text-[#374011]/70 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-[#7f8f55]" />
                          <span>{p.phone_number}</span>
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        p.is_active === 1
                          ? 'bg-[#d8dec2]/60 text-[#374011] border-[#a9b48a]'
                          : 'bg-[#f4f6ee] text-[#374011]/60 border-[#d8dec2]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.is_active === 1 ? 'bg-[#7f8f55]' : 'bg-[#374011]/40'}`} />
                      {p.is_active === 1 ? 'Active' : 'Blocked'}
                    </span>
                  </div>

                  {/* Order Count & Date Added */}
                  <div className="flex items-center justify-between text-xs text-[#374011]/80">
                    <button
                      type="button"
                      onClick={() => setSelectedPromoterForOrders(p)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        orderCount > 0
                          ? 'bg-[#d8dec2]/40 text-[#374011] border border-[#a9b48a]'
                          : 'bg-[#f4f6ee] text-[#374011]/60 border border-[#d8dec2]'
                      }`}
                    >
                      <ShoppingCart className="w-3 h-3 text-[#7f8f55]" />
                      <span>{orderCount} {orderCount === 1 ? 'order' : 'orders'}</span>
                    </button>
                    <span className="text-[11px] text-[#374011]/60">
                      Added: {formatDate(p.created_at)}
                    </span>
                  </div>

                  {/* Mobile Shareable Dashboard Link */}
                  <div className="pt-2 border-t border-[#d8dec2]/60 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(p)}
                      className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-xs font-semibold transition ${
                        copiedLinkId === p.id
                          ? 'bg-[#d8dec2] text-[#374011] border-[#a9b48a]'
                          : 'bg-white text-[#374011] border-[#d8dec2] hover:bg-[#d8dec2]/30'
                      }`}
                    >
                      {copiedLinkId === p.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#7f8f55]" />
                          <span>Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#7f8f55]" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={getDashboardUrl(p.access_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl border border-[#d8dec2] bg-white text-[#374011]/70 hover:bg-[#d8dec2]/30 hover:text-[#7f8f55]"
                      title="Open Dashboard"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="pt-2 border-t border-[#d8dec2]/60 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() => setViewingPromoterDetails(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[#374011] bg-[#f4f6ee] hover:bg-[#d8dec2] border border-[#d8dec2] text-[11px] font-semibold transition"
                      >
                        <User className="w-3 h-3 text-[#7f8f55]" />
                        <span>Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPromoterForOrders(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[#374011] bg-[#d8dec2]/50 hover:bg-[#d8dec2] border border-[#d8dec2] text-[11px] font-semibold transition"
                      >
                        <ListOrdered className="w-3 h-3 text-[#7f8f55]" />
                        <span>Orders</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportPromoter(p.promoter_code)}
                        disabled={exportingCode === p.promoter_code || orderCount === 0}
                        className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl border text-[11px] font-semibold transition ${
                          orderCount > 0
                            ? 'text-white bg-[#7f8f55] border-[#7f8f55]'
                            : 'text-[#374011]/40 bg-[#f4f6ee] border-[#d8dec2] opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Download className="w-3 h-3" />
                        <span>Export</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className="p-1.5 rounded-lg border border-[#d8dec2] bg-white text-[#374011] hover:bg-[#d8dec2]/30"
                      >
                        {p.is_active === 1 ? <EyeOff className="w-3.5 h-3.5 text-[#374011]/60" /> : <Eye className="w-3.5 h-3.5 text-[#7f8f55]" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded-lg border border-[#d8dec2] bg-white text-[#374011] hover:bg-[#d8dec2]/40 hover:text-[#7f8f55]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingPromoter(p)}
                        className="p-1.5 rounded-lg border border-[#d8dec2] bg-white text-[#374011]/80 hover:bg-red-50 hover:text-red-600"
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
        <div className="fixed inset-0 z-50 bg-[#374011]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#d8dec2] w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 sm:px-6 py-4 border-b border-[#d8dec2] flex items-center justify-between bg-[#d8dec2]/25 flex-shrink-0">
              <h3 className="text-base font-bold text-[#374011]">
                {editingPromoter ? 'Edit Promoter ID' : 'Add Authorized Promoter ID'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-[#374011]/60 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromoter} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
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
                  className="block text-xs font-semibold text-[#374011] mb-1"
                >
                  Promoter ID Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="promoter-code-input"
                  type="text"
                  required
                  value={promoterCode}
                  onChange={(e) => setPromoterCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PR-1005"
                  className="w-full px-3 py-2 rounded-xl border border-[#d8dec2] text-sm font-mono text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                />
                <p className="text-[11px] text-[#374011]/60 mt-1">
                  Customers must enter this exact Promoter ID to place an order.
                </p>
              </div>

              {/* Promoter Name */}
              <div>
                <label 
                  htmlFor="promoter-name-input"
                  className="block text-xs font-semibold text-[#374011] mb-1"
                >
                  Promoter Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="promoter-name-input"
                  type="text"
                  required
                  value={promoterName}
                  onChange={(e) => setPromoterName(e.target.value)}
                  placeholder="e.g. John Doe / City Agency"
                  className="w-full px-3 py-2 rounded-xl border border-[#d8dec2] text-sm text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label 
                  htmlFor="promoter-phone-input"
                  className="block text-xs font-semibold text-[#374011] mb-1"
                >
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="promoter-phone-input"
                    type="tel"
                    required
                    value={promoterPhone}
                    onChange={(e) => setPromoterPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#d8dec2] text-sm text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                  />
                </div>
              </div>

              {/* Aadhaar Number */}
              <div>
                <label 
                  htmlFor="promoter-aadhaar-input"
                  className="block text-xs font-semibold text-[#374011] mb-1"
                >
                  Aadhaar Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7f8f55]">
                    <IdCard className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="promoter-aadhaar-input"
                    type="text"
                    required
                    value={promoterAadhaar}
                    onChange={(e) => setPromoterAadhaar(e.target.value)}
                    placeholder="e.g. 1234 5678 9012"
                    maxLength={16}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#d8dec2] text-sm font-mono text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition"
                  />
                </div>
                <p className="text-[11px] text-[#374011]/60 mt-1">
                  12-digit Indian Aadhaar identification number for promoter records.
                </p>
              </div>

              {/* Address */}
              <div>
                <label 
                  htmlFor="promoter-address-input"
                  className="block text-xs font-semibold text-[#374011] mb-1"
                >
                  Promoter Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <textarea
                    id="promoter-address-input"
                    rows={3}
                    required
                    value={promoterAddress}
                    onChange={(e) => setPromoterAddress(e.target.value)}
                    placeholder="Full address (Door No., Street, Area, City/District, State, PIN)..."
                    className="w-full px-3 py-2 rounded-xl border border-[#d8dec2] text-xs text-[#374011] bg-white placeholder-[#374011]/40 focus:outline-none focus:ring-2 focus:ring-[#7f8f55]/20 focus:border-[#7f8f55] transition resize-none"
                  />
                </div>
              </div>

              {/* Active Toggle Checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7f8f55] border-[#d8dec2] focus:ring-[#7f8f55]"
                  />
                  <span className="text-xs font-semibold text-[#374011]">
                    Active (Authorized to place customer orders)
                  </span>
                </label>
              </div>

              {/* If editing, show unique shareable dashboard link */}
              {editingPromoter && editingPromoter.access_token && (
                <div className="p-3.5 bg-[#d8dec2]/35 border border-[#a9b48a]/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#374011] flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#7f8f55]" />
                      <span>Promoter Dashboard Link</span>
                    </span>
                    <span className="text-[10px] text-[#7f8f55] font-semibold">No login required</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={getDashboardUrl(editingPromoter.access_token)}
                      className="w-full text-xs font-mono bg-white border border-[#d8dec2] rounded-lg px-2.5 py-1.5 text-[#374011] select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(editingPromoter)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] flex items-center gap-1 flex-shrink-0 transition shadow-xs"
                    >
                      {copiedLinkId === editingPromoter.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(editingPromoter)}
                      title="Share on WhatsApp"
                      className="p-1.5 rounded-lg bg-[#7f8f55] text-white hover:bg-[#6f7e49] flex-shrink-0 transition shadow-xs"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Submit & Cancel */}
              <div className="pt-3 border-t border-[#d8dec2]/60 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-[#d8dec2] text-xs font-semibold text-[#374011] hover:bg-[#d8dec2]/40 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] transition disabled:opacity-50 shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-[#374011]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#d8dec2] w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 sm:p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#374011]">
              Delete Promoter ID?
            </h3>
            <p className="text-xs text-[#374011]/70 mt-1.5">
              Are you sure you want to delete Promoter ID <strong className="font-mono text-[#374011]">"{deletingPromoter.promoter_code}"</strong>? Customers using this ID will no longer be able to place orders.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingPromoter(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl border border-[#d8dec2] text-xs font-semibold text-[#374011] hover:bg-[#d8dec2]/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50 shadow-xs"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* NEW PROMOTER CREATED SUCCESS MODAL                       */}
      {/* ======================================================== */}
      {createdPromoterInfo && (
        <div className="fixed inset-0 z-50 bg-[#374011]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#d8dec2] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#d8dec2]/50 text-[#7f8f55] mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#374011]">
                Promoter ID Created Successfully!
              </h3>
              <p className="text-xs text-[#374011]/70 mt-1">
                Share this unique link with the promoter. They can access their dashboard directly without any login.
              </p>

              {/* Promoter Code & Link Box */}
              <div className="mt-4 p-3.5 bg-[#f4f6ee] rounded-xl border border-[#d8dec2] text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#374011]">Promoter ID:</span>
                  <span className="font-mono font-bold text-[#7f8f55]">{createdPromoterInfo.promoter_code}</span>
                </div>
                {createdPromoterInfo.name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#374011]/60">Name:</span>
                    <span className="font-medium text-[#374011]">{createdPromoterInfo.name}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#d8dec2]">
                  <span className="text-[11px] font-semibold text-[#374011] block mb-1">
                    Unique Shareable Dashboard Link:
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={getDashboardUrl(createdPromoterInfo.access_token)}
                    className="w-full text-xs font-mono bg-white border border-[#d8dec2] rounded-lg px-2.5 py-2 text-[#374011] select-all"
                  />
                </div>
              </div>

              {/* Share & Copy Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyLink(createdPromoterInfo)}
                  className={`w-full sm:flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    copiedLinkId === createdPromoterInfo.id
                      ? 'bg-[#d8dec2] text-[#374011] border-[#a9b48a]'
                      : 'bg-white text-[#374011] border-[#d8dec2] hover:bg-[#d8dec2]/30'
                  }`}
                >
                  {copiedLinkId === createdPromoterInfo.id ? (
                    <>
                      <Check className="w-4 h-4 text-[#7f8f55]" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#7f8f55]" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(createdPromoterInfo)}
                  className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-[#7f8f55] text-white hover:bg-[#6f7e49] text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share via WhatsApp</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCreatedPromoterInfo(null)}
                className="mt-3 w-full py-2 rounded-xl text-xs font-medium text-[#374011]/60 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition"
              >
                Close & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PROMOTER FULL DETAILS MODAL                              */}
      {/* ======================================================== */}
      {viewingPromoterDetails && (
        <div className="fixed inset-0 z-50 bg-[#374011]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#d8dec2] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-[#d8dec2] flex items-center justify-between bg-[#d8dec2]/25 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#7f8f55]/15 text-[#7f8f55] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#374011]">
                    Promoter Full Details
                  </h3>
                  <p className="text-[11px] text-[#374011]/60">
                    Profile, identification & performance overview
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPromoterDetails(null)}
                className="p-1.5 rounded-lg text-[#374011]/60 hover:text-[#374011] hover:bg-[#d8dec2]/40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {/* Profile Overview Card */}
              <div className="p-4 rounded-xl bg-[#f4f6ee] border border-[#d8dec2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#7f8f55] text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-xs">
                    {(viewingPromoterDetails.name ? viewingPromoterDetails.name.charAt(0) : viewingPromoterDetails.promoter_code.charAt(0)).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#374011]">
                      {viewingPromoterDetails.name || <span className="italic text-[#374011]/60">Unnamed Promoter</span>}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs font-bold text-[#7f8f55] bg-white px-2 py-0.5 rounded-md border border-[#d8dec2]">
                        {viewingPromoterDetails.promoter_code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          viewingPromoterDetails.is_active === 1
                            ? 'bg-[#d8dec2]/70 text-[#374011] border-[#a9b48a]'
                            : 'bg-white text-[#374011]/60 border-[#d8dec2]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${viewingPromoterDetails.is_active === 1 ? 'bg-[#7f8f55]' : 'bg-[#374011]/40'}`} />
                        {viewingPromoterDetails.is_active === 1 ? 'Active (Authorized)' : 'Inactive (Blocked)'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const p = viewingPromoterDetails;
                    setViewingPromoterDetails(null);
                    openEditModal(p);
                  }}
                  className="self-stretch sm:self-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d8dec2] bg-white text-xs font-semibold text-[#374011] hover:bg-[#d8dec2]/40 transition shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#7f8f55]" />
                  <span>Edit Info</span>
                </button>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Phone Number */}
                <div className="p-3.5 rounded-xl border border-[#d8dec2] bg-white space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#374011]/60">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Phone className="w-3.5 h-3.5 text-[#7f8f55]" />
                      <span>Phone Number</span>
                    </span>
                    {viewingPromoterDetails.phone_number && (
                      <span className="text-[10px] font-semibold text-[#7f8f55]">Contact</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#374011] pt-0.5">
                    {viewingPromoterDetails.phone_number ? (
                      <div className="flex items-center justify-between gap-2">
                        <a 
                          href={`tel:${viewingPromoterDetails.phone_number}`}
                          className="hover:underline hover:text-[#7f8f55] font-mono text-xs sm:text-sm"
                        >
                          {viewingPromoterDetails.phone_number}
                        </a>
                        <div className="flex items-center gap-1">
                          <a
                            href={`https://api.whatsapp.com/send?phone=${viewingPromoterDetails.phone_number.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat on WhatsApp"
                            className="p-1 rounded-md text-[#7f8f55] hover:bg-[#d8dec2]/30 transition"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#374011]/40 italic font-normal">Not provided</span>
                    )}
                  </div>
                </div>

                {/* Aadhaar Number */}
                <div className="p-3.5 rounded-xl border border-[#d8dec2] bg-white space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#374011]/60">
                    <span className="flex items-center gap-1.5 font-medium">
                      <IdCard className="w-3.5 h-3.5 text-[#7f8f55]" />
                      <span>Aadhaar Number</span>
                    </span>
                    {viewingPromoterDetails.aadhaar_number && (
                      <span className="text-[10px] font-semibold text-[#7f8f55]">Identity</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#374011] pt-0.5">
                    {viewingPromoterDetails.aadhaar_number ? (
                      <span className="font-mono tracking-wider text-xs sm:text-sm">{viewingPromoterDetails.aadhaar_number}</span>
                    ) : (
                      <span className="text-xs text-[#374011]/40 italic font-normal">Not provided</span>
                    )}
                  </div>
                </div>

                {/* Complete Address - Span 2 Columns */}
                <div className="sm:col-span-2 p-3.5 rounded-xl border border-[#d8dec2] bg-white space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#374011]/60">
                    <span className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#7f8f55]" />
                      <span>Complete Address</span>
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[#374011] pt-0.5 whitespace-pre-wrap leading-relaxed">
                    {viewingPromoterDetails.address ? (
                      viewingPromoterDetails.address
                    ) : (
                      <span className="text-[#374011]/40 italic font-normal">No address recorded</span>
                    )}
                  </div>
                </div>

                {/* Orders Placed Stats */}
                <div className="p-3.5 rounded-xl border border-[#d8dec2] bg-white space-y-1">
                  <div className="text-xs text-[#374011]/60 flex items-center gap-1.5 font-medium">
                    <ShoppingCart className="w-3.5 h-3.5 text-[#7f8f55]" />
                    <span>Orders Placed</span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-lg font-bold text-[#374011]">
                      {viewingPromoterDetails.order_count || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const p = viewingPromoterDetails;
                        setViewingPromoterDetails(null);
                        setSelectedPromoterForOrders(p);
                      }}
                      className="text-xs text-[#7f8f55] hover:underline font-semibold inline-flex items-center gap-1"
                    >
                      <span>View Orders</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Date Added */}
                <div className="p-3.5 rounded-xl border border-[#d8dec2] bg-white space-y-1">
                  <div className="text-xs text-[#374011]/60 flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#7f8f55]" />
                    <span>Date Registered</span>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-[#374011] pt-0.5">
                    {formatDate(viewingPromoterDetails.created_at)}
                  </div>
                </div>
              </div>

              {/* Promoter Unique Shareable Dashboard Link */}
              {viewingPromoterDetails.access_token && (
                <div className="p-3.5 bg-[#d8dec2]/35 border border-[#a9b48a]/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#374011] flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#7f8f55]" />
                      <span>Promoter Dashboard Link</span>
                    </span>
                    <span className="text-[10px] text-[#7f8f55] font-semibold">Real-time live view</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={getDashboardUrl(viewingPromoterDetails.access_token)}
                      className="w-full text-xs font-mono bg-white border border-[#d8dec2] rounded-lg px-2.5 py-1.5 text-[#374011] select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(viewingPromoterDetails)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#7f8f55] text-white text-xs font-semibold hover:bg-[#6f7e49] flex items-center gap-1 flex-shrink-0 transition shadow-xs"
                    >
                      {copiedLinkId === viewingPromoterDetails.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(viewingPromoterDetails)}
                      title="Share on WhatsApp"
                      className="p-1.5 rounded-lg bg-[#7f8f55] text-white hover:bg-[#6f7e49] flex-shrink-0 transition shadow-xs"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <a
                      href={getDashboardUrl(viewingPromoterDetails.access_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in new tab"
                      className="p-1.5 rounded-lg border border-[#d8dec2] bg-white text-[#374011]/80 hover:text-[#7f8f55] hover:bg-[#d8dec2]/30 flex-shrink-0 transition shadow-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-[#d8dec2] flex items-center justify-between gap-2 bg-white flex-shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = viewingPromoterDetails;
                    setViewingPromoterDetails(null);
                    setSelectedPromoterForOrders(p);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#d8dec2]/50 hover:bg-[#d8dec2] text-[#374011] border border-[#d8dec2] transition shadow-xs"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-[#7f8f55]" />
                  <span>Orders ({viewingPromoterDetails.order_count || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportPromoter(viewingPromoterDetails.promoter_code)}
                  disabled={exportingCode === viewingPromoterDetails.promoter_code || Number(viewingPromoterDetails.order_count || 0) === 0}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    Number(viewingPromoterDetails.order_count || 0) > 0
                      ? 'text-white bg-[#7f8f55] border-[#7f8f55] hover:bg-[#6f7e49] shadow-xs'
                      : 'text-[#374011]/40 bg-[#f4f6ee] border-[#d8dec2] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Download className={`w-3.5 h-3.5 ${exportingCode === viewingPromoterDetails.promoter_code ? 'animate-bounce' : ''}`} />
                  <span>Export</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingPromoterDetails(null)}
                className="px-4 py-2 rounded-xl border border-[#d8dec2] text-xs font-semibold text-[#374011] hover:bg-[#d8dec2]/40 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

