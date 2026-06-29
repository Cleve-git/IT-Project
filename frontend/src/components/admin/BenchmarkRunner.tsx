'use client';

import React, { useState } from 'react';
import { Play, ShieldAlert, CheckCircle, Clock, Zap, Cpu } from 'lucide-react';
import { BenchmarkResult } from '../../types';
import api from '../../services/api';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

export const BenchmarkRunner: React.FC = () => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await api.runBenchmarks();
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Failed to execute benchmark run");
    } finally {
      setRunning(false);
    }
  };

  const totalTests = results.length;
  const correctCount = results.filter(r => r.is_correct).length;
  const accuracy = totalTests > 0 ? Math.round((correctCount / totalTests) * 100) : 0;
  const avgLatency = totalTests > 0 
    ? Math.round(results.reduce((acc, curr) => acc + (curr.execution_time_ms || 0), 0) / totalTests) 
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Compiler Benchmarking</h3>
          <p className="text-xs text-muted-foreground font-medium">Run translation speed and accuracy diagnostics against a test suite of business questions.</p>
        </div>
        <Button 
          onClick={runBenchmark} 
          disabled={running}
          className="flex items-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer px-4"
        >
          {running ? (
            <>
              <Cpu className="h-4 w-4 animate-spin text-primary-foreground" />
              <span>Running Suite...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
              <span>Execute Diagnostics</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Scorecards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-semibold">Accuracy Ratio</span>
              <div className="text-lg font-bold text-foreground mt-0.5">{correctCount} / {totalTests} ({accuracy}%)</div>
            </div>
          </div>

          <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-semibold">Mean Compile Latency</span>
              <div className="text-lg font-bold text-foreground mt-0.5">{avgLatency}ms</div>
            </div>
          </div>

          <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center space-x-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accuracy === 100 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
              {accuracy === 100 ? <CheckCircle className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-semibold">Suite Status</span>
              <div className="text-lg font-bold text-foreground mt-0.5">{accuracy === 100 ? "Healthy / Verified" : "Needs Review"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-muted-foreground">Natural Language Test Case</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Speed (ms)</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Execution Check</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, idx) => (
              <TableRow key={r.benchmark_id || idx} className="border-border/60">
                <TableCell className="py-3 text-xs font-semibold text-foreground">
                  {r.nl_query}
                </TableCell>
                <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                  {r.execution_time_ms}ms
                </TableCell>
                <TableCell className="py-3">
                  {r.is_correct ? (
                    <span className="inline-flex items-center text-success text-xs font-bold">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-danger text-xs font-bold">
                      <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                      Failed
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">
                  {r.is_correct ? (
                    <span className="text-muted-foreground font-mono text-[10px] truncate max-w-[220px] block">
                      {r.generated_sql}
                    </span>
                  ) : (
                    <span className="text-danger font-medium">
                      {r.error_message || 'Compilation empty'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default BenchmarkRunner;
