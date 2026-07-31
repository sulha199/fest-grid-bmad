import { http, HttpResponse, type HttpHandler } from 'msw';

export const handlers: HttpHandler[] = [
  http.get('https://api.example.com/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),
];
