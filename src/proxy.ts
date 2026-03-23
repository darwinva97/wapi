import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export const config = {
  matcher: [
    /*
      * Match all request paths except for the ones starting with:
      * - _next/static (static files)
      * - _next/image (image optimization files)
      * - favicon.ico (favicon file)
      * - login (login page)
      * - api/auth (auth routes)
      * - api/test (test routes)
      */
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/test).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const sessionCookie = await getSessionCookie(request);

  if (!sessionCookie) {
    const { pathname } = request.nextUrl;
    if (pathname === "/signup") {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
