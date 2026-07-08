'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { QueryLog } from '../../types';
import api, { LogFilters } from '../../services/api';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

// Backend stores UTC without a timezone marker; parse it as UTC so the local time shows correctly.
const fmtTs = (s: string) => {
  if (!s) return '';
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z';
  const d = new Date(iso);
  return d.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filter input states
  const [searchEmail, setSearchEmail] = useState('');
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const currentFilters = useCallback((): LogFilters => ({
    status: status === 'all' ? undefined : status,
    search: search || undefined,
    user: user || undefined,
    start: start || undefined,
    end: end || undefined,
  }), [status, search, user, start, end]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

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

        {/* Filter bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); fetchLogs(); }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search query text" className={`${inputCls} pl-8 w-48`} />
          </div>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="User (email)" className={`${inputCls} w-40`} />
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} title="From date" className={inputCls} />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} title="To date" className={inputCls} />

          <div className="flex bg-muted rounded-lg p-0.5 border border-border">
            {(['all', 'success', 'failed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer transition-all ${status === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button size="sm" type="submit" disabled={loading} className="px-4">Apply</Button>
        </form>
      </div>

      {/* Advanced Filters Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-muted/20 border border-border/80 rounded-xl p-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">User Email</label>
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Query Search</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search prompt or SQL..."
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="md:col-span-4 flex justify-between items-center mt-1 pt-2 border-t border-border/50">
          <div className="flex gap-2">
            <Button size="sm" onClick={fetchLogs} disabled={loading} className="px-4 py-1.5">
              Apply Filters
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleExport('csv')} disabled={loading} className="border-border text-xs flex items-center space-x-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} disabled={loading} className="border-border text-xs flex items-center space-x-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Export PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Retrieving execution logs...</div>
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
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground text-xs italic py-8">
                  No execution logs available for filter choice.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedLogId === log.log_id;
                return (
                  <React.Fragment key={log.log_id}>
                    <TableRow onClick={() => toggleExpand(log.log_id)} className="border-border/60 hover:bg-muted/10 cursor-pointer">
                      <TableCell className="py-3">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-foreground font-semibold max-w-sm truncate">
                        {log.query_text}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{log.execution_duration_ms !== null ? `${log.execution_duration_ms}ms` : '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center text-success text-xs font-semibold"><CheckCircle className="h-3.5 w-3.5 mr-1" />Success</span>
                        ) : (
                          <span className="inline-flex items-center text-danger text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Failed</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground text-right font-mono whitespace-nowrap">{fmtTs(log.created_at)}</TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/20 border-none">
                        <TableCell colSpan={6} className="p-4 pt-1">
                          <div className="space-y-3 bg-card border border-border rounded-lg p-4 shadow-sm">
                            {log.executed_sql && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                                  <Terminal className="h-3 w-3" /><span>Compiled SQL Statement</span>
                                </span>
                                <pre className="p-3 bg-background rounded-lg text-xs font-mono text-foreground border border-border overflow-x-auto leading-normal">
                                  <code>{log.executed_sql}</code>
                                </pre>
                              </div>
                            )}
                            {log.error_message && (
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-danger tracking-wider">Error / Reason</span>
                                <p className="text-xs font-mono text-danger bg-danger/10 border border-danger/20 p-3 rounded-lg leading-relaxed">{log.error_message}</p>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                              <span>Log ID: {log.log_id}</span>
                              <span>{log.user_email || log.user_id}</span>
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
