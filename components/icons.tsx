export type IconProps = {
  className?: string;
};

export function HomeIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

export function SearchIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3" stroke="currentColor" strokeWidth="1.8" /><path d="m16.2 16.2 4.3 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function HeartIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

export function TrashIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function BagIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function ArrowLeftIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function InstagramIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.5" cy="6.7" r="1" fill="currentColor" /></svg>;
}

export function WhatsAppIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 20.5 11.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.3 7.7c.3-.4.7-.3.9-.1l1.1 1.5c.2.3.1.6-.1.9l-.6.7c.7 1.4 1.8 2.5 3.3 3.2l.7-.8c.2-.3.6-.3.9-.1l1.6 1c.3.2.4.5.2.8-.5 1-1.4 1.5-2.5 1.4-3.2-.4-6.1-3.2-6.5-6.4-.1-.8.2-1.6 1-2.1Z" fill="currentColor" /></svg>;
}

export function MapPinIcon({ className }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10c0 5.7-8 11-8 11S4 15.7 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
