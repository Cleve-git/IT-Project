'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { QueryLog } from '../../types';
import api from '../../services/api';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'success') return log.status === 'success';
    if (filter === 'failed') return log.status === 'failed';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-zinc-900 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">Execution Logs</h3>
          <p className="text-xs text-zinc-500">Monitor natural language query translations and statement performance metrics.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 scale-95">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-xs cursor-pointer ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-3 py-1 rounded-md text-xs cursor-pointer ${filter === 'success' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Success
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-1 rounded-md text-xs cursor-pointer ${filter === 'failed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Failed
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading} className="border-zinc-800">
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-zinc-500">Retrieving system execution logs...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-zinc-400 w-[10px]"></TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Natural Language Prompt</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Duration (ms)</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Status</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400 text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500 text-xs italic py-8">
                  No execution logs available for filter choice.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.log_id;
                return (
                  <React.Fragment key={log.log_id}>
                    <TableRow 
                      onClick={() => toggleExpand(log.log_id)}
                      className="border-zinc-850 hover:bg-zinc-900/10 cursor-pointer"
                    >
                      <TableCell className="py-3">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-zinc-200 max-w-sm truncate font-medium">
                        {log.query_text}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-zinc-400 font-mono">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          <span>{log.execution_duration_ms !== null ? `${log.execution_duration_ms}ms` : '0ms'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center text-emerald-400 text-xs font-medium">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-400 text-xs font-medium">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-zinc-500 text-right font-mono">
                        {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-zinc-950/40 border-none">
                        <TableCell colSpan={5} className="p-4 pt-1">
                          <div className="space-y-3 bg-zinc-950/80 border border-zinc-900 rounded-xl p-4">
                            {log.executed_sql && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center space-x-1">
                                  <Terminal className="h-3 w-3" />
                                  <span>Compiled SQL Statement</span>
                                </span>
                                <pre className="p-3 bg-zinc-950 rounded-lg text-xs font-mono text-zinc-300 border border-zinc-850 overflow-x-auto leading-normal">
                                  <code>{log.executed_sql}</code>
                                </pre>
                              </div>
                            )}
                            {log.error_message && (
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Error Details</span>
                                <p className="text-xs font-mono text-rose-400/90 bg-rose-950/15 border border-rose-900/30 p-3 rounded-lg">
                                  {log.error_message}
                                </p>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-[10px] text-zinc-500">
                              <span>Log ID: {log.log_id}</span>
                              <span>User ID: {log.user_id}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default LogViewer;
