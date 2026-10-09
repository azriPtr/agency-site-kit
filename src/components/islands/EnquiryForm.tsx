import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

/**
 * Enquiry form, rendered on the server and hydrated when it scrolls into view.
 *
 * Without JavaScript it is a plain form that POSTs to /api/enquiry and lands
 * on /enquiry-sent. With JavaScript it sends JSON, shows field errors from the
 * server inline, and preselects the room from ?room= (the RoomList links).
 */
interface Props {
  rooms: { id: string; name: string }[];
  action?: string;
  email: string;
}

type Status = { state: 'idle' | 'sending' | 'sent' } | { state: 'error'; message: string };

const field =
  'mt-1 block w-full min-h-11 rounded-card border border-line bg-card px-3 py-2 text-ink aria-[invalid=true]:border-red-700';
const label = 'text-sm font-medium';

export default function EnquiryForm({ rooms, action = '/api/enquiry', email }: Props) {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [room, setRoom] = useState('');
  const [today, setToday] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('room');
    const match = rooms.find((r) => r.id === wanted);
    if (match) setRoom(match.name);
    setToday(new Date().toISOString().slice(0, 10));
  }, [rooms]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ state: 'sending' });
    setErrors({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (body.ok) setStatus({ state: 'sent' });
      else {
        setErrors(body.errors ?? {});
        setStatus({ state: 'error', message: body.error ?? 'Please check the highlighted fields.' });
      }
    } catch {
      setStatus({ state: 'error', message: `We could not send your enquiry. Please email ${email}.` });
    }
    statusRef.current?.focus();
  }

  if (status.state === 'sent') {
    return (
      <p ref={statusRef} tabIndex={-1} role="status" className="lead">
        Thank you. Your enquiry has reached the team, and they will reply by email.
      </p>
    );
  }

  const describe = (name: string) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {};
  const error = (name: string) =>
    errors[name] && (
      <span id={`${name}-error`} className="mt-1 block text-sm text-red-700">
        {errors[name]}
      </span>
    );

  return (
    <form action={action} method="post" onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-1">
        <span className={label}>Name</span>
        <input name="name" required autoComplete="name" className={field} {...describe('name')} />
        {error('name')}
      </label>
      <label className="sm:col-span-1">
        <span className={label}>Email</span>
        <input name="email" type="email" required autoComplete="email" className={field} {...describe('email')} />
        {error('email')}
      </label>
      <label>
        <span className={label}>Check-in</span>
        <input name="checkIn" type="date" min={today || undefined} className={field} {...describe('checkIn')} />
        {error('checkIn')}
      </label>
      <label>
        <span className={label}>Check-out</span>
        <input name="checkOut" type="date" min={today || undefined} className={field} {...describe('checkOut')} />
        {error('checkOut')}
      </label>
      <label>
        <span className={label}>Guests</span>
        <input name="guests" type="number" min={1} max={12} inputMode="numeric" className={field} {...describe('guests')} />
        {error('guests')}
      </label>
      <label>
        <span className={label}>Room</span>
        <select name="room" value={room} onChange={(e) => setRoom(e.target.value)} className={field}>
          <option value="">No preference</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className={label}>Message</span>
        <textarea name="message" required rows={5} maxLength={2000} className={field} {...describe('message')} />
        {error('message')}
      </label>
      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={status.state === 'sending'}
          className="inline-flex min-h-11 items-center rounded-btn bg-brand px-6 text-sm font-medium text-onaccent hover:bg-brand-hover disabled:opacity-60"
        >
          {status.state === 'sending' ? 'Sending…' : 'Send enquiry'}
        </button>
        <p ref={statusRef} tabIndex={-1} role="status" className="text-sm text-ink-muted">
          {status.state === 'error' ? status.message : ''}
        </p>
      </div>
    </form>
  );
}
