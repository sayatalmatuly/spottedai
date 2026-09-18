import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { translate, type AppLocale } from '@/lib/locale';
import { getCurrentLocale } from '@/lib/locale-server';
import type { AttendanceStatus } from '@/lib/types';

const MAX_PERIOD_DAYS = 92;

type SummaryRequest = {
  classId?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  locale?: unknown;
};

type AttendanceLog = {
  date: string;
  status: AttendanceStatus;
  students: { full_name: string } | { full_name: string }[] | null;
};

type StatusTotals = Record<AttendanceStatus, number>;

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function createTotals(): StatusTotals {
  return { present: 0, late: 0, absent: 0 };
}

function formatAttendanceData(logs: AttendanceLog[], locale: AppLocale) {
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
  const dailyTotals = new Map<string, StatusTotals>();
  const studentTotals = new Map<string, StatusTotals>();

  for (const log of logs) {
    const dayTotals = dailyTotals.get(log.date) ?? createTotals();
    dayTotals[log.status]++;
    dailyTotals.set(log.date, dayTotals);

    const student = Array.isArray(log.students) ? log.students[0] : log.students;
    const studentName = student?.full_name ?? t('Аты жоқ оқушы', 'Unnamed student');
    const totals = studentTotals.get(studentName) ?? createTotals();
    totals[log.status]++;
    studentTotals.set(studentName, totals);
  }

  const dailySummary = Array.from(dailyTotals.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, totals]) => t(
      `${date}: келді ${totals.present}, кешікті ${totals.late}, жоқ ${totals.absent}`,
      `${date}: present ${totals.present}, late ${totals.late}, absent ${totals.absent}`
    ))
    .join('\n');

  const studentsNeedingAttention = Array.from(studentTotals.entries())
    .filter(([, totals]) => totals.absent > 0 || totals.late > 0)
    .sort(([, first], [, second]) => (
      second.absent - first.absent
      || second.late - first.late
      || (second.present + second.late + second.absent) - (first.present + first.late + first.absent)
    ))
    .slice(0, 10)
    .map(([name, totals]) => t(
      `${name}: келмегені ${totals.absent}, кешіккені ${totals.late}`,
      `${name}: absences ${totals.absent}, late arrivals ${totals.late}`
    ))
    .join('\n');

  return [
    t('Күндер бойынша динамика:', 'Daily trend:'),
    dailySummary,
    '',
    t('Назар аударуды қажет ететін оқушылар:', 'Students who need attention:'),
    studentsNeedingAttention || t('Қалулар мен кешігулер жоқ.', 'No absences or late arrivals.'),
  ].join('\n');
}

function extractChatCompletionText(data: unknown) {
  if (!data || typeof data !== 'object' || !('choices' in data) || !Array.isArray(data.choices)) {
    return null;
  }

  const firstChoice = data.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object' || !('message' in firstChoice)) {
    return null;
  }

  const message = firstChoice.message;
  if (!message || typeof message !== 'object' || !('content' in message) || typeof message.content !== 'string') {
    return null;
  }

  return message.content.trim() || null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let locale = await getCurrentLocale();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t('Авторизация қажет.', 'Authentication is required.') }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'TEACHER' && profile.role !== 'ADMIN')) {
    return NextResponse.json({ error: t('AI талдауын пайдалануға құқық жеткіліксіз.', 'You do not have permission to use AI analysis.') }, { status: 403 });
  }

  let body: SummaryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t('Сұрау пішімі қате.', 'Invalid request format.') }, { status: 400 });
  }

  const { classId, dateFrom, dateTo } = body;
  if (body.locale === 'kk' || body.locale === 'en' || body.locale === 'ru') locale = body.locale;
  if (
    typeof classId !== 'string'
    || !classId
    || !isDateKey(dateFrom)
    || !isDateKey(dateTo)
  ) {
    return NextResponse.json(
      { error: t('classId, dateFrom және dateTo міндетті және дұрыс болуы керек.', 'classId, dateFrom, and dateTo are required and must be valid.') },
      { status: 400 }
    );
  }

  const periodLength = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000;
  if (periodLength < 0 || periodLength > MAX_PERIOD_DAYS) {
    return NextResponse.json(
      { error: t(`Талдау кезеңі 1–${MAX_PERIOD_DAYS + 1} күн аралығында болуы керек.`, `The analysis period must be between 1 and ${MAX_PERIOD_DAYS + 1} days.`) },
      { status: 400 }
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: t('AI талдауы бапталмаған: сервер айнымалыларына GROQ_API_KEY қосыңыз.', 'AI analysis is not configured: add GROQ_API_KEY to the server environment.') },
      { status: 503 }
    );
  }

  const { data: logs, error: dbError } = await supabase
    .from('attendance_logs')
    .select('date, status, students(full_name)')
    .eq('class_id', classId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true });

  if (dbError) {
    console.error('Could not load attendance for AI summary:', dbError.message);
    return NextResponse.json({ error: t('Қатысу белгілерін жүктеу мүмкін болмады.', 'Could not load attendance records.') }, { status: 500 });
  }

  if (!logs || logs.length === 0) {
    return NextResponse.json({ summary: t('Таңдалған кезеңге қатысу белгілері жоқ.', 'There are no attendance records for the selected period.') });
  }

  const attendanceData = formatAttendanceData(logs as AttendanceLog[], locale);
  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_SUMMARY_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_completion_tokens: 280,
      messages: [{
        role: 'system',
        content: [
        t('Сен сынып жетекшісінің көмекшісісің.', 'You are an assistant to a class teacher.'),
        t('Тек берілген деректер бойынша қазақ тілінде қысқа, пайдалы қорытынды жаз.', 'Write a short, useful summary in English using only the supplied data.'),
        t('Трендті, деректердегі үлестерді не сандарды және жиі қалатын не кешігетін оқушыларды көрсет.', 'Mention the trend, rates or counts from the data, and students with frequent absences or late arrivals.'),
        t('Дерек ойдан шығарма және бес қысқа сөйлемнен асырма.', 'Do not invent facts and use no more than five short sentences.'),
        ].join(' '),
      }, {
        role: 'user',
        content: t(
          `${dateFrom} — ${dateTo} аралығындағы қатысу:\n${attendanceData}`,
          `Attendance from ${dateFrom} to ${dateTo}:\n${attendanceData}`
        ),
      }],
    }),
  });

  if (!groqResponse.ok) {
    console.error('Groq summary request failed:', groqResponse.status, await groqResponse.text());
    return NextResponse.json(
      { error: t('AI қызметі уақытша қолжетімсіз. Қайталап көріңіз.', 'The AI service is temporarily unavailable. Please try again.') },
      { status: 502 }
    );
  }

  const summary = extractChatCompletionText(await groqResponse.json());
  if (!summary) {
    return NextResponse.json({ error: t('AI мәтіндік қорытындыны қайтармады.', 'The AI did not return a text summary.') }, { status: 502 });
  }

  return NextResponse.json({ summary });
}
