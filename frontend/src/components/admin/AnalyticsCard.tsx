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
    return <div className="h-28 flex items-center justify-center text-xs text-zinc-500">Recalculating statistics...</div>;
  }

  const items = [
    {
      title: "Total Registered Users",
      value: stats?.total_users ?? 0,
      description: "Unique client profile synchronizations",
      icon: Users,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
    },
    {
      title: "Active Data Conversations",
      value: stats?.total_conversations ?? 0,
      description: "Historical multi-turn analyst chats",
      icon: MessageSquare,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/20"
    },
    {
      title: "SQL Statements Executed",
      value: stats?.total_queries ?? 0,
      description: "Translated NL database logs",
      icon: Terminal,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
    },
    {
      title: "Uploaded Documents",
      value: stats?.total_documents ?? 0,
      description: "Ingested CSV files and PDF articles",
      icon: FileText,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={index} className="hover:border-zinc-700/50 hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-xs uppercase font-bold text-zinc-500 tracking-wider">
                  {item.title}
                </CardTitle>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${item.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-bold text-white tracking-tight">{item.value}</div>
                <p className="text-[10px] text-zinc-500 mt-1">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Query Accuracy Health Meter */}
      {stats && (
        <Card className="border-indigo-500/15 bg-indigo-950/5">
          <CardHeader className="p-5 pb-3 flex flex-row items-center space-x-2">
            <Activity className="h-4 w-4 text-indigo-400 animate-pulse" />
            <CardTitle className="text-sm font-semibold text-indigo-300">SQL Compiler Success Rate</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-3xl font-extrabold text-white tracking-tight">{stats.query_success_rate}%</div>
              <p className="text-xs text-zinc-400">
                Calculated ratio of SQL compiles executing in PostgreSQL without error exceptions.
              </p>
            </div>
            <div className="w-full sm:w-64 bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.query_success_rate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsCard;
