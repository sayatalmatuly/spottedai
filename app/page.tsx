import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/auth';
import { sortClassesNaturally } from '@/lib/class-sort';
import { translate } from '@/lib/locale';
import { getCurrentLocale } from '@/lib/locale-server';
import AttendanceDashboard from './AttendanceDashboard';
import type {
  AttendanceInsight,
  AttendanceStatus,
  ClassBarStat,
  ClassInfo,
  DashboardStats,
  LogEntry,
  WeeklyTrend,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;
const SCHOOL_DAYS_PER_WEEK = 5;
const WEEKDAY_LABELS = {
  kk: ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
};

type StatusTotals = {
  total: number;
  present: number;
  late: number;
  absent: number;
};

type DashboardAttendanceRow = {
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
};

type StudentDirectoryRow = {
  id: string;
  full_name: string;
  class_id: string;
};

function createTotals(): StatusTotals {
  return { total: 0, present: 0, late: 0, absent: 0 };
}

function addStatus(totals: StatusTotals, status: AttendanceStatus) {
  totals.total++;
  totals[status]++;
}

function getPercentage(value: number, total: number, decimalPlaces = 0): number | null {
  if (total === 0) return null;
  const multiplier = 10 ** decimalPlaces;
  return Math.round((value / total) * 100 * multiplier) / multiplier;
}

function getAttendancePercentage(totals: StatusTotals, decimalPlaces = 0): number | null {
  return getPercentage(totals.present + totals.late, totals.total, decimalPlaces);
}

function dateFromKey(dateKeyValue: string) {
  const [year, month, day] = dateKeyValue.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function shiftDate(dateKeyValue: string, amount: number) {
  const date = dateFromKey(dateKeyValue);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

function getSchoolDaysEndingOn(endDate: string, count: number) {
  const dates: string[] = [];
  const current = dateFromKey(endDate);

  while (dates.length < count) {
    // The school uses a five-day schedule: Monday through Friday.
    if (current.getUTCDay() >= 1 && current.getUTCDay() <= 5) dates.unshift(dateKey(current));
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return dates;
}

function getSchoolDaysBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  const end = dateFromKey(endDate);
  const current = dateFromKey(startDate);

  while (current <= end) {
    if (current.getUTCDay() >= 1 && current.getUTCDay() <= 5) dates.push(dateKey(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

async function loadAttendanceRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateFrom: string,
  dateTo: string
) {
  const attendanceRows: DashboardAttendanceRow[] = [];

  // Supabase limits a single response to 1,000 rows. Keep pagination, but
  // request only columns used by the dashboard to reduce transfer size.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('student_id, class_id, date, status')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Could not load attendance analytics:', error.message);
      break;
    }

    const page = (data || []) as unknown as DashboardAttendanceRow[];
    attendanceRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return attendanceRows;
}

async function loadStudentDirectory(supabase: Awaited<ReturnType<typeof createClient>>) {
  const students: StudentDirectoryRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, class_id')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Could not load student directory:', error.message);
      break;
    }

    const page = (data || []) as StudentDirectoryRow[];
    students.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return students;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  const t = (kazakh: string, english: string, russian?: string) => translate(locale, kazakh, english, russian);

  const { data: { user } } = await supabase.auth.getUser();
  const today = dateKey(new Date());
  const monthStart = shiftDate(today, -29);
  const weeklyDates = getSchoolDaysEndingOn(today, SCHOOL_DAYS_PER_WEEK);
  const previousWeeklyDates = getSchoolDaysEndingOn(shiftDate(weeklyDates[0], -1), SCHOOL_DAYS_PER_WEEK);
  const analyticsStart = monthStart < previousWeeklyDates[0] ? monthStart : previousWeeklyDates[0];

  // These reads do not depend on one another. Starting them together avoids
  // making dashboard loading time the sum of several network round trips.
  const profilePromise = user
    ? supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
    : Promise.resolve({ data: null });
  const classesPromise = supabase
    .from('classes')
    .select('id, name, teacher_id, student_count');
  const studentsPromise = loadStudentDirectory(supabase);
  const totalStudentsPromise = supabase
    .from('students')
    .select('id', { count: 'exact', head: true });
  const attendanceRowsPromise = loadAttendanceRows(supabase, analyticsStart, today);
  const recentLogsPromise = supabase
    .from('attendance_logs')
    .select(`
      class_id,
      date,
      status,
      classes!inner(name, teacher:profiles(full_name))
    `)
    .order('date', { ascending: false })
    .limit(200);

  const [profileResult, classesResult, students, totalStudentsResult, attendanceRows, recentLogsResult] = await Promise.all([
    profilePromise,
    classesPromise,
    studentsPromise,
    totalStudentsPromise,
    attendanceRowsPromise,
    recentLogsPromise,
  ]);

  let teacherName = t('Мұғалім', 'Teacher');
  let teacherInitials = t('М', 'T');
  let userRole: 'ADMIN' | 'TEACHER' = 'TEACHER';
  const userEmail = user?.email || '';
  const profile = profileResult.data;

  if (profile) {
    teacherName = profile.full_name;
    userRole = isAdminRole(profile.role) ? 'ADMIN' : 'TEACHER';
    teacherInitials = profile.full_name
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  const classesRaw = classesResult.data;
  const classes: ClassInfo[] = sortClassesNaturally(
    (classesRaw || []).map((classRow: any) => ({
      id: classRow.id,
      name: classRow.name,
      teacher_id: classRow.teacher_id,
      student_count: classRow.student_count,
    }))
  );
  const classNameById = new Map(classes.map((classInfo) => [classInfo.id, classInfo.name]));
  const studentById = new Map(
    students.map((student) => [
      student.id,
      { name: student.full_name },
    ])
  );

  const todayTotals = createTotals();
  const todayByClass = new Map<string, StatusTotals>();
  const totalsByDate = new Map<string, StatusTotals>();
  const monthlyTotals = createTotals();
  const monthlyByClass = new Map<string, { name: string; totals: StatusTotals }>();
  const monthlyByStudent = new Map<string, {
    name: string;
    className: string;
    statuses: Map<string, AttendanceStatus>;
    absentCount: number;
  }>();
  const latenessByWeekday = new Map<number, StatusTotals>();

  for (const row of attendanceRows) {
    let dateTotals = totalsByDate.get(row.date);
    if (!dateTotals) {
      dateTotals = createTotals();
      totalsByDate.set(row.date, dateTotals);
    }
    addStatus(dateTotals, row.status);

    if (row.date === today) {
      addStatus(todayTotals, row.status);
      let classTotals = todayByClass.get(row.class_id);
      if (!classTotals) {
        classTotals = createTotals();
        todayByClass.set(row.class_id, classTotals);
      }
      addStatus(classTotals, row.status);
    }

    if (row.date >= monthStart) {
      addStatus(monthlyTotals, row.status);

      let classSummary = monthlyByClass.get(row.class_id);
      if (!classSummary) {
        classSummary = {
          name: classNameById.get(row.class_id) || t('Сынып', 'Class'),
          totals: createTotals(),
        };
        monthlyByClass.set(row.class_id, classSummary);
      }
      addStatus(classSummary.totals, row.status);

      const weekday = dateFromKey(row.date).getUTCDay();
      let weekdayTotals = latenessByWeekday.get(weekday);
      if (!weekdayTotals) {
        weekdayTotals = createTotals();
        latenessByWeekday.set(weekday, weekdayTotals);
      }
      addStatus(weekdayTotals, row.status);

      let studentSummary = monthlyByStudent.get(row.student_id);
      if (!studentSummary) {
        const student = studentById.get(row.student_id);
        studentSummary = {
          name: student?.name || t('Оқушы', 'Student'),
          className: classNameById.get(row.class_id) || t('Сынып', 'Class'),
          statuses: new Map(),
          absentCount: 0,
        };
        monthlyByStudent.set(row.student_id, studentSummary);
      }
      studentSummary.statuses.set(row.date, row.status);
      if (row.status === 'absent') studentSummary.absentCount++;
    }
  }

  const stats: DashboardStats = {
    present: todayTotals.present,
    late: todayTotals.late,
    absent: todayTotals.absent,
    total: totalStudentsResult.count || 0,
  };

  const classBarStats: ClassBarStat[] = classes
    .filter((classInfo) => classInfo.student_count > 0)
    .map((classInfo) => {
      const totals = todayByClass.get(classInfo.id);
      return {
        name: classInfo.name,
        percentage: totals ? getAttendancePercentage(totals) : null,
        markedCount: totals?.total || 0,
        isBest: false,
      };
    });

  const markedClassBars = classBarStats.filter((bar) => bar.percentage !== null);
  if (markedClassBars.length > 0) {
    const highestPercentage = Math.max(...markedClassBars.map((bar) => bar.percentage as number));
    const bestClass = classBarStats.find((bar) => bar.percentage === highestPercentage);
    if (bestClass) bestClass.isBest = true;
  }

  const donutStats = {
    presentPct: getPercentage(monthlyTotals.present, monthlyTotals.total) || 0,
    latePct: getPercentage(monthlyTotals.late, monthlyTotals.total) || 0,
    absentPct: getPercentage(monthlyTotals.absent, monthlyTotals.total) || 0,
    total: monthlyTotals.total,
  };

  const getPeriodTotals = (dates: string[]) => {
    const totals = createTotals();
    for (const date of dates) {
      const dayTotals = totalsByDate.get(date);
      if (!dayTotals) continue;
      totals.total += dayTotals.total;
      totals.present += dayTotals.present;
      totals.late += dayTotals.late;
      totals.absent += dayTotals.absent;
    }
    return totals;
  };

  const weeklyTotals = getPeriodTotals(weeklyDates);
  const previousWeeklyTotals = getPeriodTotals(previousWeeklyDates);
  const weeklyAverage = getAttendancePercentage(weeklyTotals, 1);
  const previousWeeklyAverage = getAttendancePercentage(previousWeeklyTotals, 1);
  const weeklyTrend: WeeklyTrend = {
    averagePct: weeklyAverage,
    changePp: weeklyAverage !== null && previousWeeklyAverage !== null
      ? Math.round((weeklyAverage - previousWeeklyAverage) * 10) / 10
      : null,
    points: weeklyDates.map((date) => {
      const totals = totalsByDate.get(date);
      return {
        date,
        label: WEEKDAY_LABELS[locale][dateFromKey(date).getUTCDay()],
        percentage: totals ? getAttendancePercentage(totals) : null,
      };
    }),
  };

  const formatPercentage = (value: number) => (
    Number.isInteger(value) ? String(value) : value.toFixed(1)
  );
  const heroAttendanceText = weeklyAverage === null
    ? t('Аптадағы қатысуды салыстыруға белгілер жеткіліксіз.', 'There is not enough attendance data to compare this week.', 'Недостаточно отметок для сравнения посещаемости за неделю.')
    : weeklyTrend.changePp === null
      ? t(
        `Соңғы бес оқу күніндегі орташа қатысу — ${formatPercentage(weeklyAverage)}%.`,
        `Average attendance for the last five school days is ${formatPercentage(weeklyAverage)}%.`,
        `Средняя посещаемость за последние пять учебных дней — ${formatPercentage(weeklyAverage)}%.`
      )
      : weeklyTrend.changePp === 0
        ? t(
          `Соңғы бес оқу күніндегі орташа қатысу — ${formatPercentage(weeklyAverage)}%; алдыңғы бес күнмен салыстырғанда өзгеріс жоқ.`,
          `Average attendance for the last five school days is ${formatPercentage(weeklyAverage)}%, unchanged from the previous five days.`,
          `Средняя посещаемость за последние пять учебных дней — ${formatPercentage(weeklyAverage)}%; без изменений к предыдущим пяти дням.`
        )
        : t(
          `Соңғы бес оқу күніндегі орташа қатысу — ${formatPercentage(weeklyAverage)}%: алдыңғы бес күнмен салыстырғанда ${formatPercentage(Math.abs(weeklyTrend.changePp))} т.п. ${weeklyTrend.changePp > 0 ? 'жоғары' : 'төмен'}.`,
          `Average attendance for the last five school days is ${formatPercentage(weeklyAverage)}%: ${formatPercentage(Math.abs(weeklyTrend.changePp))} pp ${weeklyTrend.changePp > 0 ? 'higher' : 'lower'} than the previous five days.`,
          `Средняя посещаемость за последние пять учебных дней — ${formatPercentage(weeklyAverage)}%: ${weeklyTrend.changePp > 0 ? 'выше' : 'ниже'} на ${formatPercentage(Math.abs(weeklyTrend.changePp))} п.п. к предыдущим пяти дням.`
        );

  const attendanceInsights: AttendanceInsight[] = [];
  const monthlySchoolDays = getSchoolDaysBetween(monthStart, today);
  let longestAbsence: { name: string; className: string; streak: number } | null = null;
  let mostAbsent: { name: string; className: string; absentCount: number } | null = null;

  for (const student of monthlyByStudent.values()) {
    let currentStreak = 0;
    let studentLongestStreak = 0;
    for (const date of monthlySchoolDays) {
      if (student.statuses.get(date) === 'absent') {
        currentStreak++;
        studentLongestStreak = Math.max(studentLongestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    if (!longestAbsence || studentLongestStreak > longestAbsence.streak) {
      longestAbsence = { name: student.name, className: student.className, streak: studentLongestStreak };
    }
    if (!mostAbsent || student.absentCount > mostAbsent.absentCount) {
      mostAbsent = { name: student.name, className: student.className, absentCount: student.absentCount };
    }
  }

  if (longestAbsence && longestAbsence.streak >= 2) {
    attendanceInsights.push({
      tone: 'risk',
      text: t(
        `${longestAbsence.name}, ${longestAbsence.className} — ${longestAbsence.streak} күн қатарынан келмеді.`,
        `${longestAbsence.name}, ${longestAbsence.className} — absent for ${longestAbsence.streak} days in a row.`,
        `${longestAbsence.name}, ${longestAbsence.className} — отсутствует ${longestAbsence.streak} дней подряд.`
      ),
    });
  } else if (mostAbsent && mostAbsent.absentCount >= 2) {
    attendanceInsights.push({
      tone: 'risk',
      text: t(
        `${mostAbsent.name}, ${mostAbsent.className} — соңғы 30 күнде ${mostAbsent.absentCount} рет келмеді.`,
        `${mostAbsent.name}, ${mostAbsent.className} — ${mostAbsent.absentCount} absences in the last 30 days.`,
        `${mostAbsent.name}, ${mostAbsent.className} — ${mostAbsent.absentCount} пропусков за последние 30 дней.`
      ),
    });
  }

  let highestLateness: { weekday: number; totals: StatusTotals; percentage: number } | null = null;
  for (const [weekday, totals] of latenessByWeekday) {
    const percentage = getPercentage(totals.late, totals.total) || 0;
    if (totals.late > 0 && (!highestLateness || percentage > highestLateness.percentage)) {
      highestLateness = { weekday, totals, percentage };
    }
  }
  if (highestLateness) {
    attendanceInsights.push({
      tone: 'watch',
      text: t(
        `Кешігудің ең жоғары үлесі — ${WEEKDAY_LABELS.kk[highestLateness.weekday]}: ${highestLateness.percentage}% (${highestLateness.totals.late}/${highestLateness.totals.total} белгі).`,
        `The highest late rate is on ${WEEKDAY_LABELS.en[highestLateness.weekday]}: ${highestLateness.percentage}% (${highestLateness.totals.late} of ${highestLateness.totals.total} marks).`,
        `Самая высокая доля опозданий — по ${WEEKDAY_LABELS.ru[highestLateness.weekday]}: ${highestLateness.percentage}% (${highestLateness.totals.late} из ${highestLateness.totals.total} отметок).`
      ),
    });
  }

  let bestMonthlyClass: { name: string; totals: StatusTotals; percentage: number } | null = null;
  for (const classSummary of monthlyByClass.values()) {
    const percentage = getAttendancePercentage(classSummary.totals) || 0;
    if (
      classSummary.totals.total > 0
      && (!bestMonthlyClass || percentage > bestMonthlyClass.percentage)
    ) {
      bestMonthlyClass = { name: classSummary.name, totals: classSummary.totals, percentage };
    }
  }
  if (bestMonthlyClass) {
    attendanceInsights.push({
      tone: 'good',
      text: t(
        `${bestMonthlyClass.name} соңғы 30 күндегі ең жақсы қатысуды көрсетті — ${bestMonthlyClass.percentage}%.`,
        `${bestMonthlyClass.name} has the best attendance over the last 30 days — ${bestMonthlyClass.percentage}%.`,
        `${bestMonthlyClass.name} показывает лучшую посещаемость за последние 30 дней — ${bestMonthlyClass.percentage}%.`
      ),
    });
  }

  if (weeklyTrend.changePp !== null) {
    const kazakhDirection = weeklyTrend.changePp > 0 ? 'өсті' : weeklyTrend.changePp < 0 ? 'төмендеді' : 'өзгермеді';
    const englishDirection = weeklyTrend.changePp > 0 ? 'increased' : weeklyTrend.changePp < 0 ? 'decreased' : 'did not change';
    const magnitude = Math.abs(weeklyTrend.changePp);
    attendanceInsights.push({
      tone: weeklyTrend.changePp > 0 ? 'good' : 'watch',
      text: weeklyTrend.changePp === 0
        ? t(
          'Соңғы бес оқу күніндегі қатысу алдыңғы бес күнмен салыстырғанда өзгермеді.',
          'Attendance over the last five school days did not change from the previous five days.',
          'Посещаемость за последние пять учебных дней не изменилась по сравнению с предыдущими пятью днями.'
        )
        : t(
          `Соңғы бес оқу күніндегі қатысу алдыңғы бес күнмен салыстырғанда ${magnitude} т.п. ${kazakhDirection}.`,
          `Attendance over the last five school days ${englishDirection} by ${magnitude} pp compared with the previous five days.`,
          `Посещаемость за последние пять учебных дней ${weeklyTrend.changePp > 0 ? 'выросла' : 'снизилась'} на ${magnitude} п.п. по сравнению с предыдущими пятью днями.`
        ),
    });
  }

  if (attendanceInsights.length === 0) {
    attendanceInsights.push({
      tone: 'watch',
      text: t(
        'Соңғы 30 күнде талдауға жеткілікті белгі әлі жоқ.',
        'There is not enough attendance data from the last 30 days for analysis yet.',
        'За последние 30 дней пока нет достаточного числа отметок для аналитики.'
      ),
    });
  }

  const recentLogsRaw = recentLogsResult.data;

  const logMap = new Map<string, LogEntry>();
  if (recentLogsRaw) {
    for (const row of recentLogsRaw as any[]) {
      const key = `${row.class_id}_${row.date}`;
      if (!logMap.has(key)) {
        logMap.set(key, {
          class_id: row.class_id,
          class_name: row.classes?.name || '?',
          teacher_name: row.classes?.teacher?.full_name || '—',
          date: row.date,
          present_count: 0,
          late_count: 0,
          absent_count: 0,
        });
      }
      const entry = logMap.get(key)!;
      if (row.status === 'present') entry.present_count++;
      else if (row.status === 'late') entry.late_count++;
      else if (row.status === 'absent') entry.absent_count++;
    }
  }
  const recentLogs = Array.from(logMap.values()).slice(0, 4);

  const todayMarked = todayTotals.total;
  const overallPct = getAttendancePercentage(todayTotals) || 0;
  const presentPct = getPercentage(todayTotals.present, todayMarked) || 0;
  const latePct = getPercentage(todayTotals.late, todayMarked) || 0;
  const absentPct = getPercentage(todayTotals.absent, todayMarked) || 0;
  const unmarkedClasses = classes.filter((classInfo) => !todayByClass.has(classInfo.id));
  const markedCount = classes.length - unmarkedClasses.length;

  return (
    <AttendanceDashboard
      classes={classes}
      stats={stats}
      classBarStats={classBarStats}
      donutStats={donutStats}
      weeklyTrend={weeklyTrend}
      attendanceInsights={attendanceInsights.slice(0, 4)}
      recentLogs={recentLogs}
      teacherName={teacherName}
      teacherInitials={teacherInitials}
      userRole={userRole}
      userEmail={userEmail}
      overallPct={overallPct}
      presentPct={presentPct}
      latePct={latePct}
      absentPct={absentPct}
      unmarkedClasses={unmarkedClasses}
      markedCount={markedCount}
      today={today}
      heroAttendanceText={heroAttendanceText}
    />
  );
}
