import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        'sheet-overlay fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-[2px]',
        className,
      )}
      {...props}
    />
  );
}

interface SheetContentProps extends React.ComponentProps<typeof SheetPrimitive.Content> {
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const sideClasses = {
  left: 'sheet-content-left inset-y-0 left-0 h-full w-64 max-w-[85vw] border-r border-slate-800',
  right:
    'sheet-content-right inset-y-0 right-0 h-full w-64 max-w-[85vw] border-l border-slate-800',
  top: 'inset-x-0 top-0 border-b border-slate-800',
  bottom: 'inset-x-0 bottom-0 border-t border-slate-800',
};

export function SheetContent({
  side = 'right',
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-slate-900 shadow-2xl will-change-transform',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 z-10 rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 opacity-90 ring-offset-slate-950 transition-opacity hover:bg-slate-800 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
          <X className="h-4 w-4 text-slate-300" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />;
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn('text-base font-semibold text-white', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn('text-sm text-slate-400', className)}
      {...props}
    />
  );
}
