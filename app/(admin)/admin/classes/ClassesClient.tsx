'use client';

import { useMemo, useState } from 'react';
import { addClass, deleteClass, addStudent, deleteStudent } from './actions';
import { Student } from '@/lib/types';

// Extend ClassInfo for UI
interface UIClassInfo {
  id: string;
  name: string;
  teacher_id: string | null;
  teacher?: { id: string; full_name: string; } | null;
}

export default function ClassesClient({ 
  initialClasses, 
  allStudents 
}: { 
  initialClasses: UIClassInfo[], 
  allStudents: Student[] 
}) {
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const studentsByClass = useMemo(() => {
    const result = new Map<string, Student[]>();
    for (const student of allStudents) {
      const students = result.get(student.class_id) || [];
      students.push(student);
      result.set(student.class_id, students);
    }
    return result;
  }, [allStudents]);

  const toggleClass = (id: string) => {
    setExpandedClassId(prev => prev === id ? null : id);
  };

  return (
    <>
      <div style={{marginBottom: '24px'}}>
        <button onClick={() => setIsAddClassModalOpen(true)} className="admin-btn admin-btn-primary">
          Добавить класс
        </button>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        {initialClasses.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">Нет классов</div>
          </div>
        ) : (
          initialClasses.map(cls => {
            const classStudents = studentsByClass.get(cls.id) || [];
            const isExpanded = expandedClassId === cls.id;
            
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
                      {cls.teacher ? `Кл. рук: ${cls.teacher.full_name}` : 'Нет кл. руководителя'} 
                      {' • '} {classStudents.length} учеников
                    </span>
                  </div>
                  <div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClass(cls.id);
                      }} 
                      className="admin-btn admin-btn-danger"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{borderTop: '1px solid var(--divider)', paddingTop: '16px'}}>
                    <form 
                      action={async (formData) => {
                        await addStudent(formData);
                        (document.getElementById(`add-student-form-${cls.id}`) as HTMLFormElement)?.reset();
                      }}
                      id={`add-student-form-${cls.id}`}
                      style={{display: 'flex', gap: '8px', marginBottom: '16px'}}
                    >
                      <input type="hidden" name="class_id" value={cls.id} />
                      <input 
                        type="text" 
                        name="full_name" 
                        placeholder="Имя ученика" 
                        required 
                        className="admin-input"
                      />
                      <button type="submit" className="admin-btn admin-btn-primary">
                        Добавить
                      </button>
                    </form>

                    {classStudents.length > 0 ? (
                      <table className="admin-table">
                        <tbody>
                          {classStudents.map(student => (
                            <tr key={student.id}>
                              <td>{student.full_name}</td>
                              <td style={{textAlign: 'right', width: '100px'}}>
                                <button 
                                  onClick={() => deleteStudent(student.id)} 
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
                    ) : (
                      <div className="admin-empty" style={{padding: '24px'}}>Нет учеников</div>
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
            <h3 className="admin-modal-title">Новый класс</h3>
            <form action={async (formData) => {
              await addClass(formData);
              setIsAddClassModalOpen(false);
            }}>
              <div className="admin-form-group">
                <label>Название класса</label>
                <input type="text" name="name" required className="admin-input" placeholder="Например: 10 А" />
              </div>
              <div className="admin-modal-actions">
                <button type="button" onClick={() => setIsAddClassModalOpen(false)} className="admin-btn admin-btn-secondary">
                  Отмена
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
