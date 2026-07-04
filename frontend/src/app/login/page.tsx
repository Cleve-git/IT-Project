'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/button';
import ThemeToggle from '../../components/ui/ThemeToggle';
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
      let mockUid = "regular-user-uuid-87654321";
      let mockRole = "user";
      
      if (email.includes("admin")) {
        mockUid = "admin-user-uuid-12345678";
        mockRole = "admin";
      }

      const mockToken = `mock-token-${mockRole}-${mockUid}`;

      const profile = await fetch('http://localhost:8000/api/v1/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mockUid, email, full_name: email.split('@')[0].toUpperCase() })
      }).then(res => {
        if (!res.ok) throw new Error("Backend connection failed. Is the server running?");
        return res.json();
      });

      setSession(profile, mockToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to establish database session. Ensure FastAPI backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (type: 'admin' | 'user') => {
    setEmail(type === 'admin' ? 'admin@cda.com' : 'user@cda.com');
    setPassword('password');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden px-4">
      {/* Background soft ambient glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />

      <ThemeToggle className="absolute top-4 right-4 z-20 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer" />
      
      <div className="w-full max-w-md relative z-10">
        <form onSubmit={handleLogin}>
          <Card className="border-border/60 bg-card shadow-xl">
            <CardHeader className="space-y-2 text-center pb-4">
              <div className="flex justify-center mb-1">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center shadow-sm">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
              </div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">Conda AI</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Natural language interface to compile PostgreSQL queries
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/25 text-danger text-xs rounded-lg leading-relaxed">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@conda.ai"
                    className="w-full bg-background border border-border/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:bg-muted/20 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-background border border-border/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:bg-muted/20 transition-colors"
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full py-2.5" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : 'Sign In'}
              </Button>

              {/* Developer credentials shortcuts */}
              <div className="w-full pt-4 border-t border-border space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block text-center">Development Sandbox Shortcuts</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('user')}
                    className="py-2.5 px-3 bg-muted/40 hover:bg-muted border border-border/60 rounded-xl text-xs font-medium text-foreground transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>User Sandbox</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('admin')}
                    className="py-2.5 px-3 bg-muted/40 hover:bg-muted border border-border/60 rounded-xl text-xs font-medium text-foreground transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Admin Sandbox</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
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
