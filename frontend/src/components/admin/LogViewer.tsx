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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Execution Logs</h3>
          <p className="text-xs text-muted-foreground font-medium">Monitor natural language query translations and statement performance metrics.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex bg-muted rounded-lg p-0.5 border border-border scale-95">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${filter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${filter === 'success' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Success
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${filter === 'failed' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Failed
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading} className="border-border">
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Retrieving system execution logs...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-muted-foreground w-[10px]"></TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Natural Language Prompt</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Duration (ms)</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground text-xs italic py-8">
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
                      className="border-border/60 hover:bg-muted/10 cursor-pointer"
                    >
                      <TableCell className="py-3">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-foreground font-semibold max-w-sm truncate">
                        {log.query_text}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{log.execution_duration_ms !== null ? `${log.execution_duration_ms}ms` : '0ms'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center text-success text-xs font-semibold">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-danger text-xs font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground text-right font-mono">
                        {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/20 border-none">
                        <TableCell colSpan={5} className="p-4 pt-1">
                          <div className="space-y-3 bg-card border border-border rounded-lg p-4 shadow-sm">
                            {log.executed_sql && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center space-x-1">
                                  <Terminal className="h-3 w-3" />
                                  <span>Compiled SQL Statement</span>
                                </span>
                                <pre className="p-3 bg-background rounded-lg text-xs font-mono text-foreground border border-border overflow-x-auto leading-normal">
                                  <code>{log.executed_sql}</code>
                                </pre>
                              </div>
                            )}
                            {log.error_message && (
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-danger tracking-wider">Error Details</span>
                                <p className="text-xs font-mono text-danger bg-danger/10 border border-danger/20 p-3 rounded-lg leading-relaxed">
                                  {log.error_message}
                                </p>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
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
