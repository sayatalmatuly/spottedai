'use client';

import { useMemo, useState, useCallback, type ChangeEvent } from 'react';
import { addClass, deleteClass, addStudent, deleteStudent, importFirstGradeStudents } from './actions';
import { createClient } from '@/lib/supabase/client';
import type { Student } from '@/lib/types';
import { translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';

interface UIClassInfo {
  id: string;
  name: string;
  teacher_id: string | null;
  academic_year_start?: number;
  student_count?: number;
  teacher?: { id: string; full_name: string; } | null;
}

function parseRosterCsv(contents: string) {
  const delimiter = (contents.split(/\r?\n/, 1)[0].match(/;/g) || []).length
    > (contents.split(/\r?\n/, 1)[0].match(/,/g) || []).length
    ? ';'
    : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < contents.length; index++) {
    const character = contents[index];
    if (character === '"') {
      if (quoted && contents[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && contents[index + 1] === '\n') index++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one student');

  const normalizeHeader = (header: string) => header.replace(/^\uFEFF/, '').toLocaleLowerCase().replace(/[\s_-]/g, '');
  const headers = rows[0].map(normalizeHeader);
  const classIndex = headers.findIndex((header) => ['class', 'classname', 'класс', 'сынып'].includes(header));
  const nameIndex = headers.findIndex((header) => ['fullname', 'studentname', 'name', 'фио', 'атыжөні'].includes(header));
  if (classIndex < 0 || nameIndex < 0) {
    throw new Error('CSV headers must include class and full_name');
  }

  return rows.slice(1).map((values) => ({
    className: values[classIndex] || '',
    fullName: values[nameIndex] || '',
  })).filter((entry) => entry.className || entry.fullName);
}

export default function ClassesClient({ 
  initialClasses,
  archivedClasses,
}: { 
  initialClasses: UIClassInfo[];
  archivedClasses: UIClassInfo[];
}) {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string, russian?: string) => translate(locale, kazakh, english, russian);
  const supabase = useMemo(() => createClient(), []);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [studentsByClass, setStudentsByClass] = useState<Map<string, Student[]>>(new Map());
  const [loadingClassId, setLoadingClassId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRosterUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setImportMessage(null);
    setIsImporting(true);
    try {
      const rows = parseRosterCsv(await file.text());
      if (rows.length > 2000) throw new Error('CSV cannot contain more than 2,000 students');
      const result = await importFirstGradeStudents(rows);
      setImportMessage({
        type: 'success',
        text: t(
          `Қосылды: ${result.inserted}, өткізіп жіберілді: ${result.skipped}.`,
          `Added: ${result.inserted}; skipped: ${result.skipped}.`,
          `Добавлено: ${result.inserted}, пропущено: ${result.skipped}.`
        ),
      });
    } catch (error) {
      console.error(error);
      setImportMessage({
        type: 'error',
        text: t(
          'CSV файлын импорттау мүмкін болмады. Тақырыптары «class» және «full_name» болуы керек.',
          'Could not import the CSV. It must have "class" and "full_name" headers.',
          'Не удалось импортировать CSV. Нужны заголовки «class» и «full_name».'
        ),
      });
    } finally {
      setIsImporting(false);
    }
  };

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
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px'}}>
        <button onClick={() => setIsAddClassModalOpen(true)} className="admin-btn admin-btn-primary">
          {t('Сынып қосу', 'Add class')}
        </button>
        <label className="admin-btn admin-btn-secondary" style={{ opacity: isImporting ? 0.6 : 1 }}>
          {isImporting ? t('Импорт...', 'Importing...') : t('1-сынып тізімін CSV-ден импорттау', 'Import first-grade roster CSV', 'Импорт списка 1-х классов из CSV')}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleRosterUpload}
            disabled={isImporting}
            style={{ display: 'none' }}
          />
        </label>
        {importMessage && (
          <span
            role="status"
            style={{ color: importMessage.type === 'error' ? 'var(--red)' : 'var(--text-2)', fontSize: '13px' }}
          >
            {importMessage.text}
          </span>
        )}
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

      <section className="admin-card" style={{ marginTop: '24px' }}>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => setIsArchiveOpen((open) => !open)}
          aria-expanded={isArchiveOpen}
        >
          {t('Архив сыныптары', 'Archived classes', 'Архив классов')} ({archivedClasses.length})
        </button>
        {isArchiveOpen && (
          archivedClasses.length > 0 ? (
            <table className="admin-table" style={{ marginTop: '16px' }}>
              <thead>
                <tr>
                  <th>{t('Оқу жылы', 'Academic year', 'Учебный год')}</th>
                  <th>{t('Сынып', 'Class', 'Класс')}</th>
                  <th>{t('Сынып жетекшісі', 'Class teacher', 'Классный руководитель')}</th>
                </tr>
              </thead>
              <tbody>
                {archivedClasses.map((classInfo) => (
                  <tr key={classInfo.id}>
                    <td>{classInfo.academic_year_start}–{(classInfo.academic_year_start || 0) + 1}</td>
                    <td>{classInfo.name}</td>
                    <td>{classInfo.teacher?.full_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="admin-empty" style={{ marginTop: '16px' }}>
              {t('Архив бос', 'The archive is empty', 'Архив пуст')}
            </div>
          )
        )}
      </section>

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
