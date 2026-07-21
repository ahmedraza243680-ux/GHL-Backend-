'use client';

import { useEffect, useState } from 'react';
import { darkenHex, getTextColor } from '@/src/lib/theme';

type SiteLoaderProps = {
  businessName: string;
  primaryColor: string;
  accentColor: string;
  tagline?: string;
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

/**
 * Full-screen branded splash shown on the initial (hard) page load.
 *
 * It is rendered inside the persistent site layout, so it appears in the SSR
 * HTML and covers the page from the first paint (no flash of content) and,
 * because the layout is not remounted on client-side navigation, it only shows
 * once when a visitor first opens the site — not on every internal page change.
 *
 * Dismissal waits for the page to finish loading, but is bounded by a minimum
 * display time (so it never just flickers) and a maximum cap (so a slow asset
 * can never leave a visitor staring at the loader).
 */
export function SiteLoader({
  businessName,
  primaryColor,
  accentColor,
  tagline,
}: SiteLoaderProps) {
  const [phase, setPhase] = useState<'visible' | 'hiding' | 'done'>('visible');

  useEffect(() => {
    const MIN_MS = 700;
    const MAX_MS = 2500;
    const FADE_MS = 500;
    const start = performance.now();
    let finished = false;
    let hideTimer = 0;
    let removeTimer = 0;

    function finish() {
      if (finished) return;
      finished = true;
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_MS - elapsed);
      hideTimer = window.setTimeout(() => {
        setPhase('hiding');
        removeTimer = window.setTimeout(() => setPhase('done'), FADE_MS);
      }, wait);
    }

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
    }
    const cap = window.setTimeout(finish, MAX_MS);

    return () => {
      window.removeEventListener('load', finish);
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
      window.clearTimeout(cap);
    };
  }, []);

  useEffect(() => {
    if (phase === 'done') return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [phase]);

  if (phase === 'done') return null;

  const background = `linear-gradient(135deg, ${primaryColor}, ${darkenHex(primaryColor, 0.28)})`;
  const initials = getInitials(businessName);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity ease-out ${
        phase === 'hiding' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background, transitionDuration: '500ms' }}
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-4 border-white/15 motion-reduce:animate-none"
          style={{
            borderTopColor: accentColor,
            borderRightColor: accentColor,
            animationDuration: '900ms',
          }}
        />
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black shadow-lg"
          style={{ backgroundColor: accentColor, color: getTextColor(accentColor) }}
        >
          {initials}
        </span>
      </div>
      <p className="mt-6 animate-pulse text-xl font-bold tracking-tight text-white motion-reduce:animate-none">
        {businessName}
      </p>
      {tagline ? <p className="mt-1 text-sm text-white/70">{tagline}</p> : null}
    </div>
  );
}
