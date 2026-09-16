'use client';

import { useState } from 'react';
import { assignTeacherToClass, approveUserRequest, rejectUserRequest } from './actions';
import type { Profile, ClassInfo } from '@/lib/types';

export default function TeachersClient({ 
  pendingUsers,
  activeUsers, 
  classes 
}: { 
  pendingUsers: Profile[];
  activeUsers: Profile[];
  classes: ClassInfo[]; 
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const getTeacherClasses = (teacherId: string) => {
    return classes.filter(c => c.teacher_id === teacherId);
  };

  const handleApprove = async (userId: string, role: 'ADMIN' | 'TEACHER') => {
    setLoadingId(userId);
    try {
      await approveUserRequest(userId, role);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setLoadingId(userId);
    try {
      await rejectUserRequest(userId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. REGISTRATION REQUESTS */}
      <div className="admin-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            ⏳ Заявки на регистрацию ({pendingUsers.length})
          </h2>
          {pendingUsers.length > 0 && (
            <span style={{ fontSize: '12px', background: 'rgba(255,159,10,0.14)', color: '#FF9F0A', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Требует внимания
            </span>
          )}
        </div>

        {pendingUsers.length === 0 ? (
          <div className="admin-empty" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)' }}>
            Новых заявок на регистрацию нет
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Дата подачи</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.full_name}</td>
                  <td>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="admin-btn admin-btn-primary"
                        onClick={() => handleApprove(user.id, 'TEACHER')}
                        disabled={loadingId === user.id}
                        style={{ background: '#30D158' }}
                      >
                        Одобрить (Учитель)
                      </button>
                      <button
                        className="admin-btn admin-btn-primary"
                        onClick={() => handleApprove(user.id, 'ADMIN')}
                        disabled={loadingId === user.id}
                        style={{ background: '#0071E3' }}
                      >
                        Одобрить (Админ)
                      </button>
                      <button
                        className="admin-btn admin-btn-danger"
                        onClick={() => handleReject(user.id)}
                        disabled={loadingId === user.id}
                      >
                        Отклонить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 2. ACTIVE USERS */}
      <div className="admin-card">
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>
          👥 Подтверждённые пользователи ({activeUsers.length})
        </h2>

        {activeUsers.length === 0 ? (
          <div className="admin-empty">Нет зарегистрированных пользователей</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Роль</th>
                <th>Назначенные классы</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map(user => {
                const userClasses = getTeacherClasses(user.id);
                
                return (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500 }}>{user.full_name}</td>
                    <td>
                      <span className={`admin-badge ${user.role === 'ADMIN' ? 'role-admin' : 'role-teacher'}`}>
                        {user.role === 'ADMIN' ? 'АДМИНИСТРАТОР' : 'УЧИТЕЛЬ'}
                      </span>
                    </td>
                    <td>
                      {userClasses.length > 0 
                        ? userClasses.map(c => c.name).join(', ')
                        : <span style={{ color: 'var(--text-3)' }}>Нет классов</span>
                      }
                    </td>
                    <td>
                      <form action={async (formData) => {
                        const classId = formData.get('class_id') as string;
                        if (classId) {
                          await assignTeacherToClass(user.id, classId);
                        }
                      }} style={{ display: 'flex', gap: '8px' }}>
                        <select name="class_id" className="admin-select" style={{ width: 'auto' }}>
                          <option value="">Привязать класс...</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button type="submit" className="admin-btn admin-btn-secondary">
                          Привязать
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
