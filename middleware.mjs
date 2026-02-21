import { next } from '@vercel/functions';

export const config = {
  matcher: [
    '/',
    '/index.html',
    '/rdysl-callup-checker.html',
    '/hilton-heat.html',
    '/hilton-heat-v2.html',
    '/calendar.html',
  ],
};

export default function middleware(request) {
  const cookies = parseCookies(request.headers.get('cookie') || '');

  if (cookies['hh_access']) {
    return next();
  }

  const url = new URL(request.url);
  const loginUrl = new URL('/login.html', request.url);
  loginUrl.searchParams.set('from', url.pathname);
  return Response.redirect(loginUrl.toString(), 302);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });
  return cookies;
}
