'use client';

import React, { useState } from 'react';
import { Sparkles, Terminal, Table as TableIcon, ThumbsUp, ThumbsDown, Copy, Check, MessageSquare, Database } from 'lucide-react';
import { Message } from '../../types';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import QueryVisualizer from './QueryVisualizer';
import api from '../../services/api';

interface ChatMessageProps {
  message: Message;
}

// Lightweight, XSS-safe inline markdown for the explanation text: renders
// **bold** and *italic* (the model emits these) instead of showing raw asterisks.
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [showSql, setShowSql] = useState(false);

  // Compatible mappings for new/old backend schemas
  const isQueryResult = message.type === 'query_result' || !!message.generated_sql;
  const sqlContent = message.sql || message.generated_sql;
  const resultsList = message.results || message.sql_results?.rows || [];
  const columns = message.sql_results?.columns || (resultsList.length > 0 ? Object.keys(resultsList[0]) : []);
  const visualizationData = message.visualization || message.visualization_config;
  // A single value (e.g. a total or one "top" result) is already stated in the
  // explanation, so we skip the grid and offer SQL on demand instead.
  const isScalar = isQueryResult && resultsList.length === 1 && columns.length <= 1;

  const copyToClipboard = () => {
    if (sqlContent) {
      navigator.clipboard.writeText(sqlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const submitFeedback = async (rating: number) => {
    try {
      await api.submitFeedback(message.message_id, rating);
      setFeedback(rating === 5 ? 'like' : 'dislike');
    } catch (err) {
      console.error("Failed to submit feedback", err);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="flex items-start space-x-3 max-w-[80%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm active:scale-[0.98] transition-all">
            <p className="text-sm font-medium leading-relaxed">{message.content}</p>
            <div className="text-[10px] text-primary-foreground/75 mt-1.5 flex justify-end font-mono">
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant Response styling
  return (
    <div className="flex justify-start mb-6">
      <div className="flex items-start space-x-3 max-w-[90%]">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 bg-card border border-border rounded-2xl rounded-tl-sm p-5 shadow-sm">
          {/* Explanation Text */}
          <div className="prose max-w-none text-sm text-foreground leading-relaxed font-normal whitespace-pre-wrap">
            {renderInlineMarkdown(message.message || message.content || '')}
          </div>

          {/* Referenced from — data provenance / citation */}
          {isQueryResult && message.references && message.references.tables.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                <Database className="h-3 w-3" /> Referenced from:
              </span>
              {message.references.tables.map((t) => (
                <span key={t.table} className="relative inline-flex group/ref">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 font-mono text-foreground/80 cursor-help">
                    {t.table}
                  </span>
                  {/* Custom tooltip — instant, theme-aware, with an arrow */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 translate-y-1 group-hover/ref:opacity-100 group-hover/ref:translate-y-0 transition-all duration-150">
                    <span className="block whitespace-nowrap rounded-lg bg-card border border-border shadow-lg px-2.5 py-1.5 text-[11px] text-foreground">
                      <span className="font-semibold capitalize">{t.table}</span>
                      <span className="text-muted-foreground"> — {t.description}</span>
                    </span>
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 h-2 w-2 rotate-45 bg-card border-b border-r border-border" />
                  </span>
                </span>
              ))}
              <span className="text-muted-foreground/70">
                · {message.references.row_count} row{message.references.row_count === 1 ? '' : 's'} · live database
              </span>
            </div>
          )}

          {/* Compact view for single-value answers: just an on-demand SQL toggle */}
          {isQueryResult && sqlContent && isScalar && (
            <div className="mt-3">
              <button
                onClick={() => setShowSql(!showSql)}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Terminal className="h-3 w-3" />
                {showSql ? 'Hide SQL' : 'Show SQL'}
              </button>
              {showSql && (
                <pre className="mt-2 bg-[#0f172a] p-3 rounded-lg overflow-x-auto text-[11px] text-blue-300 font-mono border border-border leading-normal">
                  <code>{sqlContent}</code>
                </pre>
              )}
            </div>
          )}

          {/* Conditional SQL / Grid Tabs (multi-row results) */}
          {isQueryResult && sqlContent && !isScalar && (
            <div className="mt-4">
              <Tabs defaultValue="results">
                <div className="flex justify-between items-center border-b border-border/80 pb-2">
                  <TabsList className="bg-muted scale-95 origin-left">
                    <TabsTrigger value="results" className="flex items-center space-x-1.5 text-xs py-1">
                      <TableIcon className="h-3.5 w-3.5" />
                      <span>Data Grid</span>
                    </TabsTrigger>
                    <TabsTrigger value="sql" className="flex items-center space-x-1.5 text-xs py-1">
                      <Terminal className="h-3.5 w-3.5" />
                      <span>SQL Query</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Data Grid Content */}
                <TabsContent value="results" className="pt-3">
                  {resultsList.length > 0 ? (
                    <div className="space-y-2">
                      <div className="max-h-72 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {columns.map((col) => (
                                <TableHead key={col} className="text-xs uppercase font-semibold text-muted-foreground py-2">
                                  {col.replace('_', ' ')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {resultsList.map((row, index) => (
                              <TableRow key={index} className="border-border/40">
                                {columns.map((col) => (
                                  <TableCell key={col} className="text-xs py-2 font-mono text-foreground">
                                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-muted-foreground/60 italic">null</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right">
                        Showing {resultsList.length} rows
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 flex flex-col items-center justify-center border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                      <span>No tabular data returned for this query.</span>
                    </div>
                  )}
                </TabsContent>

                {/* SQL Query Content */}
                <TabsContent value="sql" className="pt-3">
                  <div className="relative">
                    <pre className="bg-background p-4 rounded-lg overflow-x-auto text-[11px] text-foreground font-mono border border-border leading-normal max-h-72">
                      <code>{sqlContent}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="absolute top-2 right-2 h-7 w-7 p-0 bg-background/80 border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Copy SQL to Clipboard"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Plotly visualizer widget */}
          {isQueryResult && visualizationData && (
            <QueryVisualizer config={visualizationData} />
          )}

          {/* Assistant feedback row */}
          {isQueryResult && sqlContent && (
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/80">
              <span className="text-[11px] text-muted-foreground italic font-medium">Was this query accurate?</span>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => submitFeedback(5)}
                  className={`h-7 w-7 p-0 hover:bg-muted ${feedback === 'like' ? 'text-success' : 'text-muted-foreground'}`}
                  title="Thumbs up"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => submitFeedback(1)}
                  className={`h-7 w-7 p-0 hover:bg-muted ${feedback === 'dislike' ? 'text-danger' : 'text-muted-foreground'}`}
                  title="Thumbs down"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
