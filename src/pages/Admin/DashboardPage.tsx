// src/pages/Admin/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  ClipboardList,
  TrendingUp,
  UserPlus,
  CheckCircle,
  Plus,
  ArrowRight,
  Package
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { getDashboardStats } from '../../services/adminService';
import type { DashboardStats } from '../../types/admin';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Usuarios Registrados',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Usuarios Activos',
      value: stats?.activeUsers || 0,
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Lecciones Creadas',
      value: stats?.totalLessons || 0,
      icon: BookOpen,
      color: 'from-violet-500 to-violet-600',
      bgColor: 'bg-violet-50',
      textColor: 'text-violet-600',
    },
    {
      title: 'Preguntas Diagnósticas',
      value: stats?.totalDiagnosticQuestions || 0,
      icon: ClipboardList,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  ];

  const quickActions = [
    {
      title: 'Lecciones',
      description: 'Crear y gestionar lecciones',
      icon: BookOpen,
      href: '/admin/lessons',
      color: 'bg-violet-100 text-violet-600',
    },
    {
      title: 'Diagnóstico',
      description: 'Gestionar preguntas diagnósticas',
      icon: Plus,
      href: '/admin/diagnostic',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      title: 'Usuarios',
      description: 'Gestionar usuarios',
      icon: Users,
      href: '/admin/users',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Pagos',
      description: 'Ver pagos y suscripciones',
      icon: TrendingUp,
      href: '/admin/payments',
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: 'Planes',
      description: 'Gestionar planes de pago',
      icon: Package,
      href: '/admin/payment-plans',
      color: 'bg-pink-100 text-pink-600',
    },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle="Resumen general del sistema">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{card.title}</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {card.value.toLocaleString()}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${card.bgColor}`}>
                      <Icon size={22} className={card.textColor} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-indigo-100">
                  <UserPlus size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Nuevos esta semana</p>
                  <p className="text-xl font-bold text-slate-900">
                    +{stats?.usersThisWeek || 0}
                  </p>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                  style={{ width: `${Math.min((stats?.usersThisWeek || 0) * 10, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-green-100">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Lecciones completadas</p>
                  <p className="text-xl font-bold text-slate-900">
                    {stats?.lessonCompletions || 0}
                  </p>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  style={{ width: '75%' }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    to={action.href}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3`}>
                      <Icon size={20} />
                    </div>
                    <p className="font-medium text-slate-900 text-sm mb-0.5">
                      {action.title}
                    </p>
                    <p className="text-xs text-slate-500">{action.description}</p>
                    <ArrowRight
                      size={16}
                      className="mt-2 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
