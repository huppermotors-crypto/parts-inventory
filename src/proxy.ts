import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files — no locale prefix needed
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') // static files (favicon.ico, icon.png, extension.zip, etc.)
  ) {
    return NextResponse.next();
  }

  // Apply i18n middleware (locale detection, redirect / → /en/)
  const intlResponse = intlMiddleware(request);

  // If i18n did a redirect (e.g. / → /en/) — return it immediately
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // For admin/login routes, run Supabase auth check
  const localeMatch = pathname.match(/^\/(en|ru|es)(\/.*)?$/);
  const pathWithoutLocale = localeMatch ? (localeMatch[2] || '/') : pathname;

  if (pathWithoutLocale.startsWith('/admin') || pathWithoutLocale === '/login') {
    return updateSession(request, pathWithoutLocale);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon\\.png|extension\\.zip|robots\\.txt|sitemap\\.xml).*)',
  ],
};
