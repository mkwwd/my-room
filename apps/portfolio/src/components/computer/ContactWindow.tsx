'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { Mail, Send } from 'lucide-react';

import { CONTACT_EMAIL, desktopIcons } from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';

type ContactStatus = 'idle' | 'sending' | 'sent' | 'fallback' | 'error';

function buildMailtoUrl({
  to,
  name,
  email,
  subject,
  message,
}: {
  to: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const body = [
    `Name: ${name || 'Not provided'}`,
    `Email: ${email || 'Not provided'}`,
    '',
    message,
  ].join('\n');

  return `mailto:${to}?subject=${encodeURIComponent(
    subject || 'New message from My Room',
  )}&body=${encodeURIComponent(body)}`;
}

export default function ContactWindow({
  isActive,
  onActivate,
  onClose,
}: {
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const contactIcon = desktopIcons.find((icon) => icon.id === 'contact');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Hello from My Room');
  const [message, setMessage] = useState('');
  const [fallbackEmail, setFallbackEmail] = useState(CONTACT_EMAIL);
  const [status, setStatus] = useState<ContactStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const sendWithMailApp = () => {
    if (!fallbackEmail.trim()) {
      setStatus('error');
      setStatusMessage(
        'Set NEXT_PUBLIC_CONTACT_EMAIL or type a recipient email first.',
      );
      return;
    }

    window.location.href = buildMailtoUrl({
      to: fallbackEmail.trim(),
      name,
      email,
      subject,
      message,
    });
    setStatus('fallback');
    setStatusMessage('Opening your mail app to finish sending.');
  };

  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setStatusMessage('Sending message...');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
        }),
      });

      if (response.ok) {
        setStatus('sent');
        setStatusMessage('Message sent. Thank you!');
        setMessage('');
        return;
      }

      if (response.status === 503) {
        sendWithMailApp();
        return;
      }

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus('error');
      setStatusMessage(data?.message ?? 'Unable to send right now.');
    } catch {
      sendWithMailApp();
    }
  };

  return (
    <article
      className={`absolute top-[64px] left-[245px] h-[460px] w-[640px] overflow-hidden rounded-sm border-2 ${
        isActive
          ? 'z-[4] border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.38)]'
          : 'z-[2] border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.24)]'
      } bg-[#19131d] text-white`}
      onPointerDown={onActivate}
      aria-label="Contact email window">
      <div className="flex h-9 items-center justify-between border-b-2 border-[#1f1a20] bg-[#211b26] px-3">
        <div className="flex items-center gap-2 text-sm font-black">
          {contactIcon ? (
            <DesktopIconGraphic icon={contactIcon} size="taskbar" />
          ) : (
            <Mail className="h-5 w-5" />
          )}
          <span>Contact Mail</span>
        </div>
        <button
          type="button"
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-sm border border-white/35 bg-[#5b405c] text-sm leading-none font-black text-white transition-colors duration-200 hover:bg-[#7e557e] focus-visible:bg-[#7e557e]"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close Contact window">
          x
        </button>
      </div>

      <form
        className="grid h-[calc(100%-36px)] grid-rows-[auto_1fr_auto] bg-[#100e13]"
        onSubmit={submitContact}>
        <div className="grid gap-3 border-b border-white/10 bg-[#17131d] p-4">
          {!CONTACT_EMAIL ? (
            <label className="grid gap-1 text-xs font-black text-[#d8d1e8]">
              To
              <input
                value={fallbackEmail}
                onChange={(event) => setFallbackEmail(event.target.value)}
                className="h-9 rounded-sm border border-[#3a3145] bg-[#0d0b10] px-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/32 focus:border-[#f2d17a]"
                placeholder="your-email@example.com"
                type="email"
              />
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-black text-[#d8d1e8]">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-9 rounded-sm border border-[#3a3145] bg-[#0d0b10] px-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/32 focus:border-[#f2d17a]"
                placeholder="Your name"
                maxLength={80}
              />
            </label>
            <label className="grid gap-1 text-xs font-black text-[#d8d1e8]">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-9 rounded-sm border border-[#3a3145] bg-[#0d0b10] px-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/32 focus:border-[#f2d17a]"
                placeholder="you@example.com"
                type="email"
                maxLength={120}
                required
              />
            </label>
          </div>

          <label className="grid gap-1 text-xs font-black text-[#d8d1e8]">
            Subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-9 rounded-sm border border-[#3a3145] bg-[#0d0b10] px-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/32 focus:border-[#f2d17a]"
              placeholder="Subject"
              maxLength={120}
              required
            />
          </label>
        </div>

        <label className="grid min-h-0 gap-1 p-4 text-xs font-black text-[#d8d1e8]">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-0 flex-1 resize-none rounded-sm border border-[#3a3145] bg-[#0d0b10] p-3 text-sm leading-relaxed text-white outline-none transition-colors duration-200 placeholder:text-white/32 focus:border-[#f2d17a]"
            placeholder="Write your message..."
            maxLength={2000}
            required
          />
        </label>

        <div className="flex h-14 items-center justify-between border-t border-white/10 bg-[#17131d] px-4">
          <p
            className={`text-xs font-bold ${
              status === 'error'
                ? 'text-[#ff9eb0]'
                : status === 'sent'
                  ? 'text-[#9ef2c3]'
                  : 'text-[#d8d1e8]'
            }`}>
            {statusMessage || 'Ready to send.'}
          </p>
          <button
            type="submit"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-[#f2d17a] bg-[#f2d17a] px-4 text-sm font-black text-[#18110c] transition-colors duration-200 hover:bg-[#ffe595] focus-visible:bg-[#ffe595] disabled:cursor-wait disabled:opacity-70"
            disabled={status === 'sending'}>
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </article>
  );
}
