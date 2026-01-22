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
  Filter
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  getNotifications,
  createNotification,
  deleteNotification,
  markNotificationAsSent
} from '../../services/adminService';
import type { Notification, Level } from '../../types/admin';
import { useAuthStore } from '../../store/authStore';

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General', color: 'bg-blue-100 text-blue-700' },
  { value: 'reminder', label: 'Recordatorio', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'new_content', label: 'Nuevo Contenido', color: 'bg-green-100 text-green-700' },
  { value: 'promo', label: 'Promoción', color: 'bg-purple-100 text-purple-700' },
];

const LEVELS: (Level | 'all')[] = ['all', 'A1', 'A2', 'B1', 'B2'];

type NotificationType = 'general' | 'reminder' | 'new_content' | 'promo';

interface NotificationFormData {
  title: string;
  body: string;
  type: NotificationType;
  target_level: Level | null;
}

const emptyForm: NotificationFormData = {
  title: '',
  body: '',
  type: 'general',
  target_level: null,
};

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<NotificationFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sent' | 'pending'>('all');

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

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'sent') return n.sent_at !== null;
    if (filter === 'pending') return n.sent_at === null;
    return true;
  });

  const openCreateModal = () => {
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      alert('El título y el mensaje son requeridos');
      return;
    }

    setSaving(true);
    try {
      const newNotification = await createNotification({
        title: formData.title,
        body: formData.body,
        type: formData.type,
        target_level: formData.target_level,
        created_by: user?.id || null,
        scheduled_at: null,
      });
      setNotifications((prev) => [newNotification, ...prev]);
      setShowModal(false);
    } catch (error) {
      console.error('Error creating notification:', error);
      alert('Error al crear la notificación');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (notification: Notification) => {
    try {
      await markNotificationAsSent(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, sent_at: new Date().toISOString() } : n
        )
      );
      alert('Notificación enviada correctamente');
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error al enviar la notificación');
    }
  };

  const handleDelete = async (id: string) => {
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

  return (
    <AdminLayout
      title="Notificaciones"
      subtitle={`Total: ${notifications.length} notificaciones`}
    >
      {/* Filters + Add Button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {(['all', 'pending', 'sent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-violet-600 text-white'
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
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          <span>Nueva Notificación</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Bell size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No hay notificaciones</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-violet-600 text-sm font-medium hover:underline"
            >
              Crear primera notificación
            </button>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const typeConfig = getTypeConfig(notification.type);
            return (
              <div
                key={notification.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                    <Bell size={20} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {notification.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      {notification.sent_at ? (
                        <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-medium">
                          Enviada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-700 text-xs font-medium">
                          Pendiente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      {notification.body}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(notification.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {notification.target_level
                          ? `Nivel ${notification.target_level}`
                          : 'Todos los usuarios'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {!notification.sent_at && (
                      <button
                        onClick={() => handleSend(notification)}
                        className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                        title="Enviar ahora"
                      >
                        <Send size={16} className="text-green-500" />
                      </button>
                    )}
                    {deleteConfirm === notification.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <Check size={16} className="text-red-600" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <X size={16} className="text-slate-400" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(notification.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Nueva Notificación
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                  placeholder="Ej: ¡Nueva lección disponible!"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Mensaje *
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm resize-none"
                  placeholder="Escribe el mensaje de la notificación..."
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                >
                  {NOTIFICATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Target Level */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Destinatarios
                </label>
                <select
                  value={formData.target_level || 'all'}
                  onChange={(e) => setFormData({
                    ...formData,
                    target_level: e.target.value === 'all' ? null : e.target.value as Level
                  })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                >
                  <option value="all">Todos los usuarios</option>
                  <option value="A1">Solo nivel A1</option>
                  <option value="A2">Solo nivel A2</option>
                  <option value="B1">Solo nivel B1</option>
                  <option value="B2">Solo nivel B2</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear Notificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
