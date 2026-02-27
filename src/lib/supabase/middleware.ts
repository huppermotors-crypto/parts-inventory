import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

export async function updateSession(request: NextRequest, pathWithoutLocale?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

  // Skip auth checks if Supabase is not configured (during build)
  if (supabaseUrl === PLACEHOLDER_URL) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
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

  // Use locale-stripped path if provided, otherwise use raw pathname
  const checkPath = pathWithoutLocale || request.nextUrl.pathname;

  // Protect /admin routes
  if (checkPath.startsWith("/admin") && !user) {
    const url = request.nextUrl.clone();
    // Preserve the locale prefix in redirect
    const localeMatch = request.nextUrl.pathname.match(/^\/(en|ru|es)/);
    const locale = localeMatch ? localeMatch[1] : 'en';
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login
  if (checkPath === "/login" && user) {
    const url = request.nextUrl.clone();
    const localeMatch = request.nextUrl.pathname.match(/^\/(en|ru|es)/);
    const locale = localeMatch ? localeMatch[1] : 'en';
    url.pathname = `/${locale}/admin/dashboard`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
