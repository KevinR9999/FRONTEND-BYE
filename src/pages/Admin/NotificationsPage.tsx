// src/pages/Admin/NotificationsPage.tsx
import { useEffect, useState } from 'react';
import {
  Plus,
  Send,
  Trash2,
  Check,
  X,
  Bell,
  Users,
  Clock,
  Search,
  UserCheck,
  Layers,
  CalendarClock,
  Zap,
  FileText,
  Pencil,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  getNotifications,
  getUsers,
  createNotification,
  updateNotification,
  getNotificationRecipients,
  deleteNotification,
  markNotificationAsSent,
} from '../../services/adminService';
import type { Notification, UserProfile, Level } from '../../types/admin';
import { useAuthStore } from '../../store/authStore';

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', activeBg: 'bg-blue-600', dot: 'bg-blue-500' },
  { value: 'reminder', label: 'Recordatorio', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', activeBg: 'bg-amber-500', dot: 'bg-amber-500' },
  { value: 'new_content', label: 'Nuevo contenido', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', activeBg: 'bg-emerald-600', dot: 'bg-emerald-500' },
  { value: 'promo', label: 'Promoción', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', activeBg: 'bg-purple-600', dot: 'bg-purple-500' },
];

type NotificationType = 'general' | 'reminder' | 'new_content' | 'promo';
type TargetMode = 'all' | 'level' | 'users';
type SendMode = 'now' | 'scheduled' | 'draft';

interface NotificationFormData {
  title: string;
  body: string;
  type: NotificationType;
  target_mode: TargetMode;
  target_level: Level | null;
  selected_user_ids: string[];
}

const emptyForm: NotificationFormData = {
  title: '',
  body: '',
  type: 'general',
  target_mode: 'all',
  target_level: null,
  selected_user_ids: [],
};

const TARGET_MODES: { value: TargetMode; label: string; icon: typeof Users }[] = [
  { value: 'all', label: 'Todos', icon: Users },
  { value: 'level', label: 'Por nivel', icon: Layers },
  { value: 'users', label: 'Específicos', icon: UserCheck },
];

function getLevelColor(level: string | null) {
  switch (level) {
    case 'A1': return 'bg-emerald-100 text-emerald-700';
    case 'A2': return 'bg-blue-100 text-blue-700';
    case 'B1': return 'bg-amber-100 text-amber-700';
    case 'B2': return 'bg-rose-100 text-rose-700';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];

function getAvatarColor(name: string | null, email: string) {
  const str = (name || email || '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<NotificationFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sent' | 'pending'>('all');

  // User selection
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Scheduling
  const [sendMode, setSendMode] = useState<SendMode>('now');
  const [scheduledDate, setScheduledDate] = useState('');

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    if (students.length > 0) return;
    setStudentsLoading(true);
    try {
      const data = await getUsers();
      setStudents(data.filter((u) => u.role !== 'admin'));
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setStudentsLoading(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'sent') return n.sent_at !== null;
    if (filter === 'pending') return n.sent_at === null;
    return true;
  });

  const openCreateModal = async () => {
    setFormData(emptyForm);
    setSendMode('now');
    setScheduledDate('');
    setUserSearch('');
    setEditingId(null);
    setShowModal(true);
    await loadStudents();
  };

  const openEditModal = async (notification: Notification) => {
    // Solo editable si NO está enviada
    if (notification.sent_at) return;

    setEditingId(notification.id);
    setFormData({
      title: notification.title,
      body: notification.body,
      type: notification.type as NotificationType,
      target_mode: (notification.target_mode as TargetMode) || 'all',
      target_level: notification.target_level || null,
      selected_user_ids: [],
    });

    // Determinar sendMode
    if (notification.scheduled_at) {
      setSendMode('scheduled');
      const d = new Date(notification.scheduled_at);
      setScheduledDate(d.toISOString().slice(0, 16));
    } else {
      setSendMode('draft');
    }

    setUserSearch('');
    setShowModal(true);
    await loadStudents();

    // Cargar destinatarios si es tipo 'users'
    if (notification.target_mode === 'users') {
      const recipientIds = await getNotificationRecipients(notification.id);
      setFormData((prev) => ({ ...prev, selected_user_ids: recipientIds }));
    }
  };

  // Recipient count
  const recipientCount = (() => {
    if (formData.target_mode === 'all') return students.length;
    if (formData.target_mode === 'level' && formData.target_level) {
      return students.filter((u) => u.level === formData.target_level).length;
    }
    if (formData.target_mode === 'users') return formData.selected_user_ids.length;
    return 0;
  })();

  // Filtered students for the picker
  const filteredStudents = students.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const toggleUserSelection = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_user_ids: prev.selected_user_ids.includes(userId)
        ? prev.selected_user_ids.filter((id) => id !== userId)
        : [...prev.selected_user_ids, userId],
    }));
  };

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((u) => u.user_id);
    setFormData((prev) => ({
      ...prev,
      selected_user_ids: [...new Set([...prev.selected_user_ids, ...ids])],
    }));
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      alert('El título y el mensaje son requeridos');
      return;
    }
    if (formData.target_mode === 'level' && !formData.target_level) {
      alert('Selecciona un nivel');
      return;
    }
    if (formData.target_mode === 'users' && formData.selected_user_ids.length === 0) {
      alert('Selecciona al menos un usuario');
      return;
    }
    if (sendMode === 'scheduled' && !scheduledDate) {
      alert('Selecciona una fecha y hora para programar');
      return;
    }

    setSaving(true);
    try {
      const notifPayload = {
        title: formData.title,
        body: formData.body,
        type: formData.type,
        target_mode: formData.target_mode,
        target_level: formData.target_mode === 'level' ? formData.target_level : null,
        created_by: user?.id || null,
        scheduled_at: sendMode === 'scheduled' ? new Date(scheduledDate).toISOString() : null,
      };

      if (editingId) {
        // --- MODO EDICIÓN ---
        await updateNotification(
          editingId,
          notifPayload,
          formData.target_mode === 'users' ? formData.selected_user_ids : undefined
        );

        let updatedSentAt: string | null = null;
        if (sendMode === 'now') {
          await markNotificationAsSent(editingId);
          updatedSentAt = new Date().toISOString();
        }

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === editingId
              ? { ...n, ...notifPayload, sent_at: updatedSentAt ?? n.sent_at }
              : n
          )
        );
      } else {
        // --- MODO CREACIÓN ---
        const newNotification = await createNotification(
          notifPayload,
          formData.target_mode === 'users' ? formData.selected_user_ids : undefined
        );

        if (sendMode === 'now') {
          await markNotificationAsSent(newNotification.id);
          newNotification.sent_at = new Date().toISOString();
        }

        setNotifications((prev) => [newNotification, ...prev]);
      }

      setShowModal(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving notification:', error);
      alert('Error al guardar la notificación');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    try {
      await markNotificationAsSent(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, sent_at: new Date().toISOString() } : n
        )
      );
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error al enviar la notificación');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Error al eliminar la notificación');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeConfig = (type: string) => {
    return NOTIFICATION_TYPES.find((t) => t.value === type) || NOTIFICATION_TYPES[0];
  };

  const getTargetLabel = (n: Notification) => {
    if (n.target_mode === 'users') return 'Usuarios seleccionados';
    if (n.target_mode === 'level' && n.target_level) return `Nivel ${n.target_level}`;
    return 'Todos';
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  const sentCount = notifications.filter((n) => n.sent_at).length;
  const pendingCount = notifications.filter((n) => !n.sent_at).length;

  return (
    <AdminLayout
      title="Notificaciones"
      subtitle={`${notifications.length} en total`}
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm">
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">{notifications.length}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm">
          <p className="text-[10px] sm:text-xs text-green-600 font-medium">Enviadas</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 mt-0.5 sm:mt-1">{sentCount}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm">
          <p className="text-[10px] sm:text-xs text-amber-600 font-medium">Pendientes</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-0.5 sm:mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Filters + Add Button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {(['all', 'pending', 'sent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Enviadas'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          <span>Nueva notificación</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Bell size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No hay notificaciones</p>
            <p className="text-sm text-slate-400 mt-1">Crea una para comunicarte con tus estudiantes</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 transition-colors"
            >
              Crear primera notificación
            </button>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const typeConfig = getTypeConfig(notification.type);
            const isSent = !!notification.sent_at;
            const isEditable = !isSent;

            return (
              <div
                key={notification.id}
                onClick={() => isEditable && openEditModal(notification)}
                className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex group transition-all duration-150 ${
                  isEditable
                    ? 'cursor-pointer hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5'
                    : ''
                }`}
              >
                {/* Color accent bar */}
                <div className={`w-1 shrink-0 ${typeConfig.dot}`} />

                <div className="flex-1 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {notification.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                          {typeConfig.label}
                        </span>
                        {isSent ? (
                          <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-[11px] font-medium flex items-center gap-1">
                            <Check size={10} />
                            Enviada
                          </span>
                        ) : notification.scheduled_at ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[11px] font-medium flex items-center gap-1">
                            <CalendarClock size={10} />
                            Programada
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                            Borrador
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600 mb-2 line-clamp-2">{notification.body}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(notification.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {getTargetLabel(notification)}
                        </span>
                        {notification.scheduled_at && !isSent && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <CalendarClock size={12} />
                            {formatDate(notification.scheduled_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Edit hint on hover */}
                      {isEditable && (
                        <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil size={15} className="text-slate-400" />
                        </div>
                      )}
                      {!isSent && (
                        <button
                          onClick={(e) => handleSend(e, notification)}
                          className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                          title="Enviar ahora"
                        >
                          <Send size={16} className="text-green-500" />
                        </button>
                      )}
                      {deleteConfirm === notification.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleDelete(e, notification.id)}
                            className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                          >
                            <Check size={16} className="text-red-600" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <X size={16} className="text-slate-400" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(notification.id); }}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setEditingId(null); } }}
        >
          <div className="bg-white w-full sm:max-w-2xl flex flex-col shadow-2xl rounded-t-2xl sm:rounded-2xl max-h-[95vh] sm:max-h-[92vh]">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingId ? 'Editar notificación' : 'Nueva notificación'}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  {editingId ? 'Modifica los campos y guarda los cambios' : 'Configura y envía a tus estudiantes'}
                </p>
              </div>
              <button
                onClick={() => { setShowModal(false); setEditingId(null); }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none transition-colors"
                  placeholder="Ej: Nueva lección disponible"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mensaje
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none resize-none transition-colors"
                  placeholder="Escribe el contenido de la notificación..."
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo
                </label>
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t.value as NotificationType })}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        formData.type === t.value
                          ? `${t.activeBg} text-white border-transparent shadow-sm`
                          : `${t.bg} ${t.text} ${t.border} hover:opacity-80`
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Destinatarios */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Destinatarios
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {TARGET_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const active = formData.target_mode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            target_mode: mode.value,
                            target_level: null,
                            selected_user_ids: [],
                          })
                        }
                        className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-xs font-medium border transition-all ${
                          active
                            ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={18} />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Level selector */}
                {formData.target_mode === 'level' && (
                  <div className="flex flex-wrap gap-2">
                    {['A1', 'A2', 'B1', 'B2'].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setFormData({ ...formData, target_level: lvl })}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          formData.target_level === lvl
                            ? 'bg-slate-700 text-white shadow-sm'
                            : getLevelColor(lvl) + ' hover:opacity-80'
                        }`}
                      >
                        Nivel {lvl}
                      </button>
                    ))}
                  </div>
                )}

                {/* User picker */}
                {formData.target_mode === 'users' && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o email..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none"
                        />
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto">
                      {studentsLoading ? (
                        <div className="p-8 flex justify-center">
                          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                        </div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">
                          No se encontraron usuarios
                        </div>
                      ) : (
                        filteredStudents.map((u) => {
                          const isSelected = formData.selected_user_ids.includes(u.user_id);
                          return (
                            <label
                              key={u.user_id}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors ${
                                isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleUserSelection(u.user_id)}
                                className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-400"
                              />
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-full ${getAvatarColor(u.full_name, u.email)} flex items-center justify-center text-white text-xs font-medium`}>
                                  {getInitials(u.full_name, u.email)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {u.full_name || u.email.split('@')[0]}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{u.email}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium shrink-0 ${getLevelColor(u.level)}`}>
                                {u.level || '—'}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {formData.selected_user_ids.length} seleccionado{formData.selected_user_ids.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={selectAllFiltered}
                          className="text-xs text-slate-600 font-medium hover:underline"
                        >
                          Seleccionar todos
                        </button>
                        {formData.selected_user_ids.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, selected_user_ids: [] })}
                            className="text-xs text-red-500 font-medium hover:underline"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              {/* Programación */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Envío
                </label>
                <div className="space-y-2">
                  {/* Enviar ahora */}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      sendMode === 'now'
                        ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === 'now'}
                      onChange={() => setSendMode('now')}
                      className="w-4 h-4 text-slate-800 focus:ring-slate-400"
                    />
                    <Zap size={16} className={sendMode === 'now' ? 'text-slate-800' : 'text-slate-400'} />
                    <div>
                      <p className={`text-sm font-medium ${sendMode === 'now' ? 'text-slate-900' : 'text-slate-600'}`}>
                        Enviar ahora
                      </p>
                      <p className="text-[11px] text-slate-400">Se envía de inmediato al guardar</p>
                    </div>
                  </label>

                  {/* Programar */}
                  <div
                    onClick={() => setSendMode('scheduled')}
                    className={`rounded-xl border cursor-pointer transition-all ${
                      sendMode === 'scheduled'
                        ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <input
                        type="radio"
                        name="sendMode"
                        checked={sendMode === 'scheduled'}
                        onChange={() => setSendMode('scheduled')}
                        className="w-4 h-4 mt-0.5 text-slate-800 focus:ring-slate-400"
                      />
                      <CalendarClock size={16} className={`mt-0.5 shrink-0 ${sendMode === 'scheduled' ? 'text-slate-800' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${sendMode === 'scheduled' ? 'text-slate-900' : 'text-slate-600'}`}>
                          Programar envío
                        </p>
                        <p className="text-[11px] text-slate-400">Se enviará en la fecha y hora elegida</p>
                      </div>
                    </div>
                    {sendMode === 'scheduled' && (
                      <div className="px-3 pb-3">
                        <input
                          type="datetime-local"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          min={getMinDateTime()}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Guardar borrador */}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      sendMode === 'draft'
                        ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === 'draft'}
                      onChange={() => setSendMode('draft')}
                      className="w-4 h-4 text-slate-800 focus:ring-slate-400"
                    />
                    <FileText size={16} className={sendMode === 'draft' ? 'text-slate-800' : 'text-slate-400'} />
                    <div>
                      <p className={`text-sm font-medium ${sendMode === 'draft' ? 'text-slate-900' : 'text-slate-600'}`}>
                        Solo guardar borrador
                      </p>
                      <p className="text-[11px] text-slate-400">Podrás enviarla después manualmente</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview banner */}
              {recipientCount > 0 && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                    <Users size={14} className="text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-600">
                    Se enviará a <span className="font-semibold text-slate-900">{recipientCount}</span> destinatario{recipientCount !== 1 ? 's' : ''}
                    {formData.target_mode === 'level' && formData.target_level && ` de nivel ${formData.target_level}`}
                  </p>
                </div>
              )}

              {/* Spacer para que el datetime picker no se corte */}
              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-end gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => { setShowModal(false); setEditingId(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  sendMode === 'now'
                    ? 'bg-slate-800 hover:bg-slate-900'
                    : sendMode === 'scheduled'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-600 hover:bg-slate-700'
                }`}
              >
                {saving ? (
                  'Guardando...'
                ) : editingId ? (
                  sendMode === 'now' ? (
                    <><Send size={15} /> Guardar y enviar</>
                  ) : sendMode === 'scheduled' ? (
                    <><CalendarClock size={15} /> Guardar y programar</>
                  ) : (
                    <><FileText size={15} /> Guardar cambios</>
                  )
                ) : (
                  sendMode === 'now' ? (
                    <><Send size={15} /> Crear y enviar</>
                  ) : sendMode === 'scheduled' ? (
                    <><CalendarClock size={15} /> Programar</>
                  ) : (
                    <><FileText size={15} /> Guardar borrador</>
                  )
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
