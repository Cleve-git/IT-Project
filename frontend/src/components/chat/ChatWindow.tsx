'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Send, Terminal, Loader2, ArrowRight, BookOpen } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import ChatMessage from './ChatMessage';
import SchemaExplorer from './SchemaExplorer';
import { Button } from '../ui/button';

const SUGGESTED_PROMPTS = [
  "Show total revenue by customer",
  "What is our best selling product?",
  "Calculate profit for all products",
  "Which customers are top tier in NY?"
];

export const ChatWindow: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    conversations, currentConversationId, messages, isLoading, 
    setConversations, setCurrentConversationId, setMessages, addMessage, setLoading 
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Conversations on Mount
  useEffect(() => {
    const fetchConvs = async () => {
      try {
        const list = await api.listConversations();
        setConversations(list);
      } catch (err) {
        console.error("Failed to load conversations", err);
      }
    };
    fetchConvs();
  }, [setConversations]);

  // 2. Fetch Messages when Active Room changes
  useEffect(() => {
    if (!currentConversationId) return;
    const fetchMsgs = async () => {
      setLoading(true);
      try {
        const msgsList = await api.getMessages(currentConversationId);
        setMessages(msgsList);
      } catch (err) {
        console.error("Failed to load messages", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMsgs();
  }, [currentConversationId, setMessages, setLoading]);

  // 3. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 4. Handle Submitting Query
  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput('');
    setLoading(true);

    // Append user message instantly
    const tempUserMsg = {
      message_id: Math.random().toString(),
      conversation_id: currentConversationId || '',
      role: 'user' as const,
      content: text,
      generated_sql: null,
      sql_results: null,
      visualization_config: null,
      explanation: null,
      created_at: new Date().toISOString()
    };
    addMessage(tempUserMsg);

    try {
      const response = await api.submitQuery(text, currentConversationId || undefined);
      
      // If room was newly created
      if (!currentConversationId && response.conversation_id) {
        setCurrentConversationId(response.conversation_id);
        const list = await api.listConversations();
        setConversations(list);
      } else {
        // Replace temp msg list or append response
        addMessage(response);
      }
    } catch (err: any) {
      // Append error message from bot
      addMessage({
        message_id: Math.random().toString(),
        conversation_id: currentConversationId || '',
        role: 'assistant',
        content: `Error: ${err.message || 'Something went wrong during SQL execution.'}`,
        generated_sql: null,
        sql_results: null,
        visualization_config: null,
        explanation: null,
        created_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
      // Reload conversations list in case titles updated
      const list = await api.listConversations();
      setConversations(list);
    }
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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-zinc-950/20 rounded-xl border border-zinc-900">
      
      {/* 1. Left Sidebar: Chats History */}
      <div className="w-64 border-r border-zinc-900 bg-zinc-950/60 p-4 flex flex-col justify-between">
        <div>
          <Button 
            onClick={handleNewChat}
            variant="outline" 
            className="w-full flex items-center justify-center space-x-2 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900 py-5 text-sm"
          >
            <Plus className="h-4 w-4 text-indigo-400" />
            <span>New Analyst Chat</span>
          </Button>

          <div className="mt-6 space-y-1.5 overflow-y-auto max-h-[50vh] pr-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block px-2 mb-2">Recent Threads</span>
            {conversations.length === 0 ? (
              <span className="text-xs text-zinc-600 block px-2 italic">No chats yet</span>
            ) : (
              conversations.map((conv) => {
                const isActive = currentConversationId === conv.conversation_id;
                return (
                  <div
                    key={conv.conversation_id}
                    onClick={() => setCurrentConversationId(conv.conversation_id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? 'bg-indigo-950/30 text-indigo-300 border border-indigo-500/20 font-medium' 
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <span className="truncate pr-2 max-w-[160px] font-medium">{conv.title}</span>
                    <button
                      onClick={(e) => handleDeleteChat(e, conv.conversation_id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition-opacity"
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
        
        <div className="p-3 bg-zinc-900/20 rounded-lg border border-zinc-800/40 text-[11px] text-zinc-500">
          Logged in as <span className="font-semibold text-zinc-300">{user?.email}</span>
        </div>
      </div>

      {/* 2. Center: Chat Room Viewport */}
      <div className="flex-1 flex flex-col justify-between bg-zinc-950/10">
        
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                <Terminal className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Conversational Data Analyst</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Query customer segments, analyze orders, or generate profit models using natural language. 
                  Ask business questions and get compiled SQL executing directly on your database.
                </p>
              </div>

              {/* Suggestions */}
              <div className="grid grid-cols-2 gap-3 w-full pt-4">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSubmit(prompt)}
                    className="p-3.5 text-left border border-zinc-800 hover:border-indigo-500/30 rounded-xl hover:bg-zinc-900/30 text-xs text-zinc-400 hover:text-indigo-300 transition-all duration-200 cursor-pointer flex items-center justify-between"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {messages.map((msg) => (
                <ChatMessage key={msg.message_id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex justify-start mb-6">
                  <div className="flex items-center space-x-2 bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl max-w-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span className="text-xs text-zinc-400 font-medium">Analyst compiling SQL query...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950/40">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }} 
            className="max-w-4xl mx-auto flex items-center space-x-3 bg-zinc-900/60 rounded-xl border border-zinc-800 px-4 py-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the business data... (e.g. List premium customers in Los Angeles)"
              className="flex-1 bg-transparent border-none text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none py-2"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2.5"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="text-[10px] text-zinc-600 text-center mt-2 flex items-center justify-center space-x-1.5">
            <BookOpen className="h-3 w-3" />
            <span>Only SELECT operations are permitted. Query modifications are blocked by safety guardrails.</span>
          </div>
        </div>

      </div>

      {/* 3. Right Sidebar: Schema Explorer */}
      <div className="w-80 border-l border-zinc-900 bg-zinc-950/60 p-4 overflow-y-auto hidden xl:block">
        <SchemaExplorer />
      </div>

    </div>
  );
};

export default ChatWindow;
