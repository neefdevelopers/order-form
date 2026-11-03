import React, { useState } from 'react';
import { 
  Package, 
  ShoppingCart, 
  LogOut, 
  ArrowLeft, 
  ShieldCheck, 
  Layers,
  UserCheck
} from 'lucide-react';
import OrderManagement from './OrderManagement';
import ProductManagement from './ProductManagement';
import PromoterManagement from './PromoterManagement';

export default function AdminPanel({ token, admin, onLogout, onNavigateToCustomer }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products' | 'promoters'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Admin Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Brand & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Admin Panel
                </h1>
              </div>
            </div>

            {/* Middle Tabs */}
            <nav className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'orders'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Orders</span>
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'products'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Products</span>
              </button>

              <button
                onClick={() => setActiveTab('promoters')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'promoters'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Promoters</span>
              </button>
            </nav>

            {/* Right: Switch to Customer View + Logout */}
            <div className="flex items-center gap-2">
              <button
                onClick={onNavigateToCustomer}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Customer Form</span>
              </button>

              <button
                onClick={onLogout}
                title="Sign out of Admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'orders' && <OrderManagement token={token} />}
        {activeTab === 'products' && <ProductManagement token={token} />}
        {activeTab === 'promoters' && <PromoterManagement token={token} />}
      </main>
    </div>
  );
}
