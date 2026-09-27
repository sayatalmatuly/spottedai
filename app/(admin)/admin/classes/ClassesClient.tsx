'use client';

import { useMemo, useState, useCallback } from 'react';
import { addClass, deleteClass, addStudent, deleteStudent } from './actions';
import { createClient } from '@/lib/supabase/client';
import type { Student } from '@/lib/types';
import { translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';

interface UIClassInfo {
  id: string;
  name: string;
  teacher_id: string | null;
  student_count?: number;
  teacher?: { id: string; full_name: string; } | null;
}

export default function ClassesClient({ 
  initialClasses,
}: { 
  initialClasses: UIClassInfo[];
}) {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
  const supabase = useMemo(() => createClient(), []);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [studentsByClass, setStudentsByClass] = useState<Map<string, Student[]>>(new Map());
  const [loadingClassId, setLoadingClassId] = useState<string | null>(null);

  const loadStudentsForClass = useCallback(async (classId: string) => {
    setLoadingClassId(classId);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, class_id')
      .eq('class_id', classId)
      .order('full_name');
    setStudentsByClass(prev => new Map(prev).set(classId, data || []));
    setLoadingClassId(null);
  }, [supabase]);

  const toggleClass = (id: string) => {
    if (expandedClassId === id) {
      setExpandedClassId(null);
      return;
    }
    setExpandedClassId(id);
    if (!studentsByClass.has(id)) loadStudentsForClass(id);
  };

  return (
    <>
      <div style={{marginBottom: '24px'}}>
        <button onClick={() => setIsAddClassModalOpen(true)} className="admin-btn admin-btn-primary">
          {t('Сынып қосу', 'Add class')}
        </button>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        {initialClasses.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">{t('Сыныптар жоқ', 'No classes yet')}</div>
          </div>
        ) : (
          initialClasses.map(cls => {
            const classStudents = studentsByClass.get(cls.id) || [];
            const isExpanded = expandedClassId === cls.id;
            const isLoading = loadingClassId === cls.id;
            const displayCount = studentsByClass.has(cls.id) ? classStudents.length : (cls.student_count ?? 0);
            
            return (
              <div key={cls.id} className="admin-card" style={{marginBottom: 0}}>
                <div 
                  className="admin-card-header" 
                  style={{cursor: 'pointer', marginBottom: isExpanded ? '16px' : '0'}}
                  onClick={() => toggleClass(cls.id)}
                >
                  <div>
                    <h3 className="admin-card-title">{cls.name}</h3>
                    <span style={{fontSize: '13px', color: 'var(--text-2)'}}>
                      {cls.teacher ? `${t('Сынып жетекшісі', 'Class teacher')}: ${cls.teacher.full_name}` : t('Сынып жетекшісі тағайындалмаған', 'No class teacher assigned')}
                      {' • '} {displayCount} {t('оқушы', 'students')}
                    </span>
                  </div>
                  <div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm(
                          t(
                            `«${cls.name}» сыныбын жою — барлық оқушылар мен қатысу тарихы да жойылады. Жалғастыру керек пе?`,
                            `Delete "${cls.name}"? This also permanently deletes all its students and attendance history.`
                          )
                        )) return;
                        deleteClass(cls.id);
                      }} 
                      className="admin-btn admin-btn-danger"
                    >
                      {t('Жою', 'Delete')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{borderTop: '1px solid var(--divider)', paddingTop: '16px'}}>
                    <form 
                      action={async (formData) => {
                        await addStudent(formData);
                        await loadStudentsForClass(cls.id);
                        (document.getElementById(`add-student-form-${cls.id}`) as HTMLFormElement)?.reset();
                      }}
                      id={`add-student-form-${cls.id}`}
                      style={{display: 'flex', gap: '8px', marginBottom: '16px'}}
                    >
                      <input type="hidden" name="class_id" value={cls.id} />
                      <input 
                        type="text" 
                        name="full_name" 
                        placeholder={t('Оқушының аты', 'Student name')}
                        required 
                        className="admin-input"
                      />
                      <button type="submit" className="admin-btn admin-btn-primary">
                        {t('Қосу', 'Add')}
                      </button>
                    </form>

                    {isLoading ? (
                      <div className="admin-empty" style={{padding: '24px', textAlign: 'center'}}>
                        {t('Жүктелуде...', 'Loading...')}
                      </div>
                    ) : classStudents.length > 0 ? (
                      <table className="admin-table">
                        <tbody>
                          {classStudents.map(student => (
                            <tr key={student.id}>
                              <td>{student.full_name}</td>
                              <td style={{textAlign: 'right', width: '100px'}}>
                                <button 
                                  onClick={() => {
                                    if (!window.confirm(
                                      t(
                                        `«${student.full_name}» оқушысын жою — оның қатысу тарихы да жойылады. Жалғастыру керек пе?`,
                                        `Delete "${student.full_name}"? This also permanently deletes their attendance history.`
                                      )
                                    )) return;
                                    deleteStudent(student.id).then(() => loadStudentsForClass(cls.id));
                                  }} 
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
                    ) : (
                      <div className="admin-empty" style={{padding: '24px'}}>{t('Оқушылар жоқ', 'No students yet')}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isAddClassModalOpen && (
        <div className="admin-overlay">
          <div className="admin-modal">
            <h3 className="admin-modal-title">{t('Жаңа сынып', 'New class')}</h3>
            <form action={async (formData) => {
              await addClass(formData);
              setIsAddClassModalOpen(false);
            }}>
              <div className="admin-form-group">
                <label>{t('Сынып атауы', 'Class name')}</label>
                <input type="text" name="name" required className="admin-input" placeholder={t('Мысалы: 10 А', 'For example: 10 A')} />
              </div>
              <div className="admin-modal-actions">
                <button type="button" onClick={() => setIsAddClassModalOpen(false)} className="admin-btn admin-btn-secondary">
                  {t('Бас тарту', 'Cancel')}
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  {t('Құру', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
