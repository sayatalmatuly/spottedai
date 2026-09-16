'use client';

import { useState } from 'react';
import { addScheduleEntry, deleteScheduleEntry } from './actions';

export default function ScheduleClient({ 
  schedule, 
  classes,
  teachers
}: { 
  schedule: any[], 
  classes: any[],
  teachers: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedClass, setSelectedClass] = useState<string>('');

  const daysOfWeek = [
    { id: 1, name: 'Понедельник' },
    { id: 2, name: 'Вторник' },
    { id: 3, name: 'Среда' },
    { id: 4, name: 'Четверг' },
    { id: 5, name: 'Пятница' },
    { id: 6, name: 'Суббота' },
  ];

  const filteredSchedule = schedule.filter(s => 
    s.day_of_week === selectedDay && 
    (selectedClass ? s.class_id === selectedClass : true)
  );

  return (
    <>
      <div className="admin-card" style={{display: 'flex', gap: '16px', marginBottom: '24px'}}>
        <div style={{flex: 1}}>
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500}}>День недели</label>
          <select 
            className="admin-select" 
            value={selectedDay} 
            onChange={e => setSelectedDay(Number(e.target.value))}
          >
            {daysOfWeek.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div style={{flex: 1}}>
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500}}>Класс</label>
          <select 
            className="admin-select" 
            value={selectedClass} 
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="">Все классы</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{display: 'flex', alignItems: 'flex-end'}}>
          <button onClick={() => setIsModalOpen(true)} className="admin-btn admin-btn-primary">
            Добавить урок
          </button>
        </div>
      </div>

      <div className="admin-card">
        {filteredSchedule.length === 0 ? (
          <div className="admin-empty">Нет уроков</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Урок</th>
                <th>Класс</th>
                <th>Предмет</th>
                <th>Учитель</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.lesson_number}</td>
                  <td>{entry.class?.name}</td>
                  <td>{entry.subject}</td>
                  <td>{entry.teacher?.full_name}</td>
                  <td>
                    <button 
                      onClick={() => deleteScheduleEntry(entry.id)} 
                      className="admin-btn admin-btn-danger"
                      style={{padding: '4px 8px', fontSize: '12px'}}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="admin-overlay">
          <div className="admin-modal">
            <h3 className="admin-modal-title">Новый урок</h3>
            <form action={async (formData) => {
              await addScheduleEntry(formData);
              setIsModalOpen(false);
            }}>
              <div className="admin-form-group">
                <label>Класс</label>
                <select name="class_id" required className="admin-select">
                  <option value="">Выберите класс</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>День недели</label>
                <select name="day_of_week" required className="admin-select" defaultValue={selectedDay}>
                  {daysOfWeek.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>Номер урока (1-8)</label>
                <input type="number" name="lesson_number" min="1" max="8" required className="admin-input" />
              </div>
              <div className="admin-form-group">
                <label>Предмет</label>
                <input type="text" name="subject" required className="admin-input" placeholder="Например: Математика" />
              </div>
              <div className="admin-form-group">
                <label>Учитель</label>
                <select name="teacher_id" required className="admin-select">
                  <option value="">Выберите учителя</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              
              <div className="admin-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="admin-btn admin-btn-secondary">
                  Отмена
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
