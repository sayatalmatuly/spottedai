'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveAttendance } from '@/app/actions';
import type {
  AttendanceInsight,
  AbsenceReason,
  AttendanceStatus,
  ClassBarStat,
  ClassInfo,
  DashboardStats,
  LogEntry,
  StudentWithStatus,
  WeeklyTrend,
} from '@/lib/types';
import './AttendanceDashboard.css';

interface DashboardProps {
  classes: ClassInfo[];
  stats: DashboardStats;
  classBarStats: ClassBarStat[];
  donutStats: { presentPct: number; latePct: number; absentPct: number; total: number };
  weeklyTrend: WeeklyTrend;
  attendanceInsights: AttendanceInsight[];
  recentLogs: LogEntry[];
  teacherName: string;
  teacherInitials: string;
  userRole?: 'ADMIN' | 'TEACHER';
  userEmail?: string;
  overallPct: number;
  presentPct: number;
  latePct: number;
  absentPct: number;
  unmarkedClasses: ClassInfo[];
  markedCount: number;
  today: string;
  heroAttendanceText: string;
}

const LOG_GRADIENTS = [
  'linear-gradient(155deg,#34C8FF,#0071E3)',
  'linear-gradient(155deg,#FF9F0A,#FF453A)',
  'linear-gradient(155deg,#8E5CFF,#0071E3)',
  'linear-gradient(155deg,#30D158,#00B37D)'
];

const ABSENCE_REASON_OPTIONS: { value: AbsenceReason; short: string; label: string }[] = [
  { value: 'sick', short: 'Б', label: 'Болеет' },
  { value: 'excused', short: 'О', label: 'Отпросился' },
  { value: 'valid', short: 'У', label: 'Уважительная причина' },
  { value: 'unexcused', short: 'Н', label: 'Не пришёл' },
];

