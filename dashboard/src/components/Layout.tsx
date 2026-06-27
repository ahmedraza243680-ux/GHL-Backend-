import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

export function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-full bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800 bg-slate-900 lg:block">
        <AppSidebar className="h-full" />
      </aside>

      <div className="flex min-h-full w-full flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="gap-0 p-0">
                <AppSidebar
                  className="h-full"
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <div className="inline-flex max-w-full rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 sm:px-4 sm:text-sm">
                <span className="truncate">Peakwa Admin Dashboard</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
