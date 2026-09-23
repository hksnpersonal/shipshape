/**
 * The frame every screen sits in: a header that says where you are, and navigation that
 * is a bottom bar on a phone and a side rail on a laptop.
 */
import { NavLink, Outlet, useParams } from 'react-router';
import {
  CalendarDays,
  FolderOpen,
  Home,
  Map,
  MoreHorizontal,
  Settings,
  Ticket,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Map;
  badge?: number;
}

function navItems(tripId: string | undefined): NavItem[] {
  if (!tripId) {
    return [
      { to: '/', label: 'Trips', icon: Map },
      { to: '/playbook', label: 'Playbook', icon: Ticket },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];
  }
  return [
    { to: `/t/${tripId}`, label: 'Home', icon: Home },
    { to: `/t/${tripId}/days`, label: 'Days', icon: CalendarDays },
    { to: `/t/${tripId}/bookings`, label: 'Bookings', icon: Ticket },
    { to: `/t/${tripId}/documents`, label: 'Documents', icon: FolderOpen },
    { to: '/settings', label: 'More', icon: MoreHorizontal },
  ];
}

export function AppShell() {
  const { tripId } = useParams();
  const items = navItems(tripId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex dark:bg-slate-900 dark:text-slate-100">
      <nav className="hidden w-56 shrink-0 border-r border-slate-200 p-4 md:block dark:border-slate-700">
        <p className="mb-6 px-2 text-lg font-bold">Shipshape</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === `/t/${tripId}` || item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )
                }
              >
                <item.icon size={18} aria-hidden />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24 md:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-800/95">
        <ul className="flex">
          {items.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === `/t/${tripId}` || item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                    isActive
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-slate-500 dark:text-slate-400',
                  )
                }
              >
                <item.icon size={20} aria-hidden />
                {item.label}
                {item.badge ? (
                  <span className="absolute top-1 right-1/4 rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
