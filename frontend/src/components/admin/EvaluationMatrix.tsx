'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Play, Cpu, CheckCircle2, XCircle, AlertCircle, TrendingUp, Activity, DollarSign } from 'lucide-react';
import { EvaluationMetrics, TestSuiteResponse } from '../../types';
import api from '../../services/api';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

// Dynamically import Plotly with SSR disabled to prevent Node compilation errors
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="h-72 w-full flex items-center justify-center text-muted-foreground bg-muted/20 border border-border rounded-xl">Loading chart widgets...</div>
});

interface ChartTheme {
  primary: string;
  grid: string;
  font: string;
  paperBg: string;
}

export const EvaluationMatrix: React.FC = () => {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [testSuite, setTestSuite] = useState<TestSuiteResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [runningTestSuite, setRunningTestSuite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<ChartTheme>({
    primary: '#6366f1',
    grid: '#1e293b',
    font: '#94a3b8',
    paperBg: 'rgba(0,0,0,0)'
  });

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    setError(null);
    try {
      const data = await api.getEvaluationMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch evaluation metrics');
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleRunTestSuite = async () => {
    setRunningTestSuite(true);
    setError(null);
    try {
      const data = await api.runTestSuite();
      setTestSuite(data);
      // Refresh metrics after running the test suite, so newly executed queries are counted
      await fetchMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to run test suite execution');
    } finally {
      setRunningTestSuite(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Read Tailwind CSS theme variable values
    const readTheme = () => {
      const styles = getComputedStyle(document.documentElement);
      const primaryRaw = styles.getPropertyValue('--primary').trim() || '#6366f1';
      const isDark = document.documentElement.classList.contains('dark');
      
      // Plotly does not natively support oklch() color syntax.
      // We map the raw oklch values to corresponding hex equivalents.
      let primary = primaryRaw;
      if (primaryRaw.startsWith('oklch')) {
        primary = isDark ? '#f1f5f9' : '#0f172a';
      }

      setTheme({
        primary,
        grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        font: isDark ? '#94a3b8' : '#64748b',
        paperBg: 'rgba(0,0,0,0)'
      });
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Compute token cost: e.g. $0.59 per million input tokens, $0.79 per million output tokens
  const calculateCost = (input: number, output: number) => {
    const cost = (input * 0.59 + output * 0.79) / 1000000;
    return cost.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 });
  };

  // Setup Latency chart data
  const getLatencyChartData = () => {
    if (!metrics || !metrics.recent_logs || metrics.recent_logs.length === 0) return [];
    
    // Sort from newest to oldest
    const sortedLogs = [...metrics.recent_logs];
    const n = sortedLogs.length;
    const xData = sortedLogs.map((log, idx) => {
      const qLabel = `Q${n - idx}`;
      if (!log.created_at) return qLabel;
      const d = new Date(log.created_at);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return `${timeStr} (${qLabel})`;
    });
    const yData = sortedLogs.map(log => log.llm_latency_ms / 1000); // convert to seconds
    
    return [
      {
        x: xData,
        y: yData,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'LLM Response Time',
        line: { color: theme.primary, width: 2.5 },
        marker: { color: theme.primary, size: 6 },
        fill: 'tozeroy',
        fillcolor: `${theme.primary}15`
      }
    ];
  };

  // Compute selected X-axis tick marks to prevent overlapping text (auto-skip)
  const getLatencyTicks = () => {
    if (!metrics || !metrics.recent_logs || metrics.recent_logs.length === 0) return { tickvals: [], ticktext: [] };
    const sortedLogs = [...metrics.recent_logs];
    const n = sortedLogs.length;
    const xData = sortedLogs.map((log, idx) => {
      const qLabel = `Q${n - idx}`;
      if (!log.created_at) return qLabel;
      const d = new Date(log.created_at);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return `${timeStr} (${qLabel})`;
    });

    if (n === 0) return { tickvals: [], ticktext: [] };
    
    // Limit to max 5 ticks
    const maxTicks = 5;
    const tickvals = [];
    
    if (n <= maxTicks) {
      return { tickvals: xData, ticktext: xData };
    }
    
    // Distribute 5 ticks evenly across the items
    for (let i = 0; i < maxTicks; i++) {
      const idx = Math.round((i * (n - 1)) / (maxTicks - 1));
      tickvals.push(xData[idx]);
    }
    
    return { tickvals, ticktext: tickvals };
  };

  // Setup Outcome Distribution chart data
  const getOutcomeChartData = () => {
    if (!metrics) return [];
    
    const labels = ['Valid Data (Success)', 'Empty Dataset', 'Out of Scope Rejections', 'Other Failures'];
    const values = [
      metrics.valid_data_count,
      metrics.empty_dataset_count,
      metrics.out_of_scope_count,
      metrics.failed_other_count
    ];
    
    const isDark = document.documentElement.classList.contains('dark');
    // Use softer colors for dark mode to have clean contrast against dark theme
    const colors = isDark 
      ? ['#34D399', '#FBBF24', '#60A5FA', '#F87171']
      : ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'];
    
    const total = values.reduce((a, b) => a + b, 0);
    const textLabels = values.map(val => {
      // If the value is 0, return an empty string to hide the label and prevent text overlap
      if (val === 0) return '';
      const percentage = total > 0 ? Math.round((val / total) * 100) : 0;
      return `${percentage}% (${val})`;
    });
    
    return [
      {
        values: values,
        labels: labels,
        type: 'pie',
        hole: 0.5,
        marker: { colors: colors },
        text: textLabels,
        textinfo: 'text',
        hoverinfo: 'label+percent+value',
        insidetextorientation: 'radial'
      }
    ];
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Model Status Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 border border-border p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-foreground">Model Performance Evaluation Matrix</h2>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Model Provider: <strong className="text-primary font-semibold">Groq</strong> | Engine: <strong className="text-primary font-semibold">openai/gpt-oss-120b</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchMetrics} 
            disabled={loadingMetrics}
            className="px-4 py-2 border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold rounded-[10px] cursor-pointer"
          >
            {loadingMetrics ? 'Refreshing...' : 'Refresh Metrics'}
          </Button>
          <Button
            onClick={handleRunTestSuite}
            disabled={runningTestSuite}
            className="flex items-center space-x-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer px-4"
          >
            {runningTestSuite ? (
              <>
                <Cpu className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
                <span>Running Test Suite...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" />
                <span>Run Test Suite</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-xl flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Execution Accuracy */}
        <Card className="hover:border-primary/20 hover:shadow-md transition-all bg-card relative overflow-hidden">
          <CardHeader className="pb-2 p-5">
            <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Execution Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics ? `${metrics.data_matching_rate}%` : '---'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Queries returning requested data vs out-of-scope/empty datasets.
            </p>
          </CardContent>
          <Activity 
            className="absolute right-2 top-2 h-20 w-20 text-primary pointer-events-none opacity-15"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
        </Card>

        {/* KPI 2: SQL Syntax Success Rate */}
        <Card className="hover:border-primary/20 hover:shadow-md transition-all bg-card relative overflow-hidden">
          <CardHeader className="pb-2 p-5">
            <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Syntax Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics ? `${metrics.sql_syntax_success_rate}%` : '---'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Percentage of SQL queries executed without database exceptions.
            </p>
          </CardContent>
          <CheckCircle2 
            className="absolute right-2 top-2 h-20 w-20 text-emerald-500 pointer-events-none opacity-15"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
        </Card>

        {/* KPI 3: Average Latency */}
        <Card className="hover:border-primary/20 hover:shadow-md transition-all bg-card relative overflow-hidden">
          <CardHeader className="pb-2 p-5">
            <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Average Latency
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics ? `${metrics.average_latency_seconds}s` : '---'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Mean response generation time of the Groq LLM.
            </p>
          </CardContent>
          <TrendingUp 
            className="absolute right-2 top-2 h-20 w-20 text-blue-500 pointer-events-none opacity-15"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
        </Card>

        {/* KPI 4: Tokens & Cost */}
        <Card className="hover:border-primary/20 hover:shadow-md transition-all bg-card relative overflow-hidden">
          <CardHeader className="pb-2 p-5">
            <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Total API Token Cost
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground truncate" title={metrics ? `${metrics.total_tokens.toLocaleString()} tokens` : ''}>
              {metrics ? calculateCost(metrics.total_input_tokens, metrics.total_output_tokens) : '---'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Usage: {metrics ? (metrics.total_tokens).toLocaleString() : '0'} tokens total.
            </p>
          </CardContent>
          <DollarSign 
            className="absolute right-2 top-2 h-20 w-20 text-amber-500 pointer-events-none opacity-15"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
        </Card>
      </div>

      {/* 3. Charts Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Latency Trends over Time */}
        <Card className="bg-card overflow-hidden">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-foreground">LLM Latency Trends over Time</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 overflow-hidden">
            {metrics && metrics.recent_logs.length > 0 ? (
              <Plot
                data={getLatencyChartData() as any}
                layout={{
                  autosize: true,
                  height: 280,
                  margin: { t: 15, b: 65, l: 45, r: 15 },
                  paper_bgcolor: theme.paperBg,
                  plot_bgcolor: theme.paperBg,
                  xaxis: {
                    showgrid: true,
                    gridcolor: theme.grid,
                    tickfont: { color: theme.font, size: 9 },
                    showticklabels: true,
                    tickangle: -30,
                    tickmode: 'array',
                    tickvals: getLatencyTicks().tickvals,
                    ticktext: getLatencyTicks().ticktext,
                    title: { text: 'Query Timestamp', font: { color: theme.font, size: 10 }, standoff: 15 }
                  },
                  yaxis: {
                    showgrid: true,
                    gridcolor: theme.grid,
                    tickfont: { color: theme.font, size: 10 },
                    title: { text: 'Latency (seconds)', font: { color: theme.font, size: 10 } }
                  }
                }}
                config={{ responsive: true, displayModeBar: false }}
              />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                No logs recorded yet. Submit queries to start tracking latency.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success vs Failure Distribution */}
        <Card className="bg-card overflow-hidden">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Query Execution Outcomes</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 overflow-hidden">
            {metrics && metrics.total_queries > 0 ? (
              <Plot
                data={getOutcomeChartData() as any}
                layout={{
                  autosize: true,
                  height: 280,
                  margin: { t: 15, b: 45, l: 15, r: 15 },
                  paper_bgcolor: theme.paperBg,
                  plot_bgcolor: theme.paperBg,
                  font: { color: theme.font, size: 10 },
                  legend: { 
                    orientation: 'h', 
                    x: 0, 
                    y: -0.22,
                    font: { size: 9.5 }
                  }
                }}
                config={{ responsive: true, displayModeBar: false }}
              />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                No query outcome data recorded.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Test Suite Interactive Dashboard */}
      <Card className="bg-card">
        <CardHeader className="p-5 pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground">Golden Dataset Test Suite (20 cases)</CardTitle>
              <p className="text-xs text-muted-foreground font-medium">
                Runs pre-defined validation questions including out-of-scope prompts to measure drift and safety accuracy.
              </p>
            </div>
            {testSuite && (
              <div className="flex items-center gap-4 bg-muted/40 border border-border/80 px-3 py-1.5 rounded-lg text-xs font-mono">
                <span className="text-emerald-500 font-bold">Pass: {testSuite.metrics.passed}</span>
                <span className="text-danger font-bold">Fail: {testSuite.metrics.failed}</span>
                <span className="text-primary font-bold">Accuracy: {testSuite.metrics.accuracy_rate}%</span>
                <span className="text-muted-foreground">Latency: {testSuite.metrics.avg_latency_ms}ms</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {testSuite ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-1/3 text-xs font-bold text-foreground pl-5 py-3">Prompt Question</TableHead>
                    <TableHead className="text-xs font-bold text-foreground py-3">Category</TableHead>
                    <TableHead className="w-1/4 text-xs font-bold text-foreground py-3">Expected Output</TableHead>
                    <TableHead className="w-1/4 text-xs font-bold text-foreground py-3">Model Generated Output</TableHead>
                    <TableHead className="text-xs font-bold text-foreground py-3">Latency</TableHead>
                    <TableHead className="text-xs font-bold text-foreground pr-5 py-3 text-right">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testSuite.test_results.map((result, idx) => {
                    const isPass = result.status === 'Pass';
                    return (
                      <TableRow key={idx} className="border-b border-border/40 hover:bg-muted/10">
                        <TableCell className="pl-5 py-3 text-xs font-medium text-foreground">
                          {result.nl_query}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="px-2 py-0.5 text-[10px] rounded bg-muted font-mono text-muted-foreground">
                            {result.category}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <pre className="text-[10px] font-mono whitespace-pre-wrap max-w-xs break-all bg-muted/40 p-2 rounded text-muted-foreground">
                            {result.expected_output}
                          </pre>
                        </TableCell>
                        <TableCell className="py-3">
                          {result.error_message && !isPass ? (
                            <div className="space-y-1">
                              {result.model_output && (
                                <pre className="text-[10px] font-mono whitespace-pre-wrap max-w-xs break-all bg-danger/5 border border-danger/10 p-2 rounded text-danger/80">
                                  {result.model_output}
                                </pre>
                              )}
                              <span className="text-[9px] text-danger/90 block italic">
                                {result.error_message}
                              </span>
                            </div>
                          ) : (
                            <pre className="text-[10px] font-mono whitespace-pre-wrap max-w-xs break-all bg-emerald-500/5 border border-emerald-500/10 p-2 rounded text-emerald-600 dark:text-emerald-400">
                              {result.model_output || 'Out of Scope Rejection'}
                            </pre>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                          {result.latency_ms}ms
                        </TableCell>
                        <TableCell className="pr-5 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold leading-none ${
                            isPass 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : 'bg-danger/10 text-danger'
                          }`}>
                            {isPass ? (
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 shrink-0" />
                            )}
                            {result.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3">
              <Activity className="h-8 w-8 text-muted-foreground/60 mx-auto animate-pulse" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">No test run available</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Click "Run Test Suite" to execute validation benchmarks against Groq and calculate accuracy drifts.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
};

export default EvaluationMatrix;
