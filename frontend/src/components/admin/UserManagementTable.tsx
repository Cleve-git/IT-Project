'use client';

import React, { useState, useEffect } from 'react';
import { User, Shield, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { Profile } from '../../types';
import api from '../../services/api';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

export const UserManagementTable: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (userId: string, currentRole: 'admin' | 'user') => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change this user's role to ${nextRole}?`)) return;
    
    try {
      await api.updateUserRole(userId, nextRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: nextRole } : u));
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-white">System Profiles</h3>
          <p className="text-xs text-zinc-500">Manage user access policies and platform role allocations.</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchUsers} disabled={loading} className="border-zinc-800">
          Refresh List
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-zinc-500">Loading user registry...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-zinc-400">User Identity</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Email Address</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Date Registered</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400">Role Status</TableHead>
              <TableHead className="text-xs font-semibold text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500 text-xs italic py-8">
                  No users registered in system.
                </TableCell>
              </TableRow>
            ) : (
              users.map((profile) => (
                <TableRow key={profile.id} className="border-zinc-850">
                  <TableCell className="py-3 flex items-center space-x-2 text-xs text-white">
                    <div className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <span className="font-medium">{profile.full_name || 'N/A'}</span>
                  </TableCell>
                  <TableCell className="py-3 text-xs font-mono">
                    <div className="flex items-center space-x-1.5 text-zinc-400">
                      <Mail className="h-3 w-3" />
                      <span>{profile.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-zinc-400 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    {profile.role === 'admin' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                        <Shield className="h-3 w-3 mr-1" />
                        User
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleRole(profile.id, profile.role)}
                      className="text-xs px-2.5 py-1 border-zinc-800 hover:bg-zinc-800"
                    >
                      {profile.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default UserManagementTable;
