'use client';

import React, { useState } from 'react';
import { Sparkles, Terminal, Table as TableIcon, BarChart2, ThumbsUp, ThumbsDown, Copy, Check, MessageSquare } from 'lucide-react';
import { Message } from '../../types';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import QueryVisualizer from './QueryVisualizer';
import api from '../../services/api';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  const copyToClipboard = () => {
    if (message.generated_sql) {
      navigator.clipboard.writeText(message.generated_sql);
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
          <div className="bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg shadow-indigo-500/10">
            <p className="text-sm font-medium leading-relaxed">{message.content}</p>
            <div className="text-[10px] text-indigo-200 mt-1.5 flex justify-end">
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-zinc-400" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant Response styling
  return (
    <div className="flex justify-start mb-6">
      <div className="flex items-start space-x-3 max-w-[90%]">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-2xl rounded-tl-sm p-5 shadow-xl">
          {/* Explanation Text */}
          <div className="prose prose-invert max-w-none text-sm text-zinc-300 leading-relaxed">
            {message.content}
          </div>

          {/* Conditional SQL / Grid Tabs */}
          {message.generated_sql && (
            <div className="mt-4">
              <Tabs defaultValue="results">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <TabsList className="bg-zinc-950/60 scale-95 origin-left">
                    <TabsTrigger value="results" className="flex items-center space-x-1.5 text-xs py-1">
                      <TableIcon className="h-3.5 w-3.5" />
                      <span>Data Grid</span>
                    </TabsTrigger>
                    <TabsTrigger value="sql" className="flex items-center space-x-1.5 text-xs py-1">
                      <Terminal className="h-3.5 w-3.5" />
                      <span>SQL Query</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Data Grid Content */}
                <TabsContent value="results" className="pt-3">
                  {message.sql_results && message.sql_results.rows.length > 0 ? (
                    <div className="space-y-2">
                      <div className="max-h-72 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {message.sql_results.columns.map((col) => (
                                <TableHead key={col} className="text-xs uppercase font-semibold text-zinc-400 py-2">
                                  {col.replace('_', ' ')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {message.sql_results.rows.map((row, index) => (
                              <TableRow key={index} className="border-zinc-800/40">
                                {message.sql_results!.columns.map((col) => (
                                  <TableCell key={col} className="text-xs py-2 font-mono">
                                    {row[col] !== null ? String(row[col]) : <span className="text-zinc-600">null</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="text-[10px] text-zinc-500 text-right">
                        Showing {message.sql_results.rows.length} rows
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                      <span>No tabular data returned for this query.</span>
                    </div>
                  )}
                </TabsContent>

                {/* SQL Query Content */}
                <TabsContent value="sql" className="pt-3">
                  <div className="relative">
                    <pre className="bg-zinc-950 p-4 rounded-lg overflow-x-auto text-[11px] text-indigo-300 font-mono border border-zinc-900 leading-normal max-h-72">
                      <code>{message.generated_sql}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyToClipboard}
                      className="absolute top-2 right-2 h-7 w-7 p-0 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white"
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
          {message.visualization_config && (
            <QueryVisualizer config={message.visualization_config} />
          )}

          {/* Assistant feedback row */}
          {message.generated_sql && (
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-900/60">
              <span className="text-[11px] text-zinc-500 italic">Was this query accurate?</span>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => submitFeedback(5)}
                  className={`h-7 w-7 p-0 hover:bg-zinc-800 ${feedback === 'like' ? 'text-emerald-400' : 'text-zinc-500'}`}
                  title="Thumbs up"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => submitFeedback(1)}
                  className={`h-7 w-7 p-0 hover:bg-zinc-800 ${feedback === 'dislike' ? 'text-rose-400' : 'text-zinc-500'}`}
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
