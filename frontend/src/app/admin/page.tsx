'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ShieldAlert, LogOut, MessageSquare, ShieldCheck, 
  BarChart3, Users, FileSpreadsheet, History, Cpu, Database
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import AnalyticsCard from '../../components/admin/AnalyticsCard';
import UserManagementTable from '../../components/admin/UserManagementTable';
import DocumentIngestionView from '../../components/admin/DocumentIngestionView';
import LogViewer from '../../components/admin/LogViewer';
import BenchmarkRunner from '../../components/admin/BenchmarkRunner';

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearSession } = useAuthStore();

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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 text-sm">
        Validating administrator token...
      </div>
    );
  }

  // RBAC Client-Side Guard
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-rose-500/20 bg-rose-950/5 p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-white text-lg">Access Denied</CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Role-Based Access Control blocked access to this directory.
            </CardDescription>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your current account role (<strong>{user.role}</strong>) does not have authorization policies to view administrative dashboards.
          </p>
          <div className="flex justify-center space-x-3 pt-2">
            <Link 
              href="/dashboard" 
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Back to Chat
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between">
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/10">
            <Database className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-white tracking-tight">Conversational Data Analyst</span>
            <span className="text-[10px] text-zinc-500 font-mono block -mt-0.5">Admin Management Console</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all"
          >
            <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
            <span>Chat Workspace</span>
          </Link>

          <Link
            href="/admin"
            className="text-xs font-semibold text-indigo-400 bg-indigo-950/30 border border-indigo-500/20 px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Admin Panel</span>
          </Link>

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

      {/* Main Admin layout panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        <Tabs defaultValue="analytics">
          <TabsList className="bg-zinc-950/60 p-1 border-zinc-900 w-full md:w-auto flex overflow-x-auto">
            <TabsTrigger value="analytics" className="flex items-center space-x-1.5 text-xs py-1.5 flex-1 md:flex-none">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-1.5 text-xs py-1.5 flex-1 md:flex-none">
              <Users className="h-3.5 w-3.5 text-violet-400" />
              <span>User Policies</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center space-x-1.5 text-xs py-1.5 flex-1 md:flex-none">
              <FileSpreadsheet className="h-3.5 w-3.5 text-rose-400" />
              <span>Ingest Files</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center space-x-1.5 text-xs py-1.5 flex-1 md:flex-none">
              <History className="h-3.5 w-3.5 text-blue-400" />
              <span>Query Logs</span>
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="flex items-center space-x-1.5 text-xs py-1.5 flex-1 md:flex-none">
              <Cpu className="h-3.5 w-3.5 text-amber-400" />
              <span>Compiler Diagnostics</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-6 shadow-xl backdrop-blur-sm min-h-[50vh]">
            <TabsContent value="analytics">
              <AnalyticsCard />
            </TabsContent>
            <TabsContent value="users">
              <UserManagementTable />
            </TabsContent>
            <TabsContent value="documents">
              <DocumentIngestionView />
            </TabsContent>
            <TabsContent value="logs">
              <LogViewer />
            </TabsContent>
            <TabsContent value="benchmarks">
              <BenchmarkRunner />
            </TabsContent>
          </div>
        </Tabs>

      </main>

    </div>
  );
}
