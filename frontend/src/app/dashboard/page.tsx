'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Sparkles, LogOut, MessageSquare, ShieldCheck, 
  Database, Plus, Trash2, Shield
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import api from '../../services/api';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { Button } from '../../components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearSession } = useAuthStore();
  const { 
    conversations, currentConversationId, 
    setConversations, setCurrentConversationId, setMessages, setLoading 
  } = useChatStore();

  // 1. Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // 2. Fetch Conversations on Mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchConvs = async () => {
      try {
        const list = await api.listConversations();
        setConversations(list);
      } catch (err) {
        console.error("Failed to load conversations", err);
      }
    };
    fetchConvs();
  }, [isAuthenticated, setConversations]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;
    try {
      await api.deleteConversation(id);
      const list = await api.listConversations();
      setConversations(list);
      if (currentConversationId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-xs font-mono">
        Validating user session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      
      {/* 1. Collapsible Left Sidebar — a thin icon rail that expands on hover */}
      <aside className="group w-16 hover:w-64 h-screen fixed left-0 top-0 border-r border-border bg-card flex flex-col justify-between p-3 z-30 transition-[width] duration-200 ease-out overflow-hidden">
        <div className="space-y-4 min-w-0">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 px-1 h-8">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div className="hidden group-hover:block whitespace-nowrap">
              <span className="font-bold text-sm text-foreground tracking-tight block">Conda AI</span>
              <span className="text-[10px] text-muted-foreground font-mono block -mt-0.5">PostgreSQL compiler</span>
            </div>
          </div>

          {/* New Chat Button */}
          <Button
            onClick={handleNewChat}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-border hover:border-primary/45 hover:bg-muted py-2.5 text-xs font-semibold"
            title="New Analyst Chat"
          >
            <Plus className="h-4 w-4 text-primary shrink-0" />
            <span className="hidden group-hover:inline whitespace-nowrap">New Analyst Chat</span>
          </Button>

          {/* Conversations history list (only when expanded) */}
          <div className="hidden group-hover:block space-y-0.5 overflow-y-auto max-h-[60vh] pr-1">
            <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block px-2 mb-1.5">Recent</span>
            {conversations.length === 0 ? (
              <span className="text-xs text-muted-foreground block px-2 italic">No chats yet</span>
            ) : (
              conversations.map((conv) => {
                const isActive = currentConversationId === conv.conversation_id;
                return (
                  <div
                    key={conv.conversation_id}
                    onClick={() => setCurrentConversationId(conv.conversation_id)}
                    className={`group/item flex items-center justify-between px-3 py-2 rounded-lg text-[13px] cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span className="truncate pr-2 max-w-[175px] whitespace-nowrap">{conv.title}</span>
                    <button
                      onClick={(e) => handleDeleteChat(e, conv.conversation_id)}
                      className="opacity-0 group-hover/item:opacity-100 hover:text-danger p-0.5 rounded transition-opacity shrink-0"
                      title="Delete Conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User tag info */}
        <div className="space-y-2 pt-3 border-t border-border min-w-0">
          <div className="hidden group-hover:flex p-3 bg-muted/60 rounded-lg border border-border/80 text-[11px] text-muted-foreground flex-col gap-0.5 whitespace-nowrap">
            <div className="font-semibold text-foreground truncate">{user.email}</div>
            <div className="flex items-center space-x-1 mt-0.5 text-[9px] uppercase tracking-wider font-bold">
              {user.role === 'admin' ? (
                <span className="text-primary flex items-center"><Shield className="h-2.5 w-2.5 mr-0.5" /> Admin Sandbox</span>
              ) : (
                <span className="text-muted-foreground">User Analyst</span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs font-semibold text-muted-foreground hover:text-danger flex items-center justify-center group-hover:justify-start gap-2 px-3 py-2 rounded-lg hover:bg-danger/5 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden group-hover:inline whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Outer Content Frame wrapper (offset by the collapsed rail width) */}
      <div className="flex-1 ml-16 flex flex-col min-h-screen">
        
        {/* 2. Sticky Top Navigation Bar */}
        <header className="h-16 border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-10 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h1 className="font-bold text-sm text-foreground">Chat Workspace</h1>
          </div>

          <div className="flex items-center space-x-4">
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all border border-transparent hover:border-border"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Admin Panel</span>
              </Link>
            )}
          </div>
        </header>

        {/* 3. Main Scrollable Content Area */}
        <main className="flex-1 p-6 overflow-y-auto bg-background">
          <div className="max-w-6xl mx-auto">
            <ChatWindow />
          </div>
        </main>

      </div>

    </div>
  );
}
