'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Loader2, ArrowRight, BookOpen, Mic, MicOff } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import api from '../../services/api';
import ChatMessage from './ChatMessage';
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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Voice-to-text via the browser's Web Speech API (Chrome/Edge)
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => { try { rec.abort(); } catch { /* ignore */ } };
  }, []);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setInput('');
      try { rec.start(); setListening(true); } catch { /* already started */ }
    }
  };

  // Load a conversation's message history whenever one is selected (or after a
  // new chat is created). Selecting "New Chat" sets the id to null -> stays empty.
  useEffect(() => {
    if (!currentConversationId) return;
    let cancelled = false;
    setLoadingHistory(true);
    (async () => {
      try {
        const history = await api.getMessages(currentConversationId);
        if (!cancelled) setMessages(history);
      } catch (err) {
        console.error('Failed to load conversation messages', err);
      } finally {
        if (!cancelled) setLoadingHistory(false);
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
    <div className="flex">

      {/* Center Dialogue Viewport — blends with the page background (no card frame) */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden h-[calc(100vh-8rem)]">
        
        {/* Messages Stream scroll container */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {messages.length === 0 && loadingHistory ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-semibold">Loading conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-2.5">
                What would you like to analyze?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-9 max-w-md">
                Ask a business question in plain language — get the answer, the SQL, and a chart.
              </p>

              {/* Suggested prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSubmit(prompt)}
                    className="group flex items-center gap-3 px-4 py-3 text-left rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-sm text-foreground/90 transition-all duration-150 ease-out cursor-pointer"
                  >
                    <span className="flex-1">{prompt}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
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
        <div className="px-4 pb-4 pt-3">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
            className="max-w-3xl mx-auto flex items-center gap-2 bg-muted/30 rounded-2xl border border-border px-3 py-2 shadow-sm focus-within:border-primary/40 focus-within:bg-card transition-all duration-150"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? 'Listening…' : 'Ask a question about the business data...'}
              className="flex-1 bg-transparent border-none text-sm text-foreground placeholder-muted-foreground focus:outline-none px-2 py-1.5"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Send className="h-4 w-4 text-primary-foreground" />}
            </Button>
          </form>
          <div className="text-[10px] text-muted-foreground/70 text-center mt-2.5 flex items-center justify-center gap-1.5">
            <BookOpen className="h-3 w-3" />
            <span>Read-only — only SELECT queries are allowed, modifications are blocked.</span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ChatWindow;
