'use client';

import React, { useState } from 'react';
import { Play, ShieldAlert, CheckCircle, Clock, Zap, Cpu, Terminal } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-900 pb-4">
        <div>
          <h3 className="text-base font-bold text-white">Compiler Benchmarking</h3>
          <p className="text-xs text-zinc-500">Run translation speed and accuracy diagnostics against a test suite of business questions.</p>
        </div>
        <Button 
          onClick={runBenchmark} 
          disabled={running}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer px-4"
        >
          {running ? (
            <>
              <Cpu className="h-4 w-4 animate-spin text-white" />
              <span>Running Suite...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 text-white fill-white" />
              <span>Execute Diagnostics</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Scorecards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center space-x-3">
            <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Accuracy Ratio</span>
              <div className="text-lg font-bold text-white mt-0.5">{correctCount} / {totalTests} ({accuracy}%)</div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center space-x-3">
            <div className="h-10 w-10 bg-violet-500/10 text-violet-400 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Mean Compile Latency</span>
              <div className="text-lg font-bold text-white mt-0.5">{avgLatency}ms</div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center space-x-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accuracy === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {accuracy === 100 ? <CheckCircle className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Suite Status</span>
              <div className="text-lg font-bold text-white mt-0.5">{accuracy === 100 ? "Healthy / Verified" : "Needs Review"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-zinc-400">Natural Language Test Case</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Speed (ms)</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Execution Check</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, idx) => (
              <TableRow key={r.benchmark_id || idx} className="border-zinc-850">
                <TableCell className="py-3 text-xs font-medium text-zinc-200">
                  {r.nl_query}
                </TableCell>
                <TableCell className="py-3 text-xs font-mono text-zinc-400">
                  {r.execution_time_ms}ms
                </TableCell>
                <TableCell className="py-3">
                  {r.is_correct ? (
                    <span className="inline-flex items-center text-emerald-400 text-xs font-semibold">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-rose-400 text-xs font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                      Failed
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-xs text-zinc-400">
                  {r.is_correct ? (
                    <span className="text-zinc-500 font-mono text-[10px] truncate max-w-[200px] block">
                      {r.generated_sql}
                    </span>
                  ) : (
                    <span className="text-rose-400/80 font-normal">
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
