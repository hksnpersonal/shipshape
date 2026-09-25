/**
 * Grindelwald to Paris, the Paris days, the Brussels day trip, Amsterdam, and the flight
 * home.
 *
 * This stretch carries most of the contradictions in the source notes. Every one of them
 * is preserved here, tagged, rather than tidied away.
 */
import type { Day, Item } from '@/domain/types';
import { BK, PASS_SWISS, PLACES } from './ids';
import { buildDay, buildItems, hours } from './helpers';

const d16: Day = buildDay('d16', {
  city: 'Paris',
  countryCode: 'FR',
  theme: 'Grindelwald to Paris',
  originalLabel: 'DAY 15',
});

const i16: Item[] = buildItems('d16', [
  {
    title: 'Wake, check out, breakfast',
    type: 'admin',
    time: '07:00',
    location: PLACES.hotelCentralWalter,
  },
  {
    title: 'Walk to Grindelwald station',
    type: 'transfer',
    time: '09:00',
    durationMins: 3,
    travel: {
      mode: 'walk',
      from: PLACES.hotelCentralWalter,
      to: PLACES.grindelwaldBahnhof,
      durationMins: 3,
    },
  },
  {
    title: 'Train to Interlaken Ost',
    type: 'transport',
    time: '09:17',
    timeEnd: '09:52',
    travel: {
      mode: 'train',
      from: PLACES.grindelwaldBahnhof,
      to: PLACES.interlakenOst,
      durationMins: 35,
      passCoverage: 'covered',
      passId: PASS_SWISS,
    },
  },
  {
    title: 'Train to Basel SBB',
    type: 'transport',
    time: '10:04',
    timeEnd: '12:04',
    tags: ['CHECK'],
    travel: {
      mode: 'train',
      from: PLACES.interlakenOst,
      to: PLACES.baselSbb,
      durationMins: 120,
      passCoverage: 'covered',
      passId: PASS_SWISS,
    },
    notes:
      'The notes give two hours and then about thirty minutes before the 12:34 TGV. Verify the exact connection. The TGV can be exchanged, but only for a fee this close to departure.',
  },
  {
    title: 'TGV Lyria to Paris',
    type: 'transport',
    time: '12:34',
    timeEnd: '15:40',
    bookingId: BK.tgvBslPar,
    pinnedToDate: true,
    travel: {
      mode: 'train',
      from: PLACES.baselSbb,
      to: PLACES.parisGareDeLyon,
      durationMins: 183,
      operator: 'TGV Lyria',
    },
  },
  {
    title: 'Metro to the hotel',
    type: 'transfer',
    durationMins: 24,
    travel: {
      mode: 'metro',
      from: PLACES.parisGareDeLyon,
      to: PLACES.parisGareDuNord,
      via: [PLACES.chatelet],
      durationMins: 24,
      line: 'Line 14 then Line 4',
    },
  },
  {
    title: 'Check in and rest',
    type: 'admin',
    time: '16:30',
    durationMins: 30,
    location: PLACES.hotelFlanelles,
    notes: 'Freshen up and rest for half an hour.',
  },
  {
    title: 'Notre-Dame Cathedral',
    type: 'sight',
    time: '17:30',
    location: PLACES.notreDame,
    notes: 'Exterior, 16 minutes away.',
  },
  { title: 'Pont Neuf at sunset', type: 'sight', location: PLACES.pontNeuf },
  { title: 'Seine river banks', type: 'sight', location: PLACES.seineBanks },
]);

const d17: Day = buildDay('d17', {
  city: 'Paris',
  countryCode: 'FR',
  theme: 'Historic Paris and the Louvre',
  originalLabel: 'DAY 15, duplicated in the source notes',
});

