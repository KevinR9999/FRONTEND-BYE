// src/pages/Admin/UsersPage.tsx
import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  MoreVertical,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { getUsers, toggleUserActive, setUserRole, deleteUsers } from '../../services/adminService';
import type { UserProfile, Level } from '../../types/admin';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-teal-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];

function getAvatarColor(name: string | null, email: string) {
  const str = (name || email || '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

function UserAvatar({ user, size = 'sm' }: { user: UserProfile; size?: 'sm' | 'md' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === 'md' ? 'w-10 h-10' : 'w-9 h-9';
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  if (user.avatar_url && !imgError) {
    return (
      <img
        src={user.avatar_url}
        alt={user.full_name || 'Avatar'}
        className={`${sizeClass} rounded-full object-cover`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    );
  }

  const bgColor = getAvatarColor(user.full_name, user.email);

  return (
    <div className={`${sizeClass} rounded-full ${bgColor} flex items-center justify-center text-white ${textSize} font-medium`}>
      {getInitials(user.full_name, user.email)}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Selección múltiple
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, search, levelFilter]);

  const loadUsers = async () => {
    try {
      console.log('🔄 Loading users...');
      const data = await getUsers();
      console.log('✅ Users loaded:', data);
      setUsers(data);
    } catch (error) {
      console.error('❌ Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let result = [...users];

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.level?.toLowerCase().includes(searchLower)
      );
    }

    if (levelFilter !== 'all') {
      result = result.filter((u) => u.level === levelFilter);
    }

    setFilteredUsers(result);
    setPage(1);
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await toggleUserActive(user.user_id, !user.is_active);
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user.user_id ? { ...u, is_active: !u.is_active } : u
        )
      );
    } catch (error) {
      console.error('Error toggling user:', error);
      alert('Error al cambiar el estado del usuario');
    }
    setActiveMenu(null);
  };

  const handleToggleAdmin = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'student' : 'admin';
    try {
      await setUserRole(user.user_id, newRole);
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user.user_id ? { ...u, role: newRole } : u
        )
      );
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Error al cambiar el rol del usuario');
    }
    setActiveMenu(null);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginatedUsers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginatedUsers.map(u => u.user_id)));
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteUsers(confirmDelete);
      setUsers(prev => prev.filter(u => !confirmDelete.includes(u.user_id)));
      setSelected(new Set());
      setConfirmDelete(null);
    } catch (e: any) {
      console.error('Error eliminando usuarios:', e);
      const msg = e?.message ?? String(e);
      alert(msg.includes('RLS_BLOCK')
        ? 'Sin permisos para eliminar usuarios. Debes agregar una política RLS DELETE en la tabla profiles para el rol admin.'
        : `Error al eliminar: ${msg}`
      );
    } finally {
      setDeleting(false);
    }
  };

  const paginatedUsers = filteredUsers.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filteredUsers.length / perPage);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const getLevelColor = (level: Level | null) => {
    switch (level) {
      case 'A1': return 'bg-green-100 text-green-700';
      case 'A2': return 'bg-blue-100 text-blue-700';
      case 'B1': return 'bg-yellow-100 text-yellow-700';
      case 'B2': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <AdminLayout title="Usuarios" subtitle={`Total: ${users.length} usuarios registrados`}>
      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o nivel (A1, B2…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
            />
          </div>
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as Level | 'all')}
              className="pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm appearance-none bg-white min-w-[140px]"
            >
              <option value="all">Todos los niveles</option>
              <option value="A1">A1 - Básico</option>
              <option value="A2">A2 - Básico+</option>
              <option value="B1">B1 - Intermedio</option>
              <option value="B2">B2 - Intermedio+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra de selección múltiple */}
      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm font-medium text-red-700">
            {selected.size} usuario{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => setConfirmDelete(Array.from(selected))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Eliminar {selected.size > 1 ? `${selected.size} usuarios` : 'usuario'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmDelete && (() => {
        const toDelete = users.filter(u => confirmDelete.includes(u.user_id));
        const single = toDelete.length === 1 ? toDelete[0] : null;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {single
                    ? `¿Eliminar a ${single.full_name || single.email?.split('@')[0] || 'este usuario'}?`
                    : `¿Eliminar ${confirmDelete.length} usuarios?`}
                </h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>

            {single ? (
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 mb-5">
                <UserAvatar user={single} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{single.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-slate-500 truncate">{single.email}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl px-4 py-3 mb-5 space-y-1.5 max-h-36 overflow-y-auto">
                {toDelete.map(u => (
                  <div key={u.user_id} className="flex items-center gap-2">
                    <UserAvatar user={u} size="sm" />
                    <p className="text-sm text-slate-700 truncate">{u.full_name || u.email}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500 mb-5">
              Se eliminarán todos los datos asociados: resultados diagnósticos y progreso.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-2 px-4 w-20">
                      <label className="flex flex-col items-center gap-1 cursor-pointer select-none group">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide group-hover:text-slate-600 transition-colors">
                          Todos
                        </span>
                        <input
                          type="checkbox"
                          checked={paginatedUsers.length > 0 && selected.size === paginatedUsers.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 accent-slate-700 cursor-pointer"
                        />
                      </label>
                    </th>
                    <th className="text-left py-3 pl-14 pr-4 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Nivel</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">XP</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Racha</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Última conexión</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Rol</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.user_id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${selected.has(user.user_id) ? 'bg-red-50/40' : ''}`}>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(user.user_id)}
                          onChange={() => toggleSelect(user.user_id)}
                          className="w-4 h-4 rounded border-slate-300 accent-slate-700 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {user.full_name || user.email?.split('@')[0] || 'Sin nombre'}
                            </p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${getLevelColor(user.level)}`}>
                          {user.level || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-700">{user.xp_total?.toLocaleString() || 0}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-700">🔥 {user.streak_days || 0}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-500">{formatDate(user.last_seen)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : 'Estudiante'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === user.user_id ? null : user.user_id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg"
                          >
                            <MoreVertical size={18} className="text-slate-400" />
                          </button>
                          {activeMenu === user.user_id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 min-w-[180px]">
                              <button
                                onClick={() => handleToggleActive(user)}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 flex items-center gap-3 text-slate-700"
                              >
                                {user.is_active ? (
                                  <>
                                    <UserX size={18} className="text-red-500" />
                                    <span className="font-medium">Desactivar usuario</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck size={18} className="text-green-500" />
                                    <span className="font-medium">Activar usuario</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleToggleAdmin(user)}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 flex items-center gap-3 text-slate-700"
                              >
                                {user.role === 'admin' ? (
                                  <>
                                    <ShieldOff size={18} className="text-orange-500" />
                                    <span className="font-medium">Quitar Admin</span>
                                  </>
                                ) : (
                                  <>
                                    <Shield size={18} className="text-blue-500" />
                                    <span className="font-medium">Hacer Admin</span>
                                  </>
                                )}
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                onClick={() => { setActiveMenu(null); setConfirmDelete([user.user_id]); }}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-3 text-red-600"
                              >
                                <Trash2 size={18} />
                                <span className="font-medium">Eliminar usuario</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={`p-4 transition-colors ${selected.has(user.user_id) ? 'bg-red-50/50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-1 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selected.has(user.user_id)}
                        onChange={() => toggleSelect(user.user_id)}
                        className="w-4 h-4 rounded border-slate-300 accent-slate-700 cursor-pointer"
                      />
                    </div>

                    {/* Avatar + nombre */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar user={user} size="md" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {user.full_name || 'Sin nombre'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                        </div>
                        {/* Menú tres puntos */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => setActiveMenu(activeMenu === user.user_id ? null : user.user_id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg"
                          >
                            <MoreVertical size={18} className="text-slate-400" />
                          </button>
                          {activeMenu === user.user_id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 min-w-[180px]">
                              <button
                                onClick={() => handleToggleActive(user)}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 flex items-center gap-3 text-slate-700"
                              >
                                {user.is_active ? (
                                  <><UserX size={18} className="text-red-500" /><span className="font-medium">Desactivar</span></>
                                ) : (
                                  <><UserCheck size={18} className="text-green-500" /><span className="font-medium">Activar</span></>
                                )}
                              </button>
                              <button
                                onClick={() => handleToggleAdmin(user)}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 flex items-center gap-3 text-slate-700"
                              >
                                {user.role === 'admin' ? (
                                  <><ShieldOff size={18} className="text-orange-500" /><span className="font-medium">Quitar Admin</span></>
                                ) : (
                                  <><Shield size={18} className="text-blue-500" /><span className="font-medium">Hacer Admin</span></>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tags info */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${getLevelColor(user.level)}`}>
                          {user.level || 'Sin nivel'}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                          {user.xp_total?.toLocaleString() || 0} XP
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-600">
                          🔥 {user.streak_days || 0}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        {user.role === 'admin' && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Última conexión: {formatDate(user.last_seen)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Mostrando {(page - 1) * perPage + 1} - {Math.min(page * perPage, filteredUsers.length)} de {filteredUsers.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} className="text-slate-600" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm ${
                        page === p
                          ? 'bg-slate-800 text-white'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} className="text-slate-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredUsers.length === 0 && !loading && (
              <div className="py-12 text-center">
                <p className="text-slate-500">No se encontraron usuarios</p>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
