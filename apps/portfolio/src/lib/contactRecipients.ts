export const CONTACT_RECIPIENTS = [
  'mkwhwkdud@naver.com',
  'mkwhwkdud@gmail.com',
] as const;

export type ContactRecipient = (typeof CONTACT_RECIPIENTS)[number];

export function isContactRecipient(value: string): value is ContactRecipient {
  return CONTACT_RECIPIENTS.some((recipient) => recipient === value);
}
