'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, Terminal, FileText, Activity } from 'lucide-react';
import { SystemStats } from '../../types';
import api from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

export const AnalyticsCard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await api.getStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load statistics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="h-28 flex items-center justify-center text-xs text-muted-foreground">Recalculating statistics...</div>;
  }

  const items = [
    {
      title: "Total Registered Users",
      value: stats?.total_users ?? 0,
      description: "Unique client profile entries",
      icon: Users,
      color: "text-primary bg-primary/5 border-primary/20"
    },
    {
      title: "Active Data Conversations",
      value: stats?.total_conversations ?? 0,
      description: "Historical analyst chat threads",
      icon: MessageSquare,
      color: "text-primary bg-primary/5 border-primary/20"
    },
    {
      title: "SQL Statements Executed",
      value: stats?.total_queries ?? 0,
      description: "Translated NL database logs",
      icon: Terminal,
      color: "text-primary bg-primary/5 border-primary/20"
    },
    {
      title: "Uploaded Documents",
      value: stats?.total_documents ?? 0,
      description: "Ingested CSV files and PDF articles",
      icon: FileText,
      color: "text-primary bg-primary/5 border-primary/20"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={index} className="hover:border-primary/20 hover:shadow-md transition-all duration-150 ease-out bg-card relative overflow-hidden">
              <CardHeader className="pb-2 p-5">
                <CardTitle className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-bold text-foreground tracking-tight">{item.value}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>
              </CardContent>
              <Icon 
                className="absolute right-2 top-2 h-20 w-20 text-primary pointer-events-none opacity-15"
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
                }}
              />
            </Card>
          );
        })}
      </div>

      {/* Query Accuracy Health Meter */}
      {stats && (
        <Card className="border-primary/15 bg-primary/5 shadow-sm relative overflow-hidden">
          <CardHeader className="p-5 pb-3 flex flex-row items-center space-x-2">
            <CardTitle className="text-sm font-bold text-primary">SQL Compiler Success Rate</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">{stats.query_success_rate}%</div>
              <p className="text-xs text-muted-foreground font-medium">
                Calculated ratio of SQL compiles executing in PostgreSQL without database error exceptions.
              </p>
            </div>
            <div className="w-full sm:w-64 bg-muted h-2.5 rounded-full overflow-hidden border border-border shadow-sm">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${stats.query_success_rate}%` }}
              />
            </div>
          </CardContent>
          <Activity 
            className="absolute right-3 top-3 h-20 w-20 text-primary pointer-events-none opacity-15"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default AnalyticsCard;
