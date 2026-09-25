import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PASSWORD_RECOVERY_COOKIE = 'spottedai_password_recovery';

function createRedirectResponse(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');

  // Only the password-recovery email sent by this app is allowed to continue
  // to the password form. Do not accept arbitrary redirect destinations.
  if (!code || next !== '/reset-password') {
    return createRedirectResponse(request, '/login?reset=invalid');
  }

  let response = createRedirectResponse(request, '/reset-password');
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return createRedirectResponse(request, '/login?reset=invalid');
  }

  response.cookies.set(PASSWORD_RECOVERY_COOKIE, '1', {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/reset-password',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
