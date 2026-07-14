// Shown instantly on navigation while page.tsx streams in (Next.js Suspense
// fallback — see loading.js file convention). No params/data fetch available
// here, so theme colors come from the CSS vars the parent [slug]/layout.tsx
// already sets from the real site record (--color-primary/secondary/accent).
export default function Loading() {
  return (
    <div className="animate-pulse">
      <section
        className="relative flex min-h-[420px] items-center overflow-hidden md:min-h-[480px]"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="h-4 w-64 rounded bg-white/20" />
          <div className="mt-6 h-11 w-3/4 max-w-xl rounded bg-white/25 md:h-12" />
          <div className="mt-4 h-5 w-1/2 max-w-md rounded bg-white/15" />
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <div className="h-12 w-40 rounded-full bg-white/25" />
            <div className="h-12 w-40 rounded-full border-2 border-white/20" />
          </div>
        </div>

        <div
          className="absolute bottom-6 right-6 h-9 w-9 animate-spin rounded-full border-[3px] border-white/25"
          style={{ borderTopColor: 'var(--color-accent)' }}
          aria-label="Loading"
          role="status"
        />
      </section>

      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="h-7 w-48 rounded bg-gray-200" />
        <div className="mt-5 space-y-3">
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-5/6 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--color-secondary)' }} className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto h-7 w-48 rounded bg-white/50" />
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-white/60" />
                <div className="mt-5 h-4 w-28 rounded bg-white/50" />
                <div className="mt-3 h-3 w-full max-w-[10rem] rounded bg-white/40" />
                <div className="mt-2 h-3 w-3/4 max-w-[8rem] rounded bg-white/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
