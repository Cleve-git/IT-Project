'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles, LogOut, MessageSquare, ShieldCheck,
  Database, Plus, Trash2, Shield, X, PanelLeftClose,
  PanelLeftOpen, Search, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { Conversation } from '../../types';
import api from '../../services/api';
import { ChatWindow } from '../../components/chat/ChatWindow';
import SchemaExplorer from '../../components/chat/SchemaExplorer';
import ThemeToggle from '../../components/ui/ThemeToggle';

interface GroupedConversations {
  label: string;
  items: Conversation[];
}

function getGroupedConversations(conversations: Conversation[], searchQuery: string): GroupedConversations[] {
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const twoDays: Conversation[] = [];
  const threeDays: Conversation[] = [];
  const previous7Days: Conversation[] = [];
  const older: Conversation[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msInDay = 24 * 60 * 60 * 1000;

  filtered.forEach((conv) => {
    const dateStr = conv.updated_at || conv.created_at;
    if (!dateStr) {
      older.push(conv);
      return;
    }
    const convDate = new Date(dateStr);
    const convStart = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate()).getTime();
    const diffDays = Math.round((todayStart - convStart) / msInDay);

    if (diffDays <= 0) {
      today.push(conv);
    } else if (diffDays === 1) {
      yesterday.push(conv);
    } else if (diffDays === 2) {
      twoDays.push(conv);
    } else if (diffDays === 3) {
      threeDays.push(conv);
    } else if (diffDays > 3 && diffDays <= 7) {
      previous7Days.push(conv);
    } else {
      older.push(conv);
    }
  });

  const groups: GroupedConversations[] = [];
  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
  if (twoDays.length > 0) groups.push({ label: '2 days', items: twoDays });
  if (threeDays.length > 0) groups.push({ label: '3 days', items: threeDays });
  if (previous7Days.length > 0) groups.push({ label: 'Previous 7 days', items: previous7Days });
  if (older.length > 0) groups.push({ label: 'Older', items: older });

  return groups;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearSession } = useAuthStore();
  const {
    conversations, currentConversationId,
    setConversations, setCurrentConversationId, setMessages
  } = useChatStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<'chat' | 'schema'>('chat');
  const [searchQuery, setSearchQuery] = useState('');

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
    setActiveView('chat');
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

  const groupedChats = getGroupedConversations(conversations, searchQuery);

  return (
    <div className="min-h-screen text-foreground flex bg-background">

      {/* 1. Main Collapsible Sidebar */}
      <aside
        className={`h-screen fixed left-0 top-0 border-r border-border bg-card z-30 flex flex-col justify-between transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-16'
          }`}
      >
        {/* Top Sidebar Content */}
        <div className="flex flex-col h-full overflow-hidden">

          {/* Header Bar with Logo and Toggle Button */}
          <div className="h-16 px-3 border-b border-border/60 flex items-center justify-between shrink-0">
            {isSidebarOpen ? (
              <>
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <div className="rounded-lg flex items-center justify-center shadow-sm shrink-0">
                    <img src="/logo/CondaAI.png" alt="Conda AI" className="h-6 w-6 dark:invert dark:brightness-200" />
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  title="Collapse sidebar"
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Expand sidebar"
                className="group h-10 w-10 mx-auto rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer relative"
              >
                <img
                  src="/logo/CondaAI.png"
                  alt="Conda AI"
                  className="h-6 w-6 dark:invert dark:brightness-200 group-hover:hidden transition-all"
                />
                <PanelLeftOpen className="h-5 w-5 hidden group-hover:block text-foreground transition-all" />
              </button>
            )}
          </div>

          {/* Action Buttons Section */}
          <div className="p-3 space-y-2.5 shrink-0">

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              title="New chat"
              className={`w-full flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:opacity-95 transition-all duration-150 active:scale-98 cursor-pointer ${isSidebarOpen ? 'px-3 py-2.5 space-x-2' : 'h-10 w-10 mx-auto p-0'
                }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {isSidebarOpen && <span>New chat</span>}
            </button>

            {/* Search Bar directly below New Chat Button */}
            {isSidebarOpen ? (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 border border-border/80 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Search chats"
                className="h-9 w-9 mx-auto rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Recent Chats Section grouped by date (visible when sidebar is open) */}
          {isSidebarOpen ? (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
              {groupedChats.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground italic">
                  {searchQuery ? "No matching chats found" : "No recent chats yet"}
                </div>
              ) : (
                groupedChats.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-2 py-1">
                      {group.label}
                    </span>
                    <div className="space-y-0.5">
                      {group.items.map((conv) => {
                        const isActive = activeView === 'chat' && currentConversationId === conv.conversation_id;
                        return (
                          <div
                            key={conv.conversation_id}
                            onClick={() => {
                              setCurrentConversationId(conv.conversation_id);
                              setActiveView('chat');
                            }}
                            className={`group/item flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
                              }`}
                          >
                            <span className="truncate pr-2">{conv.title || "Untitled Conversation"}</span>
                            <button
                              onClick={(e) => handleDeleteChat(e, conv.conversation_id)}
                              className="opacity-0 group-hover/item:opacity-100 hover:text-danger p-0.5 rounded transition-opacity shrink-0"
                              title="Delete conversation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center space-y-2">
              <button
                onClick={() => { setActiveView('chat'); setIsSidebarOpen(true); }}
                title="Recent chats"
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${activeView === 'chat' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Schema Explorer Navigation Item at Sidebar Bottom */}
          <div className="p-3 border-t border-border/60 shrink-0 space-y-1">
            <button
              onClick={() => setActiveView('schema')}
              title="Schema Explorer"
              className={`w-full flex items-center rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 ${isSidebarOpen ? 'px-3 py-2.5 space-x-2.5' : 'h-10 w-10 mx-auto justify-center'
                } ${activeView === 'schema'
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/10 hover:text-foreground'
                }`}
            >
              <Database className="h-4 w-4 shrink-0" />
              {isSidebarOpen && <span>Schema</span>}
            </button>
          </div>

          {/* Footer User Info */}
          <div className="p-3 border-t border-border/60 shrink-0 flex items-center justify-between">
            {isSidebarOpen ? (
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <div
                  title={`${user.email} (${user.role})`}
                  className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground uppercase shrink-0"
                >
                  {user.email.charAt(0)}
                </div>
                <div className="flex flex-col truncate text-left">
                  <span className="text-xs font-semibold text-foreground truncate">{user.email}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{user.role}</span>
                </div>
              </div>
            ) : (
              <div
                title={`${user.email} (${user.role})`}
                className="h-8 w-8 mx-auto rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground uppercase"
              >
                {user.email.charAt(0)}
              </div>
            )}

            {isSidebarOpen && (
              <button
                onClick={handleLogout}
                title="Sign out"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>

        </div>
      </aside>

      {/* 2. Main Content Area — Offset dynamically by sidebar width */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'ml-72' : 'ml-16'
          }`}
      >

        {/* Sticky Header with Title and Theme Toggle at Top Right Corner */}
        <header className="h-16 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Open sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <h1 className="font-semibold text-base text-foreground">
              {activeView === 'schema' ? 'Schema Explorer' : 'Conda AI'}
            </h1>
          </div>

          {/* Top Right Items: Admin Link & Theme Toggle */}
          <div className="flex items-center space-x-3">
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all border border-border/60 hover:border-border"
              >
                <span>Admin Panel</span>
              </Link>
            )}

            {/* Theme Mode Toggle Button placed in Top Right Corner */}
            <ThemeToggle className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer" />
          </div>
        </header>

        {/* Main View Area (Chatbot or Schema Explorer) */}
        <main className="flex-1 overflow-y-auto">
          {activeView === 'schema' ? (
            <SchemaExplorer />
          ) : (
            <div className="p-6 max-w-6xl mx-auto">
              <ChatWindow />
            </div>
          )}
        </main>

      </div>

    </div>
  );
}