const i17: Item[] = buildItems('d17', [
  { title: 'Wake and breakfast', type: 'admin', time: '07:30', location: PLACES.hotelFlanelles },
  {
    title: 'Metro to Palais Royal',
    type: 'transfer',
    time: '08:30',
    timeEnd: '08:50',
    travel: {
      mode: 'metro',
      from: PLACES.parisGareDuNord,
      to: PLACES.palaisRoyalLouvre,
      durationMins: 20,
      line: 'Line 1 or Line 14',
    },
  },
  {
    title: 'Louvre courtyard and glass pyramid',
    type: 'sight',
    location: PLACES.louvreCourtyard,
    tags: ['CHECK'],
    notes:
      'The notes leave 08:50 to 10:20 unaccounted for. Exterior photographs here are the implied activity but were never given a time.',
  },
  {
    title: 'Walk to the Tuileries',
    type: 'transfer',
    time: '10:20',
    durationMins: 5,
    travel: {
      mode: 'walk',
      from: PLACES.louvreCourtyard,
      to: PLACES.jardinTuileries,
      durationMins: 5,
    },
  },
  { title: 'Jardin des Tuileries', type: 'sight', location: PLACES.jardinTuileries },
  { title: 'Place de la Concorde', type: 'sight', time: '11:15', location: PLACES.placeConcorde },
  {
    title: 'Metro to Charles de Gaulle Etoile',
    type: 'transfer',
    time: '11:45',
    timeEnd: '11:55',
    travel: {
      mode: 'metro',
      from: PLACES.placeConcorde,
      to: PLACES.cdgEtoile,
      durationMins: 10,
      line: 'Line 1',
    },
  },
  { title: 'Arc de Triomphe', type: 'sight', location: PLACES.arcDeTriomphe },
  {
    title: 'Carette at Trocadero',
    type: 'meal',
    time: '14:15',
    location: PLACES.carette,
    tags: ['OPTIONAL'],
    orderNotes: ['Signature hot chocolate', 'Pastries'],
  },
  {
    title: 'Trocadero',
    type: 'sight',
    time: '15:00',
    location: PLACES.trocadero,
    notes: 'The best view of the Eiffel Tower.',
  },
  {
    title: 'La Grande Epicerie de Paris',
    type: 'shop',
    location: PLACES.grandeEpicerie,
    orderNotes: ['French chocolates', 'Gourmet souvenirs', 'Gifts to bring home'],
    notes: 'The notes place this today or tomorrow.',
  },
]);

const d18: Day = buildDay('d18', {
  city: 'Paris',
  countryCode: 'FR',
  theme: 'Photo spots and a food day',
  originalLabel: 'DAY 16',
});

const i18: Item[] = buildItems('d18', [
  { title: 'Breakfast and pastries', type: 'meal', time: '08:00' },
  {
    title: 'Metro to Saint-Germain-des-Pres',
    type: 'transfer',
    time: '09:00',
    timeEnd: '09:20',
    travel: {
      mode: 'metro',
      from: PLACES.parisGareDuNord,
      to: PLACES.saintGermainDesPres,
      durationMins: 20,
      line: 'Line 4',
    },
  },
  {
    title: 'Les Deux Magots',
    type: 'meal',
    location: PLACES.lesDeuxMagots,
    orderNotes: ['Traditional hot chocolate or chocolat viennois', 'Croissant'],
  },
  {
    title: 'Jardin du Luxembourg',
    type: 'sight',
    time: '10:00',
    location: PLACES.jardinLuxembourg,
  },
  {
    title: 'Metro to Montparnasse',
    type: 'transfer',
    time: '12:30',
    tags: ['OPTIONAL'],
    travel: {
      mode: 'metro',
      from: PLACES.saintGermainDesPres,
      to: PLACES.montparnasse,
      durationMins: 10,
    },
    notes: 'Only worth the trip if you want cheese fondue. Otherwise plan something else.',
  },
  {
    title: 'Lunch at Les Fondus de la Raclette',
    type: 'meal',
    location: PLACES.lesFondusRaclette,
    orderNotes: ['Raclette'],
  },
  {
    title: 'Trocadero',
    type: 'sight',
    time: '14:30',
    groupLabel: 'Photo route',
    location: PLACES.trocadero,
    tags: ['CHECK'],
    notes:
      'No metro leg is listed between lunch in the 14th and this stop. It is roughly 25 minutes on Line 6.',
  },
  {
    title: 'Avenue de Camoens',
    type: 'sight',
    groupLabel: 'Photo route',
    location: PLACES.avenueCamoens,
    notes: 'Eight minutes on foot from Trocadero.',
  },
  {
    title: 'Port de Debilly',
    type: 'sight',
    groupLabel: 'Photo route',
    location: PLACES.portDeDebilly,
    notes: 'Ten minutes on foot.',
  },
  {
    title: "Pont d'Iena",
    type: 'sight',
    groupLabel: 'Photo route',
    location: PLACES.pontIena,
    tags: ['OPTIONAL'],
    notes: 'A quick stop, then 15 minutes along the Seine.',
  },
  {
    title: 'Pont Alexandre III',
    type: 'sight',
    groupLabel: 'Photo route',
    location: PLACES.pontAlexandreIii,
  },
  {
    title: "Jardin d'Erevan",
    type: 'sight',
    groupLabel: 'Photo route',
    location: PLACES.jardinErevan,
    notes: 'Five minutes on foot.',
  },
  {
    title: "Pont de l'Alma",
    type: 'sight',
    groupLabel: 'Photo route',
    location: PLACES.pontAlma,
    notes: 'Eight minutes on foot.',
  },
  {
    title: "Dinner at L'Auberge Aveyronnaise",
    type: 'meal',
    time: '19:00',
    bookingId: BK.aubergeAveyronnaise,
    location: PLACES.aubergeAveyronnaise,
    orderNotes: ['Aligot', 'Sausage or duck confit'],
  },
  {
    title: 'Early train tomorrow, buy snacks tonight',
    type: 'shop',
    tags: ['MUST'],
  },
]);

