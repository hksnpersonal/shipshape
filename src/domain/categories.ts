/**
 * The handful of categories a traveller actually thinks in.
 *
 * Booking kinds and item types are precise for the linter and the playbook, but nobody
 * scanning a phone on a platform thinks "international-train" or "transfer". Every screen
 * groups, labels and colours by these instead, so a hotel looks like a hotel everywhere.
 */
import {
  BedDouble,
  IdCard,
  Landmark,
  ShoppingBag,
  StickyNote,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { BookingKind, ItemType } from './types';

export type Category = 'stay' | 'transport' | 'activity' | 'food' | 'shopping' | 'pass' | 'note';

export interface CategoryMeta {
  /** Singular, e.g. on a chip beside one row. */
  label: string;
  /** Section and filter heading. */
  plural: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon badge, readable in light and dark. */
  tone: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  stay: {
    label: 'Hotel',
    plural: 'Hotels',
    icon: BedDouble,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
  },
  transport: {
    label: 'Transport',
    plural: 'Transport',
    icon: TrainFront,
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200',
  },
  activity: {
    label: 'Sightseeing',
    plural: 'Sightseeing',
    icon: Landmark,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  },
  food: {
    label: 'Food',
    plural: 'Food and drink',
    icon: UtensilsCrossed,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
  },
  shopping: {
    label: 'Shopping',
    plural: 'Shopping',
    icon: ShoppingBag,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
  pass: {
    label: 'Pass',
    plural: 'Passes and cards',
    icon: IdCard,
    tone: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-200',
  },
  note: {
    label: 'Note',
    plural: 'Notes and to-dos',
    icon: StickyNote,
    tone: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
  },
};

/** Display order for grouped lists: the things you can't miss first. */
export const CATEGORY_ORDER: Category[] = [
  'transport',
  'stay',
  'activity',
  'food',
  'pass',
  'shopping',
  'note',
];

const BOOKING_CATEGORY: Record<BookingKind, Category> = {
  flight: 'transport',
  train: 'transport',
  'regional-train': 'transport',
  'international-train': 'transport',
  ferry: 'transport',
  bus: 'transport',
  // Mountain railways and gondolas are the outing itself, not a way of getting somewhere.
  'mountain-railway': 'activity',
  gondola: 'activity',
  attraction: 'activity',
  hotel: 'stay',
  restaurant: 'food',
  pass: 'pass',
  'city-card': 'pass',
  other: 'note',
};

const ITEM_CATEGORY: Record<ItemType, Category> = {
  transport: 'transport',
  transfer: 'transport',
  sight: 'activity',
  meal: 'food',
  shop: 'shopping',
  admin: 'note',
  reminder: 'note',
  freeform: 'note',
};

export const bookingCategory = (kind: BookingKind): Category => BOOKING_CATEGORY[kind];
export const itemCategory = (type: ItemType): Category => ITEM_CATEGORY[type];
