/**
 * The frame every screen sits in: four tabs that answer the four questions a traveller has.
 * Today (what now), Trip (where am I in it), Wallet (where is my ticket), More (everything
 * else). A bottom bar on a phone, a side rail on a laptop.
 */
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { Map, MoreHorizontal, Settings, Sun, Ticket, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Map;
  /** Whether this tab owns the current screen, including screens reached from inside it. */
  owns: (path: string) => boolean;
}

function navItems(tripId: string | undefined): NavItem[] {
  if (!tripId) {
    return [
      { to: '/', label: 'Trips', icon: Map, owns: (p) => p === '/' },
      { to: '/playbook', label: 'Playbook', icon: Ticket, owns: (p) => p.startsWith('/playbook') },
      { to: '/settings', label: 'Settings', icon: Settings, owns: (p) => p === '/settings' },
    ];
  }
  const base = `/t/${tripId}`;
  return [
    {
      to: `${base}/today`,
      label: 'Today',
      icon: Sun,
      owns: (p) => /\/(today|days\/[^/]+|items\/[^/]+)$/.test(p),
    },
    {
      to: base,
      label: 'Trip',
      icon: Map,
      owns: (p) => p === base || p === `${base}/days` || p === `${base}/guide`,
    },
    {
      to: `${base}/bookings`,
      label: 'Wallet',
      icon: Wallet,
      owns: (p) => p.startsWith(`${base}/bookings`),
    },
    {
      to: `${base}/more`,
      label: 'More',
      icon: MoreHorizontal,
      owns: (p) =>
        ['/more', '/conflicts', '/documents', '/reminders', '/settings', '/playbook'].some((s) =>
          p.startsWith(`${base}${s}`),
        ),
    },
  ];
}

export function AppShell() {
  const { tripId } = useParams();
  const { pathname } = useLocation();
  const items = navItems(tripId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex dark:bg-slate-900 dark:text-slate-100">
      <nav
        aria-label="Main"
        className="hidden w-56 shrink-0 border-r border-slate-200 p-4 md:block dark:border-slate-700"
      >
        <p className="font-display mb-6 px-2 text-xl font-semibold">Shipshape</p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active = item.owns(pathname);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold',
                    active
                      ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <item.icon size={18} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-28 md:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-700 dark:bg-slate-800"
      >
        <ul className="flex">
          {items.map((item) => {
            const active = item.owns(pathname);
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]',
                    active
                      ? 'text-brand-600 dark:text-brand-300 font-bold'
                      : 'font-medium text-slate-500 dark:text-slate-400',
                  )}
                >
                  <item.icon size={22} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