const d19: Day = buildDay('d19', {
  city: 'Brussels',
  countryCode: 'BE',
  theme: 'Brussels day trip',
  originalLabel: 'DAY 17',
});

const i19: Item[] = buildItems('d19', [
  { title: 'Wake and breakfast', type: 'admin', time: '05:20', location: PLACES.hotelFlanelles },
  {
    title: 'Walk to Paris Gare du Nord',
    type: 'transfer',
    time: '06:20',
    durationMins: 3,
    travel: {
      mode: 'walk',
      from: PLACES.hotelFlanelles,
      to: PLACES.parisGareDuNord,
      durationMins: 3,
    },
  },
  {
    title: 'Eurostar to Brussels Midi',
    type: 'transport',
    time: '06:49',
    timeEnd: '08:14',
    bookingId: BK.eurostarParBru,
    pinnedToDate: true,
    tags: ['CONFLICT'],
    travel: {
      mode: 'train',
      from: PLACES.parisGareDuNord,
      to: PLACES.brusselsMidi,
      durationMins: 120,
      operator: 'Eurostar',
    },
    notes:
      'The notes label this two hours. The booked times are 1 h 25. The stated duration is kept as written so the disagreement is visible.',
  },
  {
    title: 'Metro to the Grand Place',
    type: 'transfer',
    time: '09:30',
    tags: ['CHECK'],
    travel: {
      mode: 'metro',
      from: PLACES.brusselsMidi,
      to: PLACES.grandPlace,
      durationMins: 10,
      alternatives: ['About 20 minutes on foot'],
    },
    notes:
      'The train arrives at 08:14 and nothing happens until 09:30. Either something belongs in that gap or the metro should leave earlier.',
  },
  {
    title: 'Grand Place',
    type: 'sight',
    groupLabel: 'Brussels route',
    location: PLACES.grandPlace,
  },
  {
    title: 'Galeries Royales Saint-Hubert',
    type: 'sight',
    groupLabel: 'Brussels route',
    location: PLACES.galeriesRoyales,
  },
  {
    title: 'Manneken Pis',
    type: 'sight',
    groupLabel: 'Brussels route',
    location: PLACES.mannekenPis,
  },
  { title: 'Belgian waffle stop', type: 'meal', groupLabel: 'Brussels route' },
  {
    title: 'Chocolate shopping',
    type: 'shop',
    groupLabel: 'Brussels route',
    location: PLACES.galeriesRoyales,
    notes: 'Leave time to walk back to Bruxelles-Midi for the 13:13 train, about 20 minutes.',
  },
  {
    title: 'Train back to Paris',
    type: 'transport',
    time: '13:13',
    timeEnd: '14:35',
    bookingId: BK.eurostarBruPar,
    travel: {
      mode: 'train',
      from: PLACES.brusselsMidi,
      to: PLACES.parisGareDuNord,
      durationMins: 82,
      operator: 'Eurostar',
    },
    notes: 'Booked. Be at Bruxelles-Midi by 12:53. Arrives Paris Gare du Nord 14:35.',
  },
  { title: 'Dinner, then back to the hotel', type: 'meal' },
  { title: "Buy food for tomorrow's train ride", type: 'shop', tags: ['MUST'] },
]);

const d20: Day = buildDay('d20', {
  city: 'Amsterdam',
  countryCode: 'NL',
  theme: 'Paris to Amsterdam',
  originalLabel: 'DAY 18',
});

