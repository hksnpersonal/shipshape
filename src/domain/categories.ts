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
    tone: 'bg-[#ece5f4] text-[#6a4c93] dark:bg-[#6a4c93]/40 dark:text-[#e3d6f5]',
  },
  transport: {
    label: 'Transport',
    plural: 'Transport',
    icon: TrainFront,
    tone: 'bg-[#e2ebf4] text-[#2b5a87] dark:bg-[#2b5a87]/40 dark:text-[#cfe0f2]',
  },
  activity: {
    label: 'Sightseeing',
    plural: 'Sightseeing',
    icon: Landmark,
    tone: 'bg-[#f5e9d6] text-[#94591a] dark:bg-[#94591a]/40 dark:text-[#f3dcb8]',
  },
  food: {
    label: 'Food',
    plural: 'Food and drink',
    icon: UtensilsCrossed,
    tone: 'bg-[#f5e2e7] text-[#983a52] dark:bg-[#983a52]/40 dark:text-[#f3cfd9]',
  },
  shopping: {
    label: 'Shopping',
    plural: 'Shopping',
    icon: ShoppingBag,
    tone: 'bg-[#e3efe2] text-[#3e6b3a] dark:bg-[#3e6b3a]/40 dark:text-[#d2ead0]',
  },
  pass: {
    label: 'Pass',
    plural: 'Passes and cards',
    icon: IdCard,
    tone: 'bg-[#ddedec] text-[#1f5c5b] dark:bg-[#1f5c5b]/40 dark:text-[#cde8e6]',
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
