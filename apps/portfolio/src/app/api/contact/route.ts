import { NextResponse } from 'next/server';

const RESEND_API_URL = 'https://api.resend.com/emails';

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';

  return value.trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: 'Invalid contact payload.' },
      { status: 400 },
    );
  }

  const data = payload as Record<string, unknown>;
  const name = cleanText(data.name, 80);
  const email = cleanText(data.email, 120);
  const subject =
    cleanText(data.subject, 120) || 'New message from My Room portfolio';
  const message = cleanText(data.message, 2000);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { message: 'Please enter a valid email address.' },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { message: 'Please write a message before sending.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL ??
    'My Room Portfolio <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    return NextResponse.json(
      { message: 'Contact email service is not configured.' },
      { status: 503 },
    );
  }

  const text = [
    `Name: ${name || 'Not provided'}`,
    `Email: ${email}`,
    '',
    message,
  ].join('\n');

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { message: 'Email provider could not send the message.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
