'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Shield,
  BarChart3,
  MessageSquare,
  Database,
  Mic,
  FileText,
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
  Quote,
  Terminal,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import ColorBends from '../components/ColorBends';

const FEATURES = [
  { icon: Shield, title: 'Read-only & safe', desc: 'Every query is validated, only SELECT runs. Writes and DDL are blocked by guardrails.' },
  { icon: BarChart3, title: 'Answer, chart & explanation', desc: 'Get the result, an auto-selected chart, and a plain-language summary of what it means.' },
  { icon: MessageSquare, title: 'Remembers the conversation', desc: "Ask follow-ups like 'only the Gold tier' or 'break it down by month' and the context will be remembered." },
  { icon: Database, title: 'Grounded in your data', desc: 'Answers come only from your database, with a citation of the source tables, never made up.' },
  { icon: Mic, title: 'Voice to text', desc: 'Speak your question and let the analyst transcribe and run it for you.' },
  { icon: FileText, title: 'Audit & export', desc: 'Every query is logged and filterable: export the report to PDF or CSV in one click.' },
];

const STEPS = [
  { n: '01', title: 'Ask in plain language', desc: '"Who are our top customers by revenue this quarter?"' },
  { n: '02', title: 'Safe SQL, executed', desc: 'A schema-aware, read-only query runs against your database.' },
  { n: '03', title: 'Answer + chart + source', desc: 'You get the number, a chart, an explanation, and where it came from.' },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
    setTheme(next);
  };

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#030712] text-[#0F172A] dark:text-[#F9FAFB] transition-colors duration-300 overflow-x-hidden">

      {/* ── Hero background: ColorBends WebGL canvas ── */}
      {/* Sized to cover the hero section + navbar height (~100vh) */}
      <div className="absolute top-0 left-0 w-full h-screen pointer-events-none z-0 overflow-hidden">
        <ColorBends
          rotation={60}
          speed={0.3}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error: JS component colors prop defaults to [] causing never[] inference
          colors={["#F97316", "#06B6D4", "#F97316"]}
          transparent
          autoRotate={0}
          scale={1.2}
          frequency={1}
          warpStrength={1}
          mouseInfluence={1}
          parallax={0.5}
          noise={0.15}
          iterations={1}
          intensity={1.5}
          bandWidth={6}
        />
      </div>

      {/* Bottom fade — blends ColorBends into the page body */}
      <div className="absolute top-0 left-0 w-full h-screen bg-gradient-to-b from-transparent via-transparent to-[#FAFAFA] dark:to-[#030712] pointer-events-none z-0" />

      {/* ── Navbar ── */}
      <header className="relative w-full z-30 border-b border-slate-200/40 dark:border-slate-800/30 backdrop-blur-sm bg-[#FAFAFA]/60 dark:bg-[#030712]/60">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/logo/CondaAI.png"
              alt="Conda AI logo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain transition-all duration-300 group-hover:opacity-80 dark:invert dark:brightness-200"
              priority
            />
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white transition-colors duration-300">
              Conda AI
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
            <a href="#about" className="hover:text-[#F97316] transition-colors duration-200">About</a>
            <a href="#how" className="hover:text-[#F97316] transition-colors duration-200">How it works</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors flex items-center justify-center cursor-pointer"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
            <Link href="/login" className="text-xs font-semibold px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-200">
              Sign In
            </Link>
          </div>

          {/* Mobile nav */}
          <div className="flex items-center gap-2.5 md:hidden">
            <button onClick={toggleTheme} className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer">
              {theme === 'dark' ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center z-50 relative cursor-pointer"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 bg-[#FAFAFA]/95 dark:bg-[#030712]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-lg md:hidden z-40 p-6 flex flex-col gap-4"
          >
            <a href="#about" onClick={() => setIsOpen(false)} className="text-base font-medium text-slate-600 dark:text-slate-300 hover:text-[#F97316]">About</a>
            <a href="#how" onClick={() => setIsOpen(false)} className="text-base font-medium text-slate-600 dark:text-slate-300 hover:text-[#F97316]">How it works</a>
            <Link href="/login" onClick={() => setIsOpen(false)} className="text-center text-sm font-semibold px-5 py-3 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all">
              Sign In
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero section (sits on top of ColorBends) ── */}
      <section className="relative pt-24 pb-16 text-center flex flex-col items-center max-w-4xl mx-auto px-6 z-10">

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white mt-5 leading-[1.1] dark:[text-shadow:0_2px_24px_rgba(0,0,0,1),0_0_48px_rgba(0,0,0,0.9)]"
        >
          Chat with your database<br className="hidden md:inline" /> in plain language
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-slate-600 dark:text-slate-100 max-w-2xl text-base md:text-lg leading-relaxed dark:[text-shadow:0_1px_16px_rgba(0,0,0,1),0_0_32px_rgba(0,0,0,0.8)]"
        >
          Ask a business question and get a safe SQL query, the answer, a chart, and a plain-language explanation grounded entirely in your data, never invented.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
        >
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#F97316] text-white text-sm font-semibold px-6 py-3 rounded-full hover:scale-105 hover:opacity-90 active:scale-95 transition-all duration-300 shadow-md shadow-orange-500/20"
          >
            Launch Conda AI <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border border-slate-300/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm hover:bg-white/70 dark:hover:bg-slate-900/70 transition-all duration-300"
          >
            See how it works
          </a>
        </motion.div>
      </section>

      {/* ── Chat Mockup ── */}
      <section className="relative max-w-3xl mx-auto px-6 pb-28 z-10">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/20 dark:bg-[#0B1329]/20 backdrop-blur-lg p-5 md:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-5"
        >
          <div className="flex justify-end">
            <div className="bg-[#F97316] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-medium shadow-sm">
              What is our total revenue?
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0">
              <Image
              src="/logo/CondaAI.png"
              alt="Conda AI logo"
              width={20}
              height={20}
              className="h-9 w-9 object-contain transition-all duration-300 group-hover:opacity-80 dark:invert dark:brightness-200"
              priority
            />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                Your total revenue from paid transactions is <strong>Rp 14,970,758,000</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80">
                  Referenced from: payment.csv
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80">
                  live database
                </span>
              </div>
            <div className="bg-slate-200/60 dark:bg-[#0B1329]/60 text-left p-3.5 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-100 overflow-x-auto whitespace-nowrap">
                <span className="text-slate-500 select-none">&gt; </span>SELECT SUM(amount) FROM payments WHERE status = &apos;paid&apos;;
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Feature Grid ── */}
      <section id="about" className="relative max-w-6xl mx-auto px-6 py-16 z-10">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Built for trustworthy self-service analytics
          </h2>
          <p className="mt-2 text-sm md:text-base text-slate-500 dark:text-slate-400">
            Everyone gets answers in seconds, safely, and grounded in the data.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-[#0B1329]/20 p-6 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3 text-slate-900 dark:text-white">
                <f.icon className="h-5 w-5 shrink-0" />
                <h3 className="text-base font-semibold">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="relative max-w-6xl mx-auto px-6 py-16 z-10">
        <div className="text-center mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F97316] select-none">
            How it works
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative rounded-2xl border border-slate-200/50 dark:border-slate-800/50 p-6 bg-white/40 dark:bg-[#0b1329]/30 overflow-hidden"
            >
              <span className="absolute -right-3 -bottom-6 text-7xl font-extrabold font-mono text-[#F97316]/10 select-none pointer-events-none">
                {s.n}
              </span>
              <h4 className="text-base font-semibold text-slate-900 dark:text-white">{s.title}</h4>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed pr-6">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative max-w-4xl mx-auto px-6 py-16 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/20 dark:bg-[#0B1329]/20 p-10 text-center relative overflow-hidden"
        >
          <Quote className="h-10 w-10 text-[#F97316]/20 mx-auto mb-4 rotate-180" />
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stop waiting in the analytics queue
          </h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            Ask your data anything, no SQL required. Sign in with a sandbox account to try it now.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#F97316] text-white text-sm font-semibold px-8 py-3.5 rounded-full hover:scale-105 hover:opacity-90 active:scale-95 transition-all duration-300 shadow-md shadow-orange-500/20"
            >
              Launch Conda AI <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative w-full z-10 mt-12 border-t border-slate-200 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-4">
          <span>&copy; Conda AI - Conversational Data Analyst</span>
          <span>Read-only &bull; PostgreSQL &bull; Project</span>
        </div>
      </footer>

    </div>
  );
}
