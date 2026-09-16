import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AttendanceStatus } from '@/lib/types';

const MAX_PERIOD_DAYS = 92;

type SummaryRequest = {
  classId?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
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

function formatAttendanceData(logs: AttendanceLog[]) {
  const dailyTotals = new Map<string, StatusTotals>();
  const studentTotals = new Map<string, StatusTotals>();

  for (const log of logs) {
    const dayTotals = dailyTotals.get(log.date) ?? createTotals();
    dayTotals[log.status]++;
    dailyTotals.set(log.date, dayTotals);

    const student = Array.isArray(log.students) ? log.students[0] : log.students;
    const studentName = student?.full_name ?? 'Ученик без имени';
    const totals = studentTotals.get(studentName) ?? createTotals();
    totals[log.status]++;
    studentTotals.set(studentName, totals);
  }

  const dailySummary = Array.from(dailyTotals.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, totals]) => `${date}: пришли ${totals.present}, опоздали ${totals.late}, отсутствуют ${totals.absent}`)
    .join('\n');

  const studentsNeedingAttention = Array.from(studentTotals.entries())
    .filter(([, totals]) => totals.absent > 0 || totals.late > 0)
    .sort(([, first], [, second]) => (
      second.absent - first.absent
      || second.late - first.late
      || (second.present + second.late + second.absent) - (first.present + first.late + first.absent)
    ))
    .slice(0, 10)
    .map(([name, totals]) => `${name}: отсутствий ${totals.absent}, опозданий ${totals.late}`)
    .join('\n');

  return [
    'Динамика по дням:',
    dailySummary,
    '',
    'Ученики, которым нужно внимание:',
    studentsNeedingAttention || 'Нет пропусков и опозданий.',
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Требуется авторизация.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'TEACHER' && profile.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Недостаточно прав для ИИ-анализа.' }, { status: 403 });
  }

  let body: SummaryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса.' }, { status: 400 });
  }

  const { classId, dateFrom, dateTo } = body;
  if (
    typeof classId !== 'string'
    || !classId
    || !isDateKey(dateFrom)
    || !isDateKey(dateTo)
  ) {
    return NextResponse.json(
      { error: 'classId, dateFrom и dateTo обязательны и должны быть корректными.' },
      { status: 400 }
    );
  }

  const periodLength = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000;
  if (periodLength < 0 || periodLength > MAX_PERIOD_DAYS) {
    return NextResponse.json(
      { error: `Период анализа должен быть от 1 до ${MAX_PERIOD_DAYS + 1} дней.` },
      { status: 400 }
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'ИИ-анализ не настроен: добавьте GROQ_API_KEY в переменные окружения сервера.' },
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
    return NextResponse.json({ error: 'Не удалось загрузить отметки посещаемости.' }, { status: 500 });
  }

  if (!logs || logs.length === 0) {
    return NextResponse.json({ summary: 'Нет отметок за выбранный период.' });
  }

  const attendanceData = formatAttendanceData(logs as AttendanceLog[]);
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
        'Ты помощник классного руководителя.',
        'Составь краткую полезную сводку на русском языке только по переданным данным.',
        'Укажи тренд, доли или числа из данных и учеников с частыми пропусками или опозданиями.',
        'Не придумывай факты и не используй больше пяти коротких предложений.',
        ].join(' '),
      }, {
        role: 'user',
        content: `Посещаемость за период ${dateFrom} — ${dateTo}:\n${attendanceData}`,
      }],
    }),
  });

  if (!groqResponse.ok) {
    console.error('Groq summary request failed:', groqResponse.status, await groqResponse.text());
    return NextResponse.json(
      { error: 'ИИ-сервис временно недоступен. Попробуйте ещё раз.' },
      { status: 502 }
    );
  }

  const summary = extractChatCompletionText(await groqResponse.json());
  if (!summary) {
    return NextResponse.json({ error: 'ИИ не вернул текстовую сводку.' }, { status: 502 });
  }

  return NextResponse.json({ summary });
}
