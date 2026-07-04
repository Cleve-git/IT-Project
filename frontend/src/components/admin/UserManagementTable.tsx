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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => { await fetchUsers(); })();
  }, []);

  const handleToggleRole = async (userId: string, currentRole: 'admin' | 'user') => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change this user's role to ${nextRole}?`)) return;
    
    try {
      await api.updateUserRole(userId, nextRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: nextRole } : u));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-border">
        <div>
          <h3 className="text-base font-bold text-foreground">System Profiles</h3>
          <p className="text-xs text-muted-foreground">Manage user access policies and platform role allocations.</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchUsers} disabled={loading} className="border-border">
          Refresh List
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Loading user registry...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold text-muted-foreground">User Identity</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Email Address</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Date Registered</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Role Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground text-xs italic py-8">
                  No users registered in system.
                </TableCell>
              </TableRow>
            ) : (
              users.map((profile) => (
                <TableRow key={profile.id} className="border-border/60">
                  <TableCell className="py-3 flex items-center space-x-2 text-xs text-foreground">
                    <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-semibold">{profile.full_name || 'N/A'}</span>
                  </TableCell>
                  <TableCell className="py-3 text-xs font-mono">
                    <div className="flex items-center space-x-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{profile.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    {profile.role === 'admin' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/80">
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
                      className="text-xs px-2.5 py-1.5 border-border hover:bg-muted font-semibold"
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
