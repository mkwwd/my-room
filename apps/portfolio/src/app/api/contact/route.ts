import { NextResponse } from 'next/server';

import { isContactRecipient } from '@/lib/contactRecipients';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';

  return value.trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
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
    const toEmail = cleanText(data.to, 120);
    const email = cleanText(data.email, 120);
    const subject =
      cleanText(data.subject, 120) || 'New message from My Room portfolio';
    const message = cleanText(data.message, 2000);

    let provider = 'unknown'; // 기본값 설정

    if (toEmail.endsWith('gmail.com')) {
      provider = 'gmail';
    } else if (toEmail.endsWith('naver.com')) {
      provider = 'naver';
    }

    if (!isContactRecipient(toEmail)) {
      return NextResponse.json(
        { message: 'Please select a valid recipient.' },
        { status: 400 },
      );
    }

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

    const text = [`Email: ${email}`, '', message].join('\n');

    if (provider === 'gmail') {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: 'Contact Form <onboarding@resend.dev>',
        to: [toEmail],
        replyTo: email,
        subject: subject,
        text: text,
      });

      if (error) {
        return NextResponse.json(
          { message: `Resend 에러: ${error.message}` },
          { status: 500 },
        );
      }
    } else if (provider === 'naver') {
      const transporter = nodemailer.createTransport({
        service: '://naver,com',
        host: 'smtp.naver.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.NAVER_USER,
          pass: process.env.NAVER_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.NAVER_USER,
        to: toEmail,
        replyTo: email,
        subject: subject,
        text: text,
      });
    } else {
      return NextResponse.json(
        { error: '지원하지 않는 이메일 도메인입니다.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('메일 서버 내부 오류', err);
    return NextResponse.json(
      { message: err.message || '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
