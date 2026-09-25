import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRole } from '@/lib/auth';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = pathname === '/login';
  const isPendingPage = pathname === '/pending-approval';
  // The recovery code is exchanged for a session by this route handler. It
  // must reach the handler before the regular guest redirect is applied.
  // `/reset-password` validates both the recovery marker and Supabase user
  // itself, so leaving it public here does not expose the reset form.
  const isPasswordRecoveryRoute =
    pathname === '/auth/callback' || pathname === '/reset-password';

  // If user is not logged in and trying to access a protected page, redirect to /login
  if (!user && !isLoginPage && !isPasswordRecoveryRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in and trying to access /login, redirect to home
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Check user status (PENDING / APPROVED) if logged in
  if (user && !isLoginPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    const isAdmin = isAdminRole(profile?.role);

    // An administrator is explicitly trusted even if the account was created
    // manually and its approval status has not yet been updated.
    if (profile && profile.status === 'PENDING' && !isAdmin) {
      if (!isPendingPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/pending-approval';
        return NextResponse.redirect(url);
      }
    } else {
      // If user is APPROVED (or status is NULL) and trying to open /pending-approval, redirect to home
      if (isPendingPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    // Protect /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
