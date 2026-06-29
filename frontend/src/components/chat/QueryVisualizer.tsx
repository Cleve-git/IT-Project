'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

// Dynamically import Plotly with SSR disabled to prevent Node compilation errors
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => <div className="h-72 w-full flex items-center justify-center text-zinc-500">Loading charts library...</div>
});

interface QueryVisualizerProps {
  config: Record<string, any>;
}

export const QueryVisualizer: React.FC<QueryVisualizerProps> = ({ config }) => {
  if (!config) return null;

  // Extend config layouts to fit the dark theme styles nicely
  const layout = {
    ...config.layout,
    autosize: true,
    font: { color: '#94a3b8', family: 'Inter, sans-serif' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      ...config.layout?.xaxis,
      gridcolor: '#1e293b',
      linecolor: '#334155',
      tickcolor: '#334155',
    },
    yaxis: {
      ...config.layout?.yaxis,
      gridcolor: '#1e293b',
      linecolor: '#334155',
      tickcolor: '#334155',
    },
  };

  return (
    <Card className="border-indigo-500/20 bg-indigo-950/5 mt-4">
      <CardHeader className="py-4">
        <CardTitle className="text-sm font-medium text-indigo-300">Data Visualization Preview</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center overflow-hidden">
        <div className="w-full max-w-4xl h-80">
          <Plot
            data={config.data || []}
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