const i20: Item[] = buildItems('d20', [
  {
    title: 'Decide whether the Amsterdam City Card is worth it',
    type: 'reminder',
    tags: ['CHECK'],
    bookingId: BK.amsterdamCityCard,
    notes:
      'Three days was the idea. Add up the entry prices of the museums you will actually visit before buying.',
  },
  {
    title: 'Breakfast, check out, buy food for the train',
    type: 'admin',
    time: '07:30',
    location: PLACES.hotelFlanelles,
  },
  {
    title: 'Walk to Paris Gare du Nord',
    type: 'transfer',
    time: '08:30',
    durationMins: 3,
    travel: {
      mode: 'walk',
      from: PLACES.hotelFlanelles,
      to: PLACES.parisGareDuNord,
      durationMins: 3,
    },
  },
  {
    title: 'Eurostar to Amsterdam Centraal',
    type: 'transport',
    time: '09:20',
    timeEnd: '12:50',
    bookingId: BK.eurostarParAms,
    pinnedToDate: true,
    travel: {
      mode: 'train',
      from: PLACES.parisGareDuNord,
      to: PLACES.amsterdamCentraal,
      durationMins: 206,
      operator: 'Eurostar',
      seatSide: 'left',
      seatSideNote: 'Sit on the left leaving Paris.',
    },
  },
  {
    title: 'Arrive Amsterdam Centraal',
    type: 'transport',
    time: '12:45',
    tags: ['CONFLICT'],
    location: PLACES.amsterdamCentraal,
    travel: { mode: 'train', from: PLACES.parisGareDuNord, to: PLACES.amsterdamCentraal },
    notes: 'A stale line. The booked arrival is 12:50.',
  },
  {
    title: 'Travel to the hotel and leave luggage',
    type: 'transfer',
    durationMins: 15,
    travel: {
      mode: 'metro',
      from: PLACES.amsterdamCentraal,
      to: PLACES.europaplein,
      durationMins: 15,
    },
  },
  { title: 'Light lunch', type: 'meal', time: '13:45', notes: 'The apple pie comes later.' },
  {
    title: 'Metro to Dam Square',
    type: 'transfer',
    time: '15:00',
    durationMins: 17,
    travel: {
      mode: 'metro',
      from: PLACES.europaplein,
      to: PLACES.damSquare,
      durationMins: 17,
    },
  },
  { title: 'Dam Square', type: 'sight', location: PLACES.damSquare },
  {
    title: 'Van Stapele Koekmakerij',
    type: 'meal',
    time: '15:30',
    location: PLACES.vanStapele,
    tags: ['MUST'],
    notes: 'Walk towards Rokin. The cookies sell out very fast.',
  },
  {
    title: 'Cafe Papeneiland',
    type: 'meal',
    time: '16:15',
    location: PLACES.cafePapeneiland,
    orderNotes: ['Apple pie'],
    notes: 'An earlier version of the notes used Cafe Winkel 43 instead.',
  },
  { title: 'Jordaan and the Nine Streets', type: 'sight', time: '17:00', location: PLACES.jordaan },
  { title: 'Walk to the Canal Belt', type: 'sight', time: '17:30', location: PLACES.canalBelt },
  { title: 'Prinsengracht', type: 'sight', time: '18:00', location: PLACES.prinsengracht },
  { title: 'Keizersgracht', type: 'sight', time: '18:20', location: PLACES.keizersgracht },
  { title: 'Herengracht', type: 'sight', time: '18:40', location: PLACES.herengracht },
  { title: 'Dinner, free choice', type: 'meal' },
]);

const d21: Day = buildDay('d21', {
  city: 'Amsterdam',
  countryCode: 'NL',
  theme: 'Windmills, the market and a canal cruise',
  originalLabel: 'DAY 19',
});

