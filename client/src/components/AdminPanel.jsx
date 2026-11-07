import React, { useState } from 'react';
import { 
  Package, 
  ShoppingCart, 
  LogOut, 
  ArrowLeft, 
  Leaf, 
  UserCheck
} from 'lucide-react';
import OrderManagement from './OrderManagement';
import ProductManagement from './ProductManagement';
import PromoterManagement from './PromoterManagement';

export default function AdminPanel({ token, admin, onLogout, onNavigateToCustomer }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products' | 'promoters'

  return (
    <div className="min-h-screen bg-[#f4f6ee] text-[#374011] flex flex-col">
      {/* Top Admin Header Navigation */}
      <header className="bg-white border-b border-[#d8dec2] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left Brand & Title */}
            <div className="flex flex-col justify-center">
              <img 
                src="/dhaara-logo-dark.png" 
                alt="dhaara wellness" 
                className="h-5 sm:h-6 w-auto object-contain object-left" 
              />
              <span className="text-[10px] font-semibold text-[#7f8f55] tracking-wide block leading-none mt-0.5">
                Admin Panel
              </span>
            </div>

            {/* Middle Desktop Tabs (hidden on mobile, visible on sm and up) */}
            <nav className="hidden sm:flex items-center p-1 bg-[#d8dec2]/35 rounded-xl border border-[#d8dec2]/80">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'orders'
                    ? 'bg-white text-[#374011] shadow-xs border border-[#d8dec2]'
                    : 'text-[#374011]/70 hover:text-[#374011] hover:bg-white/50'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-[#7f8f55]" />
                <span>Orders</span>
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'products'
                    ? 'bg-white text-[#374011] shadow-xs border border-[#d8dec2]'
                    : 'text-[#374011]/70 hover:text-[#374011] hover:bg-white/50'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-[#7f8f55]" />
                <span>Products</span>
              </button>

              <button
                onClick={() => setActiveTab('promoters')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'promoters'
                    ? 'bg-white text-[#374011] shadow-xs border border-[#d8dec2]'
                    : 'text-[#374011]/70 hover:text-[#374011] hover:bg-white/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#7f8f55]" />
                <span>Promoters</span>
              </button>
            </nav>

            {/* Right: Switch to Customer View + Logout */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={onNavigateToCustomer}
                title="Return to Customer Order Form"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-[#374011]/80 hover:text-[#7f8f55] hover:bg-[#d8dec2]/40 transition border border-transparent hover:border-[#d8dec2]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Customer Form</span>
                <span className="inline md:hidden">Store</span>
              </button>

              <button
                onClick={onLogout}
                title="Sign out of Admin"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#d8dec2] bg-white text-xs font-medium text-[#374011] hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Mobile Bottom Navigation Bar (Visible only on < sm) */}
          <div className="sm:hidden pb-2 pt-0.5 border-t border-[#d8dec2]/50">
            <nav className="grid grid-cols-3 gap-1 p-1 bg-[#d8dec2]/35 rounded-xl border border-[#d8dec2]/80">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'orders'
                    ? 'bg-white text-[#374011] shadow-xs border border-[#d8dec2]'
                    : 'text-[#374011]/70 hover:text-[#374011]'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-[#7f8f55]" />
                <span>Orders</span>
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'products'
                    ? 'bg-white text-[#374011] shadow-xs border border-[#d8dec2]'
                    : 'text-[#374011]/70 hover:text-[#374011]'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-[#7f8f55]" />
                <span>Products</span>
              </button>

              <button
                onClick={() => setActiveTab('promoters')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'promoters'
                    ? 'bg-white text-[#374011] shadow-xs border border-[#d8dec2]'
                    : 'text-[#374011]/70 hover:text-[#374011]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#7f8f55]" />
                <span>Promoters</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'orders' && <OrderManagement token={token} />}
        {activeTab === 'products' && <ProductManagement token={token} />}
        {activeTab === 'promoters' && <PromoterManagement token={token} />}
      </main>
    </div>
  );
}