export default function AttendanceDashboard(props: DashboardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [activeClassId, setActiveClassId] = useState<string>(props.classes.length > 0 ? props.classes[0].id : '');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [students, setStudents] = useState<StudentWithStatus[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [isSavingMarks, setIsSavingMarks] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const activeClass = props.classes.find(c => c.id === activeClassId);

  const handleClassSelect = (classId: string) => {
    setActiveClassId(classId);
    setAiSummary(null);
    setAiError(null);
  };

  useEffect(() => {
    if (!activeClassId && props.classes.length > 0) {
      setActiveClassId(props.classes[0].id);
    }
  }, [props.classes, activeClassId]);

  const loadStudentsForModal = async () => {
    if (!activeClassId) return;
    setIsLoadingStudents(true);
    try {
      const [studentsResult, logsResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, class_id')
          .eq('class_id', activeClassId)
          .order('full_name'),
        supabase
          .from('attendance_logs')
          .select('student_id, status, absence_reason')
          .eq('class_id', activeClassId)
          .eq('date', props.today),
      ]);
      const studentsData = studentsResult.data;
      const logsData = logsResult.data;

      const logsMap = new Map<string, { status: AttendanceStatus; absenceReason: AbsenceReason | null }>();
      if (logsData) {
        logsData.forEach((log) => logsMap.set(log.student_id, {
          status: log.status,
          absenceReason: log.absence_reason as AbsenceReason | null,
        }));
      }

      if (studentsData) {
        const studentsWithStatus = studentsData.map((student) => {
          const mark = logsMap.get(student.id);
          return {
            ...student,
            status: mark?.status || 'present',
            absence_reason: mark?.status === 'absent' ? mark.absenceReason || 'unexcused' : null,
          };
        }) as StudentWithStatus[];
        setStudents(studentsWithStatus);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    loadStudentsForModal();
  };

  const handleGenerateAiSummary = async () => {
    if (!activeClassId) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiSummary(null);

    try {
      const dateFromObj = new Date(props.today);
      dateFromObj.setUTCDate(dateFromObj.getUTCDate() - 29);
      const dateFrom = dateFromObj.toISOString().slice(0, 10);

      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: activeClassId, dateFrom, dateTo: props.today }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || 'Не удалось получить анализ');
        return;
      }

      setAiSummary(data.summary);
    } catch (e) {
      setAiError('Не удалось связаться с сервером');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleStatusChange = (id: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((student) => (
        student.id === id
          ? {
              ...student,
              status,
              absence_reason: status === 'absent' ? student.absence_reason || 'unexcused' : null,
            }
          : student
      ))
    );
  };

  const handleAbsenceReasonChange = (id: string, absenceReason: AbsenceReason) => {
    setStudents((prev) =>
      prev.map((student) => (
        student.id === id ? { ...student, status: 'absent', absence_reason: absenceReason } : student
      ))
    );
  };

  const handleSaveMarks = async () => {
    if (!activeClassId) return;
    setIsSavingMarks(true);
    try {
      const marks = students.map((student) => ({
        studentId: student.id,
        status: student.status,
        absenceReason: student.absence_reason,
      }));
      await saveAttendance(activeClassId, props.today, marks);
      
      setIsModalOpen(false);
      setIsToastVisible(true);
      setTimeout(() => {
        setIsToastVisible(false);
      }, 2400);
      
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('Failed to save attendance');
    } finally {
      setIsSavingMarks(false);
    }
  };

  const formattedDate = new Date(props.today).toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const formatPercentage = (value: number) => (
    Number.isInteger(value) ? String(value) : value.toFixed(1)
  );
  const trendPoints = props.weeklyTrend.points.map((point, index, points) => ({
    ...point,
    x: points.length === 1 ? 150 : 8 + (284 * index) / (points.length - 1),
    y: point.percentage === null ? null : 12 + ((100 - point.percentage) * 0.78),
  }));
  const trendSegments: typeof trendPoints[] = [];
  let currentTrendSegment: typeof trendPoints = [];
  for (const point of trendPoints) {
    if (point.y === null) {
      if (currentTrendSegment.length > 0) trendSegments.push(currentTrendSegment);
      currentTrendSegment = [];
    } else {
      currentTrendSegment.push(point);
    }
  }
  if (currentTrendSegment.length > 0) trendSegments.push(currentTrendSegment);
  const trendChange = props.weeklyTrend.changePp;
  const trendPillText = trendChange === null
    ? 'Нет сравнения'
    : `${trendChange > 0 ? '+' : ''}${formatPercentage(trendChange)} п.п.`;
  const trendPillClass = trendChange === null || trendChange === 0
    ? 'neutral'
    : trendChange < 0 ? 'down' : '';

  return (
    <div className="shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div>
            <h1>Журнал</h1>
            <span>Информационно-технологический школа-лицей №3 им.С.Толыбекова</span>
          </div>
        </div>

        <div className="side-label">Классы</div>
        <ul className="side-list">
          {props.classes.map((item) => (
            <li key={item.id}>
              <div
                className={`side-item ${activeClassId === item.id ? 'active' : ''}`}
                onClick={() => handleClassSelect(item.id)}
              >
                {item.name}
                {props.unmarkedClasses.some(c => c.id === item.id) && <span className="chip" />}
                {item.student_count !== undefined && <span className="num">{item.student_count}</span>}
              </div>
            </li>
          ))}
        </ul>

        <div 
          className="side-teacher" 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}
        >
          <div className="avatar-sm">{props.teacherInitials}</div>
          <div className="who">
            <b>{props.teacherName}</b>
            <span>{props.userRole === 'ADMIN' ? 'Администратор' : 'Учитель'}</span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-3)' }}>
            {isUserMenuOpen ? '▲' : '▼'}
          </div>

          {isUserMenuOpen && (
            <div 
              className="user-popup-menu"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '0',
                right: '0',
                marginBottom: '8px',
                background: '#FFFFFF',
                borderRadius: '14px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                padding: '6px',
                zIndex: 100,
                border: '1px solid rgba(0,0,0,0.08)'
              }}
            >
              <Link
                href="/profile"
                prefetch
                onClick={() => setIsUserMenuOpen(false)}
                className="user-popup-link"
              >
                👤 Личный кабинет
              </Link>

              {props.userRole === 'ADMIN' && (
                <Link
                  href="/admin/teachers"
                  prefetch
                  onClick={() => setIsUserMenuOpen(false)}
                  className="user-popup-link admin"
                >
                  ⚙️ Админ-панель
                </Link>
              )}

              <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />

              <div 
                onClick={handleSignOut}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  color: 'var(--red)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,69,58,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                🚪 Выйти
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <h2>Дашборд</h2>
          <div className="date">{capitalizedDate}</div>
        </div>

        {/* HERO / RINGS */}
        <section className="hero">
          <div className="ring-box">
            <svg viewBox="0 0 190 190">
              <circle cx="95" cy="95" r="82" fill="none" stroke="var(--green-soft)" strokeWidth="13" />
              <circle
                cx="95"
                cy="95"
                r="82"
                fill="none"
                stroke="var(--green)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray="515.2"
                strokeDashoffset={515.2 * (1 - props.presentPct / 100)}
              />
              <circle cx="95" cy="95" r="61" fill="none" stroke="var(--orange-soft)" strokeWidth="13" />
              <circle
                cx="95"
                cy="95"
                r="61"
                fill="none"
                stroke="var(--orange)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray="383.3"
                strokeDashoffset={383.3 * (1 - props.latePct / 100)}
              />
              <circle cx="95" cy="95" r="40" fill="none" stroke="var(--red-soft)" strokeWidth="13" />
              <circle
                cx="95"
                cy="95"
                r="40"
                fill="none"
                stroke="var(--red)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray="251.3"
                strokeDashoffset={251.3 * (1 - props.absentPct / 100)}
              />
            </svg>
            <div className="ring-center">
              <div className="n">{props.overallPct}%</div>
              <div className="l">сегодня</div>
            </div>
          </div>

          <div className="hero-copy">
            <h3>{props.heroAttendanceText}</h3>
            <p>
              {props.stats.total} учеников на учёте · отметки внесены по {props.markedCount} классам из {props.classes.length}. 
              {props.unmarkedClasses.length > 0 && ` Классу ${props.unmarkedClasses.map(c => c.name).join(', ')} ещё нужно отметить сегодняшний день.`}
            </p>
            <div className="ring-legend">
              <div>
                <span className="sw" style={{ background: 'var(--green)' }} />
                Пришли <b>{props.presentPct}%</b>
              </div>
              <div>
                <span className="sw" style={{ background: 'var(--orange)' }} />
                Опоздали <b>{props.latePct}%</b>
              </div>
              <div>
                <span className="sw" style={{ background: 'var(--red)' }} />
                Нет <b>{props.absentPct}%</b>
              </div>
            </div>
          </div>

          <button className="btn-mark" onClick={handleOpenModal}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12l5 5L20 6" />
            </svg>
            Отметить учеников
          </button>
        </section>

        {/* STAT ROW */}
        <section className="stat-row">
          <div className="stat-card present">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </div>
            <div className="n">{props.stats.present}</div>
            <div className="l">Пришли</div>
          </div>
          <div className="stat-card late">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div className="n">{props.stats.late}</div>
            <div className="l">Опоздали</div>
          </div>
          <div className="stat-card absent">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </div>
            <div className="n">{props.stats.absent}</div>
            <div className="l">Отсутствуют</div>
          </div>
          <div className="stat-card total">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5a1 1 0 011-1h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
              </svg>
            </div>
            <div className="n">{props.stats.total}</div>
            <div className="l">Всего в списках</div>
          </div>
        </section>

        {/* AI + TREND */}
        <section className="grid-2">
          <div className="panel ai-panel">
            <div className="ai-head">
              <div className="ai-badge">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
                </svg>
              </div>
              <h4>ИИ-аналитика</h4>
            </div>
            {props.attendanceInsights.map((insight, index) => (
              <div key={`${insight.tone}-${index}`} className="insight">
                <span className={`dot ${insight.tone}`} />
                <p>{insight.text}</p>
              </div>
            ))}

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button
                type="button"
                onClick={handleGenerateAiSummary}
                disabled={isAiLoading || !activeClassId}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--brand, #0071E3)',
                  color: '#fff',
                  cursor: isAiLoading ? 'default' : 'pointer',
                  opacity: isAiLoading ? 0.6 : 1,
                }}
              >
                {isAiLoading ? 'Анализирую…' : `Обзор по ${activeClass?.name || 'классу'} (30 дней)`}
              </button>

              {aiError && (
                <p style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px' }}>{aiError}</p>
              )}

              {aiSummary && (
                <p style={{ fontSize: '13.5px', lineHeight: 1.5, marginTop: '10px', color: 'var(--text-2)' }}>
                  {aiSummary}
                </p>
              )}
            </div>
          </div>

          <div className="panel trend-wrap">
            <div className="trend-top">
              <div>
                <div className="big">
                  {props.weeklyTrend.averagePct === null
                    ? '—'
                    : `${formatPercentage(props.weeklyTrend.averagePct)}%`}
                </div>
                <div className="cap">Средняя посещаемость за неделю</div>
              </div>
              <div className={`trend-pill ${trendPillClass}`}>{trendPillText}</div>
            </div>
            <svg viewBox="0 0 300 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0071E3" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0071E3" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(0,0,0,.06)" strokeWidth="1" />
              <line x1="0" y1="55" x2="300" y2="55" stroke="rgba(0,0,0,.06)" strokeWidth="1" />
              <line x1="0" y1="90" x2="300" y2="90" stroke="rgba(0,0,0,.06)" strokeWidth="1" />
              {trendSegments.map((segment, index) => {
                const linePath = segment
                  .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${point.x},${point.y}`)
                  .join(' ');
                const firstPoint = segment[0];
                const lastPoint = segment[segment.length - 1];
                const areaPath = `${linePath} L${lastPoint.x},100 L${firstPoint.x},100 Z`;

                return (
                  <g key={`segment-${index}`}>
                    <path d={areaPath} fill="url(#areaFill)" />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#0071E3"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
              {trendPoints.filter((point) => point.y !== null).map((point) => (
                <circle
                  key={point.date}
                  cx={point.x}
                  cy={point.y!}
                  r="3.5"
                  fill="#fff"
                  stroke="#0071E3"
                  strokeWidth="2"
                >
                  <title>{`${point.label}: ${formatPercentage(point.percentage!)}%`}</title>
                </circle>
              ))}
              {trendSegments.length === 0 && (
                <text x="150" y="55" textAnchor="middle" fontSize="10" fill="#AEAEB2">
                  Нет отметок за выбранные дни
                </text>
              )}
              <g fontSize="9" fill="#AEAEB2">
                {trendPoints.map((point) => (
                  <text key={point.date} x={point.x} y="120" textAnchor="middle">
                    {point.label}
                  </text>
                ))}
              </g>
            </svg>
          </div>
        </section>

        {/* BAR + DONUT */}
        <section className="grid-3">
          <div className="panel">
            <h4>По классам</h4>
            <div className="sub">Посещаемость за сегодня</div>
            <div
              className="attendance-class-bars"
              aria-label="Посещаемость по классам"
            >
              {props.classBarStats.map((bar) => (
                <div
                  key={bar.name}
                  className={`attendance-class-bar ${bar.isBest ? 'best' : ''}`}
                  title={bar.markedCount === 0 ? 'Сегодня отметок нет' : `${bar.percentage}% из ${bar.markedCount} отметок`}
                >
                  <div className="attendance-class-track">
                    <div className="attendance-class-fill" style={{ height: `${bar.percentage || 0}%` }} />
                  </div>
                  <div className="attendance-class-value">
                    {bar.percentage === null ? '—' : `${bar.percentage}%`}
                  </div>
                  <div className="attendance-class-name">{bar.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h4>Структура отметок</h4>
            <div className="sub">За последний месяц</div>
            <div className="donut-wrap">
              <svg width="112" height="112" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#F0F0F2" strokeWidth="6.5" />
                <circle
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="transparent"
                  stroke="#30D158"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeDasharray={`${props.donutStats.presentPct} ${100 - props.donutStats.presentPct}`}
                  strokeDashoffset="25"
                />
                <circle
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="transparent"
                  stroke="#FF9F0A"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeDasharray={`${props.donutStats.latePct} ${100 - props.donutStats.latePct}`}
                  strokeDashoffset={25 - props.donutStats.presentPct}
                />
                <circle
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="transparent"
                  stroke="#FF453A"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeDasharray={`${props.donutStats.absentPct} ${100 - props.donutStats.absentPct}`}
                  strokeDashoffset={25 - props.donutStats.presentPct - props.donutStats.latePct}
                />
              </svg>
              <div className="donut-rows">
                <div>
                  <span className="sw" style={{ background: '#30D158' }} />
                  Пришли<b>{props.donutStats.presentPct}%</b>
                </div>
                <div>
                  <span className="sw" style={{ background: '#FF9F0A' }} />
                  Опоздали<b>{props.donutStats.latePct}%</b>
                </div>
                <div>
                  <span className="sw" style={{ background: '#FF453A' }} />
                  Отсутствуют<b>{props.donutStats.absentPct}%</b>
                </div>
                {props.donutStats.total === 0 && (
                  <div className="donut-empty">Нет отметок за период</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* LOG */}
        <section className="log-panel">
          <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>Последние записи</h4>
          <div className="sub" style={{ fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '6px' }}>
            Журнал отметок по классам
          </div>

          {props.recentLogs.map((log, index) => {
            const dateParts = log.date.split('-');
            const displayDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}` : log.date;
            
            return (
              <div key={`${log.class_id}-${log.date}`} className="log-row">
                <div className="log-icon" style={{ background: LOG_GRADIENTS[index % LOG_GRADIENTS.length] }}>
                  {log.class_name}
                </div>
                <div className="log-main">
                  <div className="cls">{log.class_name} класс</div>
                  <div className="who">{log.teacher_name}</div>
                </div>
                <div className="log-breakdown">
                  <span><span className="sw" style={{ background: '#30D158' }} />{log.present_count}</span>
                  <span><span className="sw" style={{ background: '#FF9F0A' }} />{log.late_count}</span>
                  <span><span className="sw" style={{ background: '#FF453A' }} />{log.absent_count}</span>
                </div>
                <div className="log-date">{displayDate}</div>
              </div>
            );
          })}
          {props.recentLogs.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)', fontSize: '14px' }}>
              Нет записей
            </div>
          )}
        </section>
      </main>

      {/* MODAL */}
      <div
        className={`overlay ${isModalOpen ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}
      >
        <div className="modal">
          <div className="modal-head">
            <div>
              <h3>Отметить учеников</h3>
              <div className="sub">{activeClass?.name || 'Класс'} · {capitalizedDate}</div>
            </div>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>
              ×
            </button>
          </div>

          <div className="modal-body">
            {isLoadingStudents ? (
              <div className="modal-loading" role="status">
                <span className="modal-loading-spinner" aria-hidden="true" />
                Загрузка учеников...
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>Нет учеников в классе</div>
            ) : (
              students.map((student, idx) => (
                <div key={student.id} className="roster-row">
                  <span className="roll">{idx + 1}</span>
                  <span className="fio">{student.full_name}</span>
                  <div className="attendance-status-control">
                    <div
                      className={`absence-options ${student.status === 'absent' ? 'open' : ''}`}
                      role="group"
                      aria-label={`Причина отсутствия: ${student.full_name}`}
                      aria-hidden={student.status !== 'absent'}
                    >
                      {ABSENCE_REASON_OPTIONS.map((reason) => (
                        <button
                          key={reason.value}
                          type="button"
                          className={student.absence_reason === reason.value ? 'selected' : ''}
                          onClick={() => handleAbsenceReasonChange(student.id, reason.value)}
                          title={reason.label}
                          aria-label={reason.label}
                          tabIndex={student.status === 'absent' ? 0 : -1}
                        >
                          {reason.short}
                        </button>
                      ))}
                    </div>
                    <div className="seg">
                      <button
                        className={student.status === 'present' ? 'sel present' : ''}
                        onClick={() => handleStatusChange(student.id, 'present')}
                      >
                        Пришёл
                      </button>
                      <button
                        className={student.status === 'late' ? 'sel late' : ''}
                        onClick={() => handleStatusChange(student.id, 'late')}
                      >
                        Опоздал
                      </button>
                      <button
                        className={student.status === 'absent' ? 'sel absent' : ''}
                        onClick={() => handleStatusChange(student.id, 'absent')}
                      >
                        Нет
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="modal-foot">
            <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>
              Отмена
            </button>
            <button className="btn-save" onClick={handleSaveMarks} disabled={isLoadingStudents || isSavingMarks}>
              {isSavingMarks ? 'Сохраняю...' : 'Сохранить отметки'}
            </button>
          </div>
        </div>
      </div>

      {/* TOAST */}
      <div className={`toast ${isToastVisible ? 'show' : ''}`}>
        Отметки за {activeClass?.name || 'класс'} сохранены
      </div>
    </div>
  );
}
