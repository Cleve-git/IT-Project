'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

// Dynamically import Plotly with SSR disabled to prevent Node compilation errors
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="h-72 w-full flex items-center justify-center text-muted-foreground">Loading charts library...</div>
});

interface PlotTrace {
  [key: string]: unknown;
  marker?: Record<string, unknown>;
  line?: Record<string, unknown>;
}

interface QueryVisualizerProps {
  config: {
    data?: PlotTrace[];
    layout?: Record<string, unknown> & {
      xaxis?: Record<string, unknown>;
      yaxis?: Record<string, unknown>;
    };
  };
}

interface ChartTheme {
  primary: string;
  grid: string;
  font: string;
}

export const QueryVisualizer: React.FC<QueryVisualizerProps> = ({ config }) => {
  const [theme, setTheme] = useState<ChartTheme>({ primary: '#2563EB', grid: '#1e293b', font: '#94a3b8' });

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      const primary = styles.getPropertyValue('--primary').trim() || '#2563EB';
      const isDark = document.documentElement.classList.contains('dark');
      setTheme({
        primary,
        grid: isDark ? '#1e293b' : '#e2e8f0',
        font: isDark ? '#94a3b8' : '#64748b',
      });
    };
    read();
    // Recolor live when the user toggles light/dark
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  if (!config) return null;

  // Recolor each series to the active theme's primary colour
  const data = (config.data || []).map((trace: PlotTrace) => ({
    ...trace,
    marker: { ...(trace.marker || {}), color: theme.primary },
    line: { ...(trace.line || {}), color: theme.primary },
  }));

  const axisStyle = {
    gridcolor: theme.grid,
    linecolor: theme.grid,
    tickcolor: theme.grid,
    automargin: true,
  };

  const layout = {
    ...config.layout,
    autosize: true,
    font: { color: theme.font, family: 'Inter, sans-serif' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 30, b: 90, l: 55, r: 20 },
    xaxis: { ...config.layout?.xaxis, ...axisStyle, tickangle: -40 },
    yaxis: { ...config.layout?.yaxis, ...axisStyle },
  };

  return (
    <Card className="border-border/60 bg-muted/10 mt-4">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium text-foreground/80">Visualization</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center overflow-hidden">
        <div className="w-full max-w-4xl h-80">
          <Plot
            data={data}
            layout={layout}
            useResizeHandler={true}
            className="w-full h-full"
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default QueryVisualizer;
