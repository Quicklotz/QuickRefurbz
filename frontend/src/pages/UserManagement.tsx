"use client";
import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Edit,
  Send,
  UserX,
  UserCheck,
  Mail,
  Shield,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { SpotlightCard } from '@/components/aceternity/spotlight';
import { Button } from '@/components/aceternity/button';
import { Input } from '@/components/aceternity/input';
import { Label } from '@/components/aceternity/label';
import { AnimatedModal } from '@/components/aceternity/animated-modal';
import { TextGenerateEffect } from '@/components/aceternity/text-generate-effect';
import { Loader } from '@/components/aceternity/loader';
import { useToast } from '@/components/aceternity/toast';
import { ConfirmModal } from '@/components/aceternity/confirm-modal';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/shared/Badge';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'technician';
  is_active: boolean;
  email_verified: boolean;
  invited_at: string | null;
  created_at: string;
}

const ROLE_VARIANTS: Record<string, 'danger' | 'info' | 'success'> = {
  admin: 'danger',
  manager: 'info',
  technician: 'success',
};

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'technician' });
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    user: User | null;
    action: 'activate' | 'deactivate';
  }>({ isOpen: false, user: null, action: 'deactivate' });

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      toast.error('Failed to load users', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    try {
      await api.inviteUser(inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'technician' });
      toast.success('Invite Sent', `Invitation sent to ${inviteForm.email}`);
      loadUsers();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.resendInvite(userId);
      toast.success('Invite Resent', 'The invitation has been resent successfully');
    } catch (err: any) {
      toast.error('Failed to resend invite', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.warning('Action Not Allowed', 'You cannot deactivate your own account');
      return;
    }

    const action = user.is_active ? 'deactivate' : 'activate';
    setConfirmModal({ isOpen: true, user, action });
  };

  const confirmToggleActive = async () => {
    const { user, action } = confirmModal;
    if (!user) return;

    setActionLoading(user.id);
    setConfirmModal({ isOpen: false, user: null, action: 'deactivate' });

    try {
      if (action === 'deactivate') {
        await api.deactivateUser(user.id);
        toast.success('User Deactivated', `${user.name} has been deactivated`);
      } else {
        await api.updateUser(user.id, { is_active: true });
        toast.success('User Activated', `${user.name} has been activated`);
      }
      loadUsers();
    } catch (err: any) {
      toast.error(`Failed to ${action} user`, err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditLoading(true);
    try {
      await api.updateUser(editingUser.id, {
        name: editForm.name,
        role: editForm.role,
      });
      setEditingUser(null);
      toast.success('User Updated', `${editForm.name}'s information has been updated`);
      loadUsers();
    } catch (err: any) {
      toast.error('Failed to update user', err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, role: user.role });
  };

  const getStats = () => {
    const total = users.length;
    const active = users.filter(u => u.is_active && u.email_verified).length;
    const pending = users.filter(u => u.is_active && !u.email_verified).length;
    const admins = users.filter(u => u.role === 'admin').length;
    return { total, active, pending, admins };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size="xl" variant="dots" text="Loading users..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-ql-yellow" />
            User Management
          </h1>
          <TextGenerateEffect
            words="Manage users, roles, and permissions"
            className="text-zinc-400 text-sm"
            duration={0.3}
          />
        </div>
        <Button variant="primary" onClick={() => setShowInviteModal(true)}>
          <Plus size={18} />
          Invite User
        </Button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent-red/10 border border-accent-red text-accent-red p-4 rounded-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <StatCard label="Total Users" value={stats.total} icon={Users} color="yellow" />
        <StatCard label="Active" value={stats.active} icon={UserCheck} color="green" />
        <StatCard label="Pending Invite" value={stats.pending} icon={Mail} color="blue" />
        <StatCard label="Admins" value={stats.admins} icon={Shield} color="red" />
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SpotlightCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`border-b border-border hover:bg-dark-tertiary/50 transition-colors ${
                          !user.is_active ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold text-white">{user.name}</span>
                          {user.id === currentUser?.id && (
                            <span className="text-xs text-zinc-500 ml-2">(you)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={ROLE_VARIANTS[user.role]} size="sm">
                            {user.role.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {!user.is_active ? (
                            <Badge variant="warning" size="sm">Inactive</Badge>
                          ) : !user.email_verified ? (
                            <Badge variant="info" size="sm">Pending</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              disabled={actionLoading === user.id}
                              title="Edit user"
                            >
                              <Edit size={14} />
                            </Button>
                            {!user.email_verified && user.is_active && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleResendInvite(user.id)}
                                disabled={actionLoading === user.id}
                                title="Resend invite"
                              >
                                <Send size={14} />
                              </Button>
                            )}
                            {user.id !== currentUser?.id && (
                              <Button
                                variant={user.is_active ? 'ghost' : 'secondary'}
                                size="sm"
                                onClick={() => handleToggleActive(user)}
                                disabled={actionLoading === user.id}
                                className={user.is_active ? 'text-accent-red hover:bg-accent-red/10' : 'text-accent-green hover:bg-accent-green/10'}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Invite Modal */}
      <AnimatedModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite New User"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <AnimatePresence>
            {inviteError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-accent-red/10 border border-accent-red text-accent-red p-3 rounded-lg text-sm"
              >
                {inviteError}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <Label htmlFor="inviteEmail">Email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="user@example.com"
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="inviteName">Name</Label>
            <Input
              id="inviteName"
              type="text"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              placeholder="Full name"
              required
            />
          </div>

          <div>
            <Label htmlFor="inviteRole">Role</Label>
            <select
              id="inviteRole"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none"
            >
              <option value="technician">Technician</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={inviteLoading}>
              <Send size={16} />
              Send Invite
            </Button>
          </div>
        </form>
      </AnimatedModal>

      {/* Edit Modal */}
      <AnimatedModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
      >
        {editingUser && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editingUser.email}
                disabled
                className="opacity-70"
              />
            </div>

            <div>
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="editRole">Role</Label>
              <select
                id="editRole"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                disabled={editingUser.id === currentUser?.id}
                className="w-full bg-dark-tertiary border border-border rounded-lg px-4 py-2.5 text-white focus:border-ql-yellow focus:outline-none disabled:opacity-70"
              >
                <option value="technician">Technician</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              {editingUser.id === currentUser?.id && (
                <span className="text-xs text-zinc-500 mt-1 block">You cannot change your own role</span>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={editLoading}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </AnimatedModal>

      {/* Confirm Toggle Active Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, user: null, action: 'deactivate' })}
        onConfirm={confirmToggleActive}
        title={confirmModal.action === 'deactivate' ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${confirmModal.action} ${confirmModal.user?.name}? ${
          confirmModal.action === 'deactivate'
            ? 'They will no longer be able to access the system.'
            : 'They will regain access to the system.'
        }`}
        confirmText={confirmModal.action === 'deactivate' ? 'Deactivate' : 'Activate'}
        variant={confirmModal.action === 'deactivate' ? 'danger' : 'info'}
        loading={actionLoading === confirmModal.user?.id}
      />
    </div>
  );
}
