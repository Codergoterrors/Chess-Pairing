import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname === "/login";

  // If not logged in and not on login page → redirect to login
  if (!session && !isLoginPage) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // If logged in and on login page → redirect to tournaments
  if (session && isLoginPage) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/tournaments";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// Apply middleware to all routes except static files and API routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
