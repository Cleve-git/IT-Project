'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ShieldAlert, LogOut, MessageSquare, ShieldCheck, Database } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { ChatWindow } from '../../components/chat/ChatWindow';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearSession } = useAuthStore();

  useEffect(() => {
    // Client-side authentication validation
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 text-sm">
        Validating user credentials...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between">
      
      {/* Premium Top Navigation Bar */}
      <header className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
        
        {/* Brand identity */}
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/10">
            <Database className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-white tracking-tight">Conversational Data Analyst</span>
            <span className="text-[10px] text-zinc-500 font-mono block -mt-0.5">PostgreSQL compiler</span>
          </div>
        </div>

        {/* Dashboard Actions */}
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-indigo-400 bg-indigo-950/30 border border-indigo-500/20 px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat Workspace</span>
          </Link>

          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
              <span>Admin Panel</span>
            </Link>
          )}

          <div className="h-4 w-px bg-zinc-800" />

          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-zinc-400 hover:text-rose-400 flex items-center space-x-1 cursor-pointer transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col justify-center">
        <ChatWindow />
      </main>

    </div>
  );
}
