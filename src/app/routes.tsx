import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { BookingDetailPage, BookingsBoardPage } from '@/features/BookingPages';
import { DayTimelinePage, ItemDetailPage } from '@/features/DayPages';
import { DocumentsVaultPage } from '@/features/DocumentPages';
import { ConflictInboxPage, RemindersPage, SettingsPage } from '@/features/InboxPages';
import { PlaybookDetailPage, PlaybookIndexPage } from '@/features/PlaybookPages';
import {
  DaysIndexPage,
  TodayRedirectPage,
  TripHomePage,
  TripsListPage,
} from '@/features/TripPages';

/**
 * The base path is read from the build rather than hard-coded, so the same bundle works
 * at a subdirectory on GitHub Pages and at the root anywhere else.
 */
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <TripsListPage /> },
        { path: 't/:tripId', element: <TripHomePage /> },
        { path: 't/:tripId/today', element: <TodayRedirectPage /> },
        { path: 't/:tripId/days', element: <DaysIndexPage /> },
        { path: 't/:tripId/days/:dayId', element: <DayTimelinePage /> },
        { path: 't/:tripId/items/:itemId', element: <ItemDetailPage /> },
        { path: 't/:tripId/bookings', element: <BookingsBoardPage /> },
        { path: 't/:tripId/bookings/:bookingId', element: <BookingDetailPage /> },
        { path: 't/:tripId/conflicts', element: <ConflictInboxPage /> },
        { path: 't/:tripId/reminders', element: <RemindersPage /> },
        { path: 't/:tripId/documents', element: <DocumentsVaultPage /> },
        { path: 'playbook', element: <PlaybookIndexPage /> },
        { path: 'playbook/:guideId', element: <PlaybookDetailPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
