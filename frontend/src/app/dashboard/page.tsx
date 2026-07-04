'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles, LogOut, MessageSquare, ShieldCheck,
  Database, Plus, Trash2, History, X
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import api from '../../services/api';
import { ChatWindow } from '../../components/chat/ChatWindow';
import SchemaExplorer from '../../components/chat/SchemaExplorer';
import ThemeToggle from '../../components/ui/ThemeToggle';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearSession } = useAuthStore();
  const {
    conversations, currentConversationId,
    setConversations, setCurrentConversationId, setMessages
  } = useChatStore();
  const [activePanel, setActivePanel] = useState<'recent' | 'schema' | null>(null);
  const togglePanel = (p: 'recent' | 'schema') => setActivePanel((prev) => (prev === p ? null : p));

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
    <div className="min-h-screen text-foreground flex">
      
      {/* 1. Icon rail — click an icon to open its panel (VS Code style) */}
      <aside className="w-14 h-screen fixed left-0 top-0 border-r border-border bg-card flex flex-col items-center justify-between py-3 z-40">
        <div className="flex flex-col items-center gap-1">
          {/* Brand */}
          <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center shadow-sm mb-2">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {/* New chat */}
          <button
            onClick={() => { handleNewChat(); setActivePanel(null); }}
            title="New chat"
            className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-90 cursor-pointer"
          >
            <Plus className="h-5 w-5" />
          </button>
          {/* Recent chats */}
          <button
            onClick={() => togglePanel('recent')}
            title="Recent chats"
            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer ${activePanel === 'recent' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <History className="h-5 w-5" />
          </button>
          {/* Schema explorer */}
          <button
            onClick={() => togglePanel('schema')}
            title="Schema explorer"
            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer ${activePanel === 'schema' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Database className="h-5 w-5" />
          </button>
        </div>

        {/* Bottom: theme toggle + user avatar + sign out */}
        <div className="flex flex-col items-center gap-2">
          <ThemeToggle />
          <div
            title={`${user.email} (${user.role})`}
            className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-[11px] font-bold text-foreground uppercase"
          >
            {user.email.charAt(0)}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-danger hover:bg-danger/5 transition-all duration-150 active:scale-90 cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Flyout panel (Recent or Schema) — sits beside the rail and pushes content */}
      {activePanel && (
        <div className="w-72 h-screen fixed left-14 top-0 border-r border-border bg-card z-30 flex flex-col">
          <button
            onClick={() => setActivePanel(null)}
            title="Close"
            className="absolute top-3.5 right-3 z-10 text-muted-foreground hover:text-foreground p-1 rounded cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex-1 overflow-y-auto">
            {activePanel === 'recent' ? (
              <div className="p-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block px-1 mt-1 mb-2">Recent Chats</span>
                <div className="space-y-0.5">
                  {conversations.length === 0 ? (
                    <span className="text-xs text-muted-foreground block px-2 py-2 italic">No chats yet</span>
                  ) : (
                    conversations.map((conv) => {
                      const isActive = currentConversationId === conv.conversation_id;
                      return (
                        <div
                          key={conv.conversation_id}
                          onClick={() => setCurrentConversationId(conv.conversation_id)}
                          className={`group/item flex items-center justify-between px-3 py-2 rounded-lg text-[13px] cursor-pointer transition-colors ${
                            isActive ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          }`}
                        >
                          <span className="truncate pr-2">{conv.title}</span>
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
            ) : (
              <SchemaExplorer />
            )}
          </div>
        </div>
      )}

      {/* Main content — offset by the rail, and by the panel when one is open */}
      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ${activePanel ? 'ml-[344px]' : 'ml-14'}`}>
        
        {/* 2. Sticky Top Navigation Bar */}
        <header className="h-16 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10 px-6 flex items-center justify-between">
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
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <ChatWindow />
          </div>
        </main>

      </div>

    </div>
  );
}
