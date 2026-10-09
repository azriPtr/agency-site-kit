/**
 * POST /api/enquiry: the enquiry form's back end, deployed as a Vercel Function.
 *
 * Validates the enquiry and posts it to the client's team channel through a
 * Discord webhook (ENQUIRY_WEBHOOK_URL, set in Vercel, never in the repo).
 *
 * Works with and without JavaScript: the React form sends
 * `Accept: application/json` and gets JSON back. A plain form POST gets a 303
 * redirect to /enquiry-sent, or a short HTML page listing what to fix.
 *
 * Not built in: rate limiting and CAPTCHA. Spam protection is a honeypot field.
 * A client with real traffic needs one of the two before launch.
 */

const LIMITS = { name: 100, email: 200, room: 100, message: 2000 };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Enquiry {
  name: string;
  email: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  room: string;
  message: string;
  /** Honeypot. Hidden from people; bots fill it. */
  company: string;
}

export async function POST(request: Request): Promise<Response> {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const reply = (status: number, body: { ok: boolean; error?: string; errors?: Record<string, string> }) => {
    if (wantsJson) return Response.json(body, { status });
    if (body.ok) return Response.redirect(new URL('/enquiry-sent', request.url), 303);
    return errorPage(status, body.errors ? Object.values(body.errors) : [body.error ?? 'Something went wrong.'], backLink(request));
  };

  let enquiry: Enquiry;
  try {
    enquiry = await read(request);
  } catch {
    return reply(400, { ok: false, error: 'Could not read the form.' });
  }

  // A bot filled the hidden field. Answer as if it worked, send nothing.
  if (enquiry.company) return reply(200, { ok: true });

  const errors = validate(enquiry);
  if (Object.keys(errors).length) return reply(422, { ok: false, errors });

  const webhook = process.env.ENQUIRY_WEBHOOK_URL;
  if (!webhook) {
    console.error('ENQUIRY_WEBHOOK_URL is not set');
    return reply(503, { ok: false, error: 'Enquiries are not set up yet. Please email us instead.' });
  }

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(toDiscord(enquiry)),
  });
  if (!res.ok) {
    console.error(`Webhook returned ${res.status}`);
    return reply(502, { ok: false, error: 'We could not send your enquiry. Please email us instead.' });
  }

  return reply(200, { ok: true });
}

async function read(request: Request): Promise<Enquiry> {
  const type = request.headers.get('content-type') ?? '';
  const raw: Record<string, unknown> = type.includes('application/json')
    ? await request.json()
    : Object.fromEntries(await request.formData());
  const field = (key: keyof Enquiry) => String(raw[key] ?? '').trim();
  return {
    name: field('name'),
    email: field('email'),
    checkIn: field('checkIn'),
    checkOut: field('checkOut'),
    guests: field('guests'),
    room: field('room'),
    message: field('message'),
    company: field('company'),
  };
}

function validate(e: Enquiry): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!e.name) errors.name = 'Please tell us your name.';
  else if (e.name.length > LIMITS.name) errors.name = 'That name is too long.';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email) || e.email.length > LIMITS.email) {
    errors.email = 'Please check your email address.';
  }

  const today = new Date().toISOString().slice(0, 10);
  if (e.checkIn && (!DATE.test(e.checkIn) || e.checkIn < today)) errors.checkIn = 'Please choose a date from today on.';
  if (e.checkOut && (!DATE.test(e.checkOut) || (e.checkIn && e.checkOut <= e.checkIn))) {
    errors.checkOut = 'Check-out must be after check-in.';
  }

  if (e.guests && !/^([1-9]|1[0-2])$/.test(e.guests)) errors.guests = 'Guests must be between 1 and 12.';
  if (e.room.length > LIMITS.room) errors.room = 'Please choose a room from the list.';
  if (!e.message) errors.message = 'Please write a short message.';
  else if (e.message.length > LIMITS.message) errors.message = `Please keep it under ${LIMITS.message} characters.`;
  return errors;
}

function toDiscord(e: Enquiry) {
  const fields = [
    { name: 'Email', value: e.email, inline: true },
    e.checkIn && { name: 'Dates', value: `${e.checkIn} to ${e.checkOut || '?'}`, inline: true },
    e.guests && { name: 'Guests', value: e.guests, inline: true },
    e.room && { name: 'Room', value: e.room, inline: true },
  ].filter(Boolean);
  return {
    // Guests type free text; never let it ping @everyone or a role.
    allowed_mentions: { parse: [] },
    embeds: [{ title: `Enquiry from ${e.name}`, description: e.message, fields, timestamp: new Date().toISOString() }],
  };
}

/** The page the form was on, if it is on this site. */
function backLink(request: Request): string {
  const referer = request.headers.get('referer');
  if (referer && new URL(referer).origin === new URL(request.url).origin) return referer;
  return '/';
}

/** For visitors without JavaScript: what went wrong and a way back. */
function errorPage(status: number, messages: string[], back: string): Response {
  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const items = messages.map((m) => `<li>${escape(m)}</li>`).join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Please check your enquiry</title><body style="font:16px/1.6 system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem"><h1>Please check your enquiry</h1><ul>${items}</ul><p><a href="${escape(back)}">Go back to the form</a></p></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
