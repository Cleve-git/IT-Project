'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, ArrowRight, Mic, MicOff, Sparkles } from 'lucide-react';
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
  const recognitionRef = useRef<any>(null);

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

  // Load a conversation's message history whenever one is selected
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

  const renderInputForm = (centered: boolean = false) => (
    <form
      onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
      className={`w-full flex items-center gap-2 rounded-full border px-3.5 py-2.5 shadow-md focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-card transition-all duration-200 ${
        centered
          ? 'max-w-2xl bg-card border-border/80'
          : 'max-w-3xl bg-card/90 backdrop-blur-sm border-border'
      }`}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={listening ? 'Listening… speak your query' : 'Ask a question about your database (e.g. Total revenue by category)...'}
        className="flex-1 bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-2 py-1"
        disabled={isLoading}
      />
      {speechSupported && (
        <button
          type="button"
          onClick={toggleMic}
          disabled={isLoading}
          title={listening ? 'Stop listening' : 'Voice input'}
          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
            listening ? 'text-danger bg-danger/10 animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={!input.trim() || isLoading}
        className="h-9 px-3.5 rounded-full flex items-center justify-center shrink-0 font-semibold gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-transform"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
        ) : (
          <>
            <span className="hidden sm:inline text-xs">Send</span>
            <Send className="h-3.5 w-3.5 text-primary-foreground" />
          </>
        )}
      </Button>
    </form>
  );

  return (
    <div className="flex w-full h-[calc(100vh-8rem)]">

      {/* Main Dialogue Viewport */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden">

        {messages.length === 0 && loadingHistory ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground font-semibold">Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          /* INITIAL EMPTY STATE: Centered Form under "What would you like to analyze?" + Suggested Prompts below form */
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 space-y-6 my-auto py-8">
            
            {/* Title Header */}
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
                What would you like to analyze?
              </h2>
            </div>

            {/* Chatbot Form placed in CENTER below title */}
            <div className="w-full flex justify-center">
              {renderInputForm(true)}
            </div>

            {/* Suggested Prompts placed BELOW chatbot form */}
            <div className="w-full space-y-2.5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSubmit(prompt)}
                    className="group flex items-center justify-between px-4 py-3 text-left rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40 text-xs font-medium text-foreground/90 transition-all duration-150 ease-out cursor-pointer shadow-sm"
                  >
                    <span className="truncate pr-2">{prompt}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1.5 pt-1">
              <span>Read-only SQL execution environment. Data modifications are blocked.</span>
            </div>

          </div>
        ) : (
          /* ACTIVE INTERACTION STATE: Messages stream on top + Input Bar at the BOTTOM */
          <>
            {/* Messages Stream Scroll Container */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.message_id} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-6">
                    <div className="flex items-center space-x-2 border border-border/80 p-4 rounded-xl max-w-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Analyst compiling SQL query...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Bar at the BOTTOM when interacting */}
            <div className="px-4 pb-4 pt-3 shrink-0">
              <div className="max-w-3xl mx-auto">
                {renderInputForm(false)}
              </div>
              <div className="text-[10px] text-muted-foreground/70 text-center mt-2 flex items-center justify-center gap-1.5">
                <span>Read-only SQL execution environment. Data modifications are blocked.</span>
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  );
};

export default ChatWindow;
