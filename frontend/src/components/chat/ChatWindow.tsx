'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Loader2, ArrowRight, BookOpen } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import api from '../../services/api';
import ChatMessage from './ChatMessage';
import SchemaExplorer from './SchemaExplorer';
import { Button } from '../ui/button';

const SUGGESTED_PROMPTS = [
  "Show total revenue by customer",
  "What is our best selling product?",
  "Calculate profit for all products",
  "List Gold tier customers in Jakarta"
];

export const ChatWindow: React.FC = () => {
  const { 
    currentConversationId, messages, isLoading, 
    setConversations, setCurrentConversationId, setMessages, addMessage, setLoading 
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load a conversation's message history whenever one is selected (or after a
  // new chat is created). Selecting "New Chat" sets the id to null -> stays empty.
  useEffect(() => {
    if (!currentConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const history = await api.getMessages(currentConversationId);
        if (!cancelled) setMessages(history);
      } catch (err) {
        console.error('Failed to load conversation messages', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentConversationId, setMessages]);

  // Handle Submitting Query
  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput('');
    setLoading(true);

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
      
      if (!currentConversationId && response.conversation_id) {
        setCurrentConversationId(response.conversation_id);
        const list = await api.listConversations();
        setConversations(list);
      } else {
        addMessage(response);
      }
    } catch (err: any) {
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
      const list = await api.listConversations();
      setConversations(list);
    }
  };

  return (
    <div className="flex gap-6 items-start">
      
      {/* Center Dialogue Viewport */}
      <div className="flex-1 flex flex-col justify-between bg-card rounded-[12px] border border-border shadow-sm overflow-hidden h-[calc(100vh-8rem)]">
        
        {/* Messages Stream scroll container */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Terminal className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground tracking-tight">Conda AI Chat Analyst</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Query customer segments, analyze orders, or generate profit models using natural language. 
                  Ask business questions and get compiled SQL executing directly on your database.
                </p>
              </div>

              {/* Suggested Prompt Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-4">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSubmit(prompt)}
                    className="p-3.5 text-left border border-border hover:border-primary/30 rounded-[8px] hover:bg-muted/40 text-xs text-muted-foreground hover:text-primary transition-all duration-150 ease-out cursor-pointer flex items-center justify-between group shadow-sm bg-card"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
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
                  <div className="flex items-center space-x-2 bg-muted/40 border border-border/80 p-4 rounded-xl max-w-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-semibold">Analyst compiling SQL query...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar form */}
        <div className="p-4 border-t border-border bg-muted/10">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }} 
            className="max-w-4xl mx-auto flex items-center space-x-3 bg-card rounded-lg border border-border px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-150"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the business data... (e.g. List Gold tier customers in Jakarta)"
              className="flex-1 bg-transparent border-none text-sm text-foreground placeholder-muted-foreground focus:outline-none py-2"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2.5"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Send className="h-4 w-4 text-primary-foreground" />}
            </Button>
          </form>
          <div className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center space-x-1.5">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span>Only SELECT operations are permitted. Query modifications are blocked by safety guardrails.</span>
          </div>
        </div>

      </div>

      {/* Right Sidebar: Schema Explorer */}
      <div className="w-80 overflow-y-auto hidden xl:block sticky top-0 h-[calc(100vh-8rem)]">
        <SchemaExplorer />
      </div>

    </div>
  );
};

export default ChatWindow;
