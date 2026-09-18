'use client';

import { useState } from 'react';
import { addScheduleEntry, deleteScheduleEntry } from './actions';
import { translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';

export default function ScheduleClient({ 
  schedule, 
  classes,
  teachers
}: { 
  schedule: any[], 
  classes: any[],
  teachers: any[]
}) {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedClass, setSelectedClass] = useState<string>('');

  const daysOfWeek = [
    { id: 1, name: t('Дүйсенбі', 'Monday') },
    { id: 2, name: t('Сейсенбі', 'Tuesday') },
    { id: 3, name: t('Сәрсенбі', 'Wednesday') },
    { id: 4, name: t('Бейсенбі', 'Thursday') },
    { id: 5, name: t('Жұма', 'Friday') },
    { id: 6, name: t('Сенбі', 'Saturday') },
  ];

  const filteredSchedule = schedule.filter(s => 
    s.day_of_week === selectedDay && 
    (selectedClass ? s.class_id === selectedClass : true)
  );

  return (
    <>
      <div className="admin-card admin-filter-card" style={{display: 'flex', gap: '16px', marginBottom: '24px'}}>
        <div style={{flex: 1}}>
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500}}>{t('Апта күні', 'Day of week')}</label>
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
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500}}>{t('Сынып', 'Class')}</label>
          <select 
            className="admin-select" 
            value={selectedClass} 
            onChange={e => setSelectedClass(e.target.value)}
          >
            <option value="">{t('Барлық сыныптар', 'All classes')}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{display: 'flex', alignItems: 'flex-end'}}>
          <button onClick={() => setIsModalOpen(true)} className="admin-btn admin-btn-primary">
            {t('Сабақ қосу', 'Add lesson')}
          </button>
        </div>
      </div>

      <div className="admin-card">
        {filteredSchedule.length === 0 ? (
          <div className="admin-empty">{t('Сабақтар жоқ', 'No lessons')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('Сабақ', 'Lesson')}</th>
                <th>{t('Сынып', 'Class')}</th>
                <th>{t('Пән', 'Subject')}</th>
                <th>{t('Мұғалім', 'Teacher')}</th>
                <th>{t('Әрекеттер', 'Actions')}</th>
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
                      {t('Жою', 'Delete')}
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
            <h3 className="admin-modal-title">{t('Жаңа сабақ', 'New lesson')}</h3>
            <form action={async (formData) => {
              await addScheduleEntry(formData);
              setIsModalOpen(false);
            }}>
              <div className="admin-form-group">
                <label>{t('Сынып', 'Class')}</label>
                <select name="class_id" required className="admin-select">
                  <option value="">{t('Сыныпты таңдаңыз', 'Select a class')}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>{t('Апта күні', 'Day of week')}</label>
                <select name="day_of_week" required className="admin-select" defaultValue={selectedDay}>
                  {daysOfWeek.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>{t('Сабақ нөмірі (1–8)', 'Lesson number (1–8)')}</label>
                <input type="number" name="lesson_number" min="1" max="8" required className="admin-input" />
              </div>
              <div className="admin-form-group">
                <label>{t('Пән', 'Subject')}</label>
                <input type="text" name="subject" required className="admin-input" placeholder={t('Мысалы: Математика', 'For example: Mathematics')} />
              </div>
              <div className="admin-form-group">
                <label>{t('Мұғалім', 'Teacher')}</label>
                <select name="teacher_id" required className="admin-select">
                  <option value="">{t('Мұғалімді таңдаңыз', 'Select a teacher')}</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              
              <div className="admin-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="admin-btn admin-btn-secondary">
                  {t('Бас тарту', 'Cancel')}
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  {t('Қосу', 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
