'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert, LogOut, MessageSquare, ShieldCheck,
  BarChart3, Users, FileSpreadsheet, History, Cpu, Database, Shield, Table2, Activity
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import ThemeToggle from '../../components/ui/ThemeToggle';
import AnalyticsCard from '../../components/admin/AnalyticsCard';
import UserManagementTable from '../../components/admin/UserManagementTable';
import DocumentIngestionView from '../../components/admin/DocumentIngestionView';
import LogViewer from '../../components/admin/LogViewer';
import BenchmarkRunner from '../../components/admin/BenchmarkRunner';
import BusinessDataManager from '../../components/admin/BusinessDataManager';
import EvaluationMatrix from '../../components/admin/EvaluationMatrix';

interface AdminPageProps {
  defaultTab?: 'analytics' | 'users' | 'data' | 'documents' | 'logs' | 'benchmarks' | 'evaluation';
}

export default function AdminPage({ defaultTab = 'analytics' }: AdminPageProps) {
  const router = useRouter();
  const { user, isAuthenticated, clearSession } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'data' | 'documents' | 'logs' | 'benchmarks' | 'evaluation'>(defaultTab);

  useEffect(() => {
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
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-xs font-mono">
        Validating administrator credentials...
      </div>
    );
  }

  // RBAC Client-Side Guard
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-danger/20 bg-danger/5 p-6 text-center space-y-4 shadow-sm">
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-danger/10 border border-danger/20 text-danger rounded-full flex items-center justify-center">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-foreground text-lg font-bold">Access Denied</CardTitle>
            <CardDescription className="text-muted-foreground text-xs font-medium">
              Role-Based Access Control blocked access to this directory.
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your current account role (<strong>{user.role}</strong>) does not have authorization policies to view administrative dashboards.
          </p>
          <div className="flex justify-center space-x-3 pt-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-card border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-[10px] transition-colors"
            >
              Back to Chat
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-danger hover:bg-danger/90 text-white text-xs font-semibold rounded-[10px] cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const adminNavItems = [
    { id: 'analytics' as const, label: 'System Analytics', icon: BarChart3 },
    { id: 'evaluation' as const, label: 'Evaluation Matrix', icon: Activity },
    { id: 'users' as const, label: 'User Policies', icon: Users },
    { id: 'data' as const, label: 'Business Data', icon: Table2 },
    { id: 'documents' as const, label: 'Ingest Documents', icon: FileSpreadsheet },
    { id: 'logs' as const, label: 'Execution Logs', icon: History },
    { id: 'benchmarks' as const, label: 'Compiler Diagnostics', icon: Cpu }
  ];

  return (
    <div className="min-h-screen text-foreground flex">

      {/* 1. Fixed Left Sidebar */}
      <aside className="w-64 h-screen fixed left-0 top-0 border-r border-border bg-card flex flex-col justify-between p-4 z-20">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center space-x-2.5 px-2">
            <div className="rounded-lg flex items-center justify-center shadow-sm">
              <img src="/logo/CondaAI.png" alt="Conda AI" className="h-6 w-6 dark:invert dark:brightness-200" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground tracking-tight block">Conda AI</span>
              <span className="text-[10px] text-muted-foreground font-mono block -mt-0.5">Admin Management</span>
            </div>
          </div>

          {/* Navigation link back to chat */}
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center space-x-2 border border-border hover:border-primary/45 hover:bg-muted py-2.5 rounded-[10px] text-xs font-semibold text-muted-foreground hover:text-foreground transition-all duration-150 ease-out shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]"
          >
            <span>Back to Chat</span>
          </Link>

          {/* Admin Navigation list */}
          <div className="space-y-1.5 pr-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-2 mb-2">Management Tabs</span>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] cursor-pointer transition-colors ${isActive
                      ? 'bg-primary/10 text-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User tag info */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="p-3 bg-muted/60 rounded-lg border border-border/80 text-[11px] text-muted-foreground flex flex-col gap-0.5">
            <div className="font-semibold text-foreground truncate">{user.email}</div>
            <div className="flex items-center space-x-1 mt-0.5 text-[9px] uppercase tracking-wider font-bold text-primary">
              Admin Console
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs font-semibold text-muted-foreground hover:text-danger flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-danger/5 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Outer Content Frame wrapper (offset left by sidebar width 64) */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">

        {/* 2. Sticky Top Navigation Bar */}
        <header className="h-16 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-sm text-foreground">
              {adminNavItems.find(item => item.id === activeTab)?.label || "Admin Workspace"}
            </h1>
          </div>
          <ThemeToggle className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer" />
        </header>

        {/* 3. Main Scrollable Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto bg-card border border-border/60 rounded-2xl p-6 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
            {activeTab === 'analytics' && <AnalyticsCard />}
            {activeTab === 'evaluation' && <EvaluationMatrix />}
            {activeTab === 'users' && <UserManagementTable />}
            {activeTab === 'data' && <BusinessDataManager />}
            {activeTab === 'documents' && <DocumentIngestionView />}
            {activeTab === 'logs' && <LogViewer />}
            {activeTab === 'benchmarks' && <BenchmarkRunner />}
          </div>
        </main>

      </div>

    </div>
  );
}
