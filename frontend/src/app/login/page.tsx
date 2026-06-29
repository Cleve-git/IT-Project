'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Terminal, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      // Mock/development direct flow for instant usability
      let mockUid = "regular-user-uuid-87654321";
      let mockRole = "user";
      
      if (email.includes("admin")) {
        mockUid = "admin-user-uuid-12345678";
        mockRole = "admin";
      }

      // Generate a mock JWT token that our backend security layer parses
      const mockToken = `mock-token-${mockRole}-${mockUid}`;

      // Synchronize/Register profile on backend
      const profile = await fetch('http://localhost:8000/api/v1/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mockUid, email, full_name: email.split('@')[0].toUpperCase() })
      }).then(res => {
        if (!res.ok) throw new Error("Backend connection failed. Is the server running?");
        return res.json();
      });

      // Write session state
      setSession(profile, mockToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || "Failed to establish database session. Ensure FastAPI backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (type: 'admin' | 'user') => {
    setEmail(type === 'admin' ? 'admin@cda.com' : 'user@cda.com');
    setPassword('password');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-hidden px-4">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      
      <div className="w-full max-w-md relative z-10">
        <form onSubmit={handleLogin}>
          <Card className="border-zinc-800 bg-zinc-950/60 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-2 text-center pb-4">
              <div className="flex justify-center mb-1">
                <div className="h-10 w-10 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl font-bold tracking-tight text-white">Conversational Data Analyst</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Compile Natural Language to SQL executing in PostgreSQL
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg leading-relaxed">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@cda.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full py-2.5" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
              </Button>

              {/* Developer credentials sandbox shortcuts */}
              <div className="w-full pt-4 border-t border-zinc-900 space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-center">Development Sandbox Shortcuts</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('user')}
                    className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>User Sandbox</span>
                    <ArrowRight className="h-3 w-3 text-zinc-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('admin')}
                    className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Admin Sandbox</span>
                    <ArrowRight className="h-3 w-3 text-zinc-500" />
                  </button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
