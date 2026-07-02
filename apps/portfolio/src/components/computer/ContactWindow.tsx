'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { AlertTriangle, CheckCircle2, Mail, Send } from 'lucide-react';

import { CONTACT_RECIPIENTS } from '@/lib/contactRecipients';

import { desktopIcons } from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';
import WindowControls from './WindowControls';

type ContactStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactWindow({
  isActive,
  isMaximized,
  onActivate,
  onMinimize,
  onToggleMaximize,
  onClose,
}: {
  isActive: boolean;
  isMaximized: boolean;
  onActivate: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  const contactIcon = desktopIcons.find((icon) => icon.id === 'contact');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState<string>(CONTACT_RECIPIENTS[0]);
  const [status, setStatus] = useState<ContactStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const dismissError = () => {
    setStatus('idle');
    setStatusMessage('');
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
          to: recipient,
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

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus('error');
      setStatusMessage(data?.message ?? 'Unable to send right now.');
    } catch {
      setStatus('error');
      setStatusMessage('Unable to connect to the email service.');
    }
  };

  return (
    <article
      className={`absolute top-[64px] left-[245px] h-[460px] w-[640px] overflow-hidden rounded-sm border-2 ${
        isActive
          ? 'z-[4] border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.38)]'
          : 'z-[2] border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.24)]'
      } bg-[#19131d] text-white`}
      style={isMaximized ? { top: 0, left: 0, width: '100%', height: '100%' } : undefined}
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
        <WindowControls
          appName="Contact"
          isMaximized={isMaximized}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
        />
      </div>

      {status === 'sent' ? (
        <section className="grid h-[calc(100%-36px)] place-items-center bg-[#100e13] p-8 text-center">
          <div className="flex max-w-sm flex-col items-center">
            <div className="mb-5 grid h-20 w-20 place-items-center rounded-sm border-2 border-[#9ef2c3] bg-[#173329] shadow-[6px_6px_0_#0a1712]">
              <CheckCircle2
                className="h-10 w-10 text-[#9ef2c3]"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-2xl font-black text-[#f5f0da]">
              Message sent!
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#d8d1e8]">
              Your message was delivered successfully.
            </p>
            <button
              type="button"
              className="mt-7 h-10 cursor-pointer rounded-sm border border-[#f2d17a] bg-[#f2d17a] px-6 text-sm font-black text-[#18110c] transition-colors duration-200 hover:bg-[#ffe595] focus-visible:bg-[#ffe595] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f0da]"
              onClick={onClose}>
              Close
            </button>
          </div>
        </section>
      ) : (
        <form
          className="grid h-[calc(100%-36px)] grid-rows-[auto_1fr_auto] bg-[#100e13]"
          onSubmit={submitContact}>
        <div className="grid gap-3 border-b border-white/10 bg-[#17131d] p-4">
          <label className="grid gap-1 text-xs font-black text-[#d8d1e8]">
            To
            <select
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              className="h-9 cursor-pointer rounded-sm border border-[#3a3145] bg-[#0d0b10] px-3 text-sm text-white outline-none transition-colors duration-200 focus:border-[#f2d17a]">
              {CONTACT_RECIPIENTS.map((emailAddress) => (
                <option key={emailAddress} value={emailAddress}>
                  {emailAddress}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-black text-[#d8d1e8]">
            From
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
            <p className="text-xs font-bold text-[#d8d1e8]">
              {status === 'sending' ? 'Sending message...' : 'Ready to send.'}
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
      )}

      {status === 'error' ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/45 p-6">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="contact-error-title"
            aria-describedby="contact-error-message"
            className="w-full max-w-[360px] overflow-hidden rounded-sm border-2 border-[#f5f0da] bg-[#19131d] shadow-[8px_8px_0_rgba(8,6,10,0.8)]">
            <div className="flex h-9 items-center justify-between border-b-2 border-[#1f1a20] bg-[#5b405c] px-3">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="h-4 w-4 text-[#ffd36a]"
                  aria-hidden="true"
                />
                <h2 id="contact-error-title" className="text-sm font-black">
                  Message not sent
                </h2>
              </div>
              <button
                type="button"
                className="grid h-6 w-6 cursor-pointer place-items-center rounded-sm border border-white/35 bg-[#392a39] text-sm leading-none font-black transition-colors duration-200 hover:bg-[#7e557e] focus-visible:bg-[#7e557e]"
                onClick={dismissError}
                aria-label="Close error message">
                x
              </button>
            </div>
            <div className="p-5">
              <p
                id="contact-error-message"
                className="text-sm leading-relaxed text-[#f5dce1]">
                {statusMessage || 'Unable to send right now.'}
              </p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  autoFocus
                  className="h-9 min-w-20 cursor-pointer rounded-sm border border-[#f2d17a] bg-[#f2d17a] px-4 text-sm font-black text-[#18110c] transition-colors duration-200 hover:bg-[#ffe595] focus-visible:bg-[#ffe595] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f0da]"
                  onClick={dismissError}>
                  OK
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
