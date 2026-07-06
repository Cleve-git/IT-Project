'use client';

import React, { useState } from 'react';
import { Database, Terminal, Table as TableIcon, ThumbsUp, ThumbsDown, Copy, Check, MessageSquare } from 'lucide-react';
import { Message } from '../../types';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import QueryVisualizer from './QueryVisualizer';
import api from '../../services/api';

interface ChatMessageProps {
  message: Message;
}

// Lightweight, XSS-safe inline markdown: renders **bold** and *italic*.
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

  const isQueryResult = message.type === 'query_result' || !!message.generated_sql;
  const sqlContent = message.sql || message.generated_sql;
  const resultsList = message.results || message.sql_results?.rows || [];
  const columns = message.sql_results?.columns || (resultsList.length > 0 ? Object.keys(resultsList[0]) : []);
  const visualizationData = message.visualization || message.visualization_config;
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
        <div className="flex items-start space-x-3 w-full max-w-[80%]">
          <div className="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-md px-4 py-3 active:scale-[0.98] transition-all">
            <p className="text-sm font-medium leading-relaxed">{message.content}</p>
            <div className="text-[10px] text-white/60 dark:text-gray-900/60 mt-1.5 flex justify-end font-mono">
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

  // Assistant response
  return (
    <div className="flex justify-start mb-6">
      <div className="flex items-start space-x-3 w-full max-w-[90%]">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
          <Database className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </div>
        <div className="flex-1 bg-card border border-border rounded-md p-5">
          {/* Explanation Text */}
          <div className="prose max-w-none text-sm text-foreground leading-relaxed font-normal whitespace-pre-wrap">
            {renderInlineMarkdown(message.message || message.content || '')}
          </div>

          {/* Scalar: on-demand SQL toggle */}
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
                <pre className="mt-2 bg-gray-900 dark:bg-gray-950 p-3 rounded-md overflow-x-auto text-[11px] text-gray-300 font-mono border border-border leading-normal">
                  <code>{sqlContent}</code>
                </pre>
              )}
            </div>
          )}

          {/* SQL / Grid Tabs (multi-row results) */}
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
                    <div className="h-28 flex flex-col items-center justify-center border border-dashed border-border rounded-md text-muted-foreground text-xs">
                      <span>No tabular data returned for this query.</span>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sql" className="pt-3">
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-gray-950 p-4 rounded-md overflow-x-auto text-[11px] text-gray-300 font-mono border border-border leading-normal max-h-72">
                      <code>{sqlContent}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyToClipboard}
                      className="absolute top-2 right-2 h-7 w-7 p-0 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-400 hover:text-gray-100"
                      title="Copy SQL to Clipboard"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-gray-300" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Plotly visualizer */}
          {isQueryResult && visualizationData && (
            <QueryVisualizer config={visualizationData} />
          )}

          {/* Feedback row */}
          {isQueryResult && sqlContent && (
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/80">
              <span className="text-[11px] text-muted-foreground italic font-medium">Was this query accurate?</span>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => submitFeedback(5)}
                  className={`h-7 w-7 p-0 hover:bg-muted ${feedback === 'like' ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground'}`}
                  title="Thumbs up"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => submitFeedback(1)}
                  className={`h-7 w-7 p-0 hover:bg-muted ${feedback === 'dislike' ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground'}`}
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
