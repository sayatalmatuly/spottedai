# Инструкция по подключению Supabase к проекту SpottedAI

В этом руководстве описаны шаги для создания проекта в Supabase, создания таблиц через SQL-скрипт, добавления тестовых пользователей и запуска приложения.

---

## Шаг 1. Создание проекта в Supabase

1. Перейдите на [supabase.com](https://supabase.com/) и войдите в аккаунт.
2. Нажмите **New Project** (Новый проект).
3. Укажите название проекта (например, `spottedai`) и надежный пароль базы данных.
4. Выберите регион (например, Frankfurt или Stockholm) и нажмите **Create new project**.
5. Дождитесь завершения инициализации базы данных (1–2 минуты).

---

## Шаг 2. Настройка переменных окружения

1. В Supabase Dashboard перейдите в **Project Settings** → **API**.
2. Скопируйте значения:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon / public key** (`eyJhbGciOiJK...`)
3. В корне проекта SpottedAI создайте файл `.env.local` на основе шаблона `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJK...
```

---

## Шаг 3. Применение SQL-миграции

1. В Supabase Dashboard откройте раздел **SQL Editor** (левое меню).
2. Нажмите **New query** (Новый запрос).
3. Скопируйте полное содержимое файла `supabase/migration.sql` из вашего проекта.
4. Вставьте его в редактор и нажмите кнопку **Run** (Запустить).

Этот скрипт создаст:
- Схему данных (`profiles`, `classes`, `students`, `schedule`, `attendance_logs`)
- Триггеры (авто-создание профиля пользователя и подсчёт учеников в классе)
- Политики Row Level Security (RLS) для защиты данных

---

## Шаг 4. Создание первого пользователя (Администратора)

### Способ 1. Через Supabase Dashboard (Рекомендуется)

1. Перейдите в **Authentication** → **Users** → **Add User** → **Create User**.
2. Введите **Email** (например, `admin@school14.kz`) и **Password** (пароль от 6 символов).
3. Поставьте галочку **Auto Confirm User?** (Подтвердить email сразу).
4. Нажмите **Create User**.
5. Перейдите в **Table Editor** → таблица `profiles`.
6. Найдите только что созданного пользователя и измените значение в колонке `role` с `TEACHER` на `ADMIN`.

### Способ 2. Через SQL Editor

Вставьте в SQL Editor и нажмите Run (замените `admin@school14.kz` при необходимости):

```sql
UPDATE public.profiles 
SET role = 'ADMIN', status = 'APPROVED'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@school14.kz'
);
```

---

## Шаг 5. Запуск приложения и проверка

1. Запустите сервер разработки:
   ```bash
   npm run dev
   ```
2. Откройте в браузере [http://localhost:3000](http://localhost:3000).
3. Приложение **автоматически перенаправит вас на страницу входа** `/login`.
4. Введите Email и пароль администратора.
5. После успешного входа вам откроются:
   - **Дашборд** (`/`) с реальной аналитикой и отметками
   - **Выпадающее меню аккаунта** (нажатие на карточку профиля в левом нижнем углу сайдбара):
     - 👤 **Личный кабинет** (`/profile`)
     - ⚙️ **Админ-панель** (`/admin/teachers`, `/admin/classes`, `/admin/schedule`)
     - 🚪 **Выйти из аккаунта**

---

## Дополнительные тестовые данные (По желанию)

Для тестирования журнала классов можно добавить тестовые классы и учеников прямо через **Админ-панель** (`/admin/classes`) или выполнив этот SQL-запрос:

```sql
-- Создание классов
INSERT INTO public.classes (name) VALUES ('5А'), ('5Б'), ('6А'), ('7Б');

-- Добавление учеников в класс 5А
INSERT INTO public.students (full_name, class_id)
SELECT 'Алексеева В. Д.', id FROM public.classes WHERE name = '5А';

INSERT INTO public.students (full_name, class_id)
SELECT 'Бондарев М. И.', id FROM public.classes WHERE name = '5А';
```