const i21: Item[] = buildItems('d21', [
  {
    title: 'Light breakfast',
    type: 'meal',
    time: '07:30',
    notes: 'You will be eating snacks all day.',
  },
  {
    title: 'Walk to Europaplein station',
    type: 'transfer',
    time: '08:15',
    durationMins: 16,
    travel: {
      mode: 'metro',
      from: PLACES.nhowRai,
      to: PLACES.amsterdamCentraal,
      durationMins: 16,
    },
  },
  {
    title: 'Train to Zaandijk Zaanse Schans',
    type: 'transport',
    time: '08:40',
    timeEnd: '09:01',
    tags: ['CHECK'],
    travel: {
      mode: 'metro',
      from: PLACES.amsterdamCentraal,
      to: PLACES.zaandijkZaanseSchans,
      durationMins: 21,
      operator: 'NS',
    },
    notes:
      'The notes call this a metro. It is a national railway service and leaves from the main platforms. The mode is left as written so the app can flag it.',
  },
  {
    title: 'Bus to Zaanse Schans',
    type: 'transfer',
    time: '09:10',
    durationMins: 10,
    travel: {
      mode: 'bus',
      from: PLACES.zaandijkZaanseSchans,
      to: PLACES.zaanseSchans,
      durationMins: 10,
    },
  },
  { title: 'Explore Zaanse Schans', type: 'sight', time: '09:20', location: PLACES.zaanseSchans },
  {
    title: 'Lunch at a traditional Dutch cafe',
    type: 'meal',
    location: PLACES.zaanseSchans,
    orderNotes: ['Small Dutch pancakes'],
  },
  {
    title: 'Albert Cuyp Market',
    type: 'sight',
    time: '13:30',
    timeEnd: '14:30',
    location: PLACES.albertCuyp,
    tags: ['CHECK'],
    notes:
      'No return journey from Zaanse Schans is allocated, and it is the better part of an hour back into the city.',
  },
  {
    title: 'Stroopwafel at the market',
    type: 'meal',
    location: PLACES.albertCuyp,
    tags: ['CONFLICT'],
    openingHours: hours('Mon 09:00-17:00'),
    orderNotes: ['Goudse stroopwafels'],
    notes:
      "RUDI's Original Stroopwafels is noted as Monday only, but 16 October is a Friday. Goudse stroopwafels is the fallback.",
  },
  {
    title: 'Kibbeling and herring',
    type: 'meal',
    time: '14:30',
    location: PLACES.albertCuyp,
    orderNotes: ['Kibbeling', 'Herring with onion and pickles'],
  },
  {
    title: 'Canal cruise',
    type: 'transport',
    time: '15:30',
    timeEnd: '16:30',
    location: PLACES.canalCruisePier,
    bookingId: BK.canalCruise,
    travel: {
      mode: 'boat',
      from: PLACES.canalCruisePier,
      to: PLACES.canalCruisePier,
      durationMins: 60,
    },
  },
  {
    title: 'Bloemenmarkt',
    type: 'shop',
    time: '17:00',
    location: PLACES.bloemenmarkt,
    orderNotes: ['Tulip bulbs', 'Dutch souvenirs'],
  },
  {
    title: 'Farewell Indonesian dinner',
    type: 'meal',
    time: '18:00',
    location: PLACES.tokoBersama,
    notes: 'Toko Bersama, or Warung Spang Makandra.',
  },
]);

const d22: Day = buildDay('d22', {
  city: 'Amsterdam',
  countryCode: 'NL',
  theme: 'Fly home',
  originalLabel: 'DAY 20',
});

const i22: Item[] = buildItems('d22', [
  { title: 'Wake up', type: 'admin', time: '07:00', location: PLACES.nhowRai },
  {
    title: 'Check out of the hotel',
    type: 'admin',
    time: '09:45',
    location: PLACES.nhowRai,
    tags: ['CHECK'],
    notes:
      'The notes say check out and travel to the airport in one line, with no journey time. Confirm the train from RAI or Europaplein.',
  },
  {
    title: 'Be at the airport at least four hours before departure',
    type: 'reminder',
    tags: ['MUST'],
    notes:
      'VAT refund processing if applicable, baggage drop, passport control and security. That means Schiphol by 10:15.',
  },
  {
    title: 'Last-minute shopping at Schiphol',
    type: 'shop',
    location: PLACES.schiphol,
    notes: "An earlier version of the notes specified Tony's Chocolonely.",
  },
  {
    title: 'Thai Airways to Sydney',
    type: 'transport',
    time: '14:15',
    bookingId: BK.flightAmsSyd,
    pinnedToDate: true,
    location: PLACES.schiphol,
    travel: { mode: 'flight', from: PLACES.schiphol, to: PLACES.sydAirport },
  },
]);

export const daysSixteenToTwentyTwo: Day[] = [d16, d17, d18, d19, d20, d21, d22];
export const itemsSixteenToTwentyTwo: Item[] = [
  ...i16,
  ...i17,
  ...i18,
  ...i19,
  ...i20,
  ...i21,
  ...i22,
];
