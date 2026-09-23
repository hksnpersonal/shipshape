import type { Trip, TravelPass } from '@/domain/types';
import { BK, DAY_DATES, PASS_SWISS, TRIP_ID, dayId } from './ids';

const TS = '2026-09-04T00:00:00.000Z';

export const swissTravelPass: TravelPass = {
  id: PASS_SWISS,
  name: 'Swiss Travel Pass',
  validFrom: DAY_DATES.d09,
  validTo: DAY_DATES.d16,
  notes:
    'Covers the Chiasso-Lucerne-Grindelwald-Basel legs and Rigi. Pilatus, Grindelwald First and the Oeschinen gondola are discounted, not free.',
  guideId: 'ch-swiss-travel-pass',
};

export const trip: Trip = {
  id: TRIP_ID,
  name: 'Europe 2026',
  travellers: 2,
  startDate: DAY_DATES.d00,
  // Home-to-home: the flight leaves Amsterdam on the 17th and lands in Sydney on the 18th.
  endDate: '2026-10-18',
  originName: 'Sydney, Australia',
  originTimeZone: 'Australia/Sydney',
  defaultTimeZone: 'Europe/Rome',
  baseCurrency: 'AUD',
  spendCurrencies: ['EUR', 'CHF'],
  countries: ['IT', 'CH', 'FR', 'BE', 'NL'],
  passes: [swissTravelPass],
  swapGroups: [
    {
      id: 'swap-lucerne-mountains',
      label: 'Lucerne mountain days',
      dayIds: [dayId('d10'), dayId('d11')],
      rule: 'Check the Mt Rigi webcam the evening before. If the Rigi summit is clouded, swap Rigi with Pilatus or move it later - the views are the whole point.',
    },
    {
      id: 'swap-grindelwald-weather',
      label: 'Grindelwald weather days',
      dayIds: [dayId('d13'), dayId('d14'), dayId('d15')],
      rule: 'On arrival in Grindelwald check the 3-day forecast. Clearest day goes to Oeschinensee and the Rodelbahn, second clearest to Grindelwald First, cloudiest to Lauterbrunnen and Wengen.',
    },
  ],
  sourceNote:
    "Built from the traveller's raw notes. The original used colour coding: yellow = needs checking, blue = optional, red = must do. Those became the CHECK, OPTIONAL and MUST tags. Statements that disagree are kept and tagged CONFLICT rather than silently fixed.",
  createdAt: TS,
  updatedAt: TS,
};

/** Bookings referenced by the weather-swap rules, for the UI to link to. */
export const SWAP_RELATED_BOOKINGS = [
  BK.pilatusGoldenRound,
  BK.rigiRoundTrip,
  BK.firstGondola,
  BK.oeschinenGondola,
  BK.blausee,
] as const;
