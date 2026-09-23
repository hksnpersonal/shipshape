/**
 * Departure day through the Lake Como day trip: Sydney, Rome, Florence, Pisa, Venice,
 * Milan and the lake.
 *
 * Lines that contradict a booking are kept and tagged CONFLICT rather than corrected.
 * That is the point of the app.
 */
import type { Day, Item } from '@/domain/types';
import { BK, PLACES } from './ids';
import { buildDay, buildItems, hours } from './helpers';

const d00: Day = buildDay('d00', {
  city: 'Sydney',
  countryCode: 'AU',
  timeZone: 'Australia/Sydney',
  theme: 'Fly out',
  notes: 'Departure from Sydney. The notes do not record a departure time.',
});

const i00: Item[] = buildItems('d00', [
  {
    title: 'Fly Sydney to Rome',
    type: 'transport',
    bookingId: BK.flightSydRom,
    pinnedToDate: true,
    travel: { mode: 'flight', from: PLACES.sydAirport, to: PLACES.fco },
    tags: ['CHECK'],
    notes:
      'The source notes give the arrival at Fiumicino as 14:10 on 26 September but never record the departure time or the flight number. Fill both in from the ticket.',
  },
]);

const d01: Day = buildDay('d01', {
  city: 'Rome',
  countryCode: 'IT',
  theme: 'Arrival and a romantic Rome evening',
});

const i01: Item[] = buildItems('d01', [
  {
    title: 'Arrive Rome Fiumicino',
    type: 'transport',
    time: '14:10',
    location: PLACES.fco,
    bookingId: BK.flightSydRom,
    pinnedToDate: true,
    travel: { mode: 'flight', from: PLACES.sydAirport, to: PLACES.fco },
  },
  {
    title: 'Immigration and luggage',
    type: 'admin',
    time: '14:10',
    timeEnd: '15:30',
    location: PLACES.fco,
    notes: 'Estimated in the notes rather than measured.',
  },
  {
    title: 'Leonardo Express to Roma Termini',
    type: 'transport',
    time: '15:45',
    timeApprox: true,
    durationMins: 32,
    travel: {
      mode: 'train',
      from: PLACES.fco,
      to: PLACES.romaTermini,
      durationMins: 32,
      operator: 'Trenitalia',
    },
  },
  {
    title: 'Termini to the hotel',
    type: 'transfer',
    durationMins: 14,
    travel: {
      mode: 'metro',
      from: PLACES.romaTermini,
      to: PLACES.hotelVisconti,
      durationMins: 14,
    },
  },
  {
    title: 'Arrive at Hotel Visconti Suites',
    type: 'admin',
    time: '17:00',
    timeApprox: true,
    location: PLACES.hotelVisconti,
  },
  {
    title: 'Metro Ottaviano to Barberini',
    type: 'transfer',
    groupLabel: 'Evening walking route',
    durationMins: 19,
    travel: {
      mode: 'metro',
      from: PLACES.metroOttaviano,
      to: PLACES.metroBarberini,
      durationMins: 19,
      line: 'Metro A',
    },
  },
  {
    title: 'Trevi Fountain',
    type: 'sight',
    groupLabel: 'Evening walking route',
    location: PLACES.treviFountain,
    cost: { amount: 0, currency: 'EUR' },
  },
  {
    title: 'Pantheon',
    type: 'sight',
    groupLabel: 'Evening walking route',
    location: PLACES.pantheon,
    notes: 'Exterior only in this plan.',
  },
  {
    title: "All'Antico Vinaio",
    type: 'meal',
    groupLabel: 'Evening walking route',
    location: PLACES.anticoVinaioRome,
    tags: ['OPTIONAL'],
    durationMins: 2,
    notes: 'Two minutes from the Pantheon. The alternative in the notes is a pasta place nearby.',
  },
  {
    title: "La Casa del Caffe Tazza d'Oro",
    type: 'meal',
    groupLabel: 'Evening walking route',
    time: '17:30',
    timeApprox: true,
    location: PLACES.tazzaDoro,
    openingHours: hours('07:00-20:00'),
    orderNotes: ['Crema di caffe'],
    notes: 'Four minutes from the Pantheon. Arrive between 17:30 and 18:00.',
  },
  {
    title: 'Two Sizes Tiramisu',
    type: 'meal',
    groupLabel: 'Evening walking route',
    location: PLACES.twoSizes,
    tags: ['OPTIONAL'],
    orderNotes: ['Classic tiramisu', 'Pistachio tiramisu'],
    notes: 'The notes suggest moving this to day 3 instead. It appears on three days in total.',
  },
  {
    title: 'Galleria Doria Pamphilj',
    type: 'sight',
    groupLabel: 'Evening walking route',
    location: PLACES.doriaPamphilj,
    openingHours: hours('Mon-Sat 09:00-19:00'),
    tags: ['CHECK'],
    notes:
      'The notes flag this as an outside or view-only stop depending on opening time, and separately list the gallery again on day 3. Pick one.',
  },
  {
    title: "Chiesa di Sant'Ignazio di Loyola",
    type: 'sight',
    groupLabel: 'Evening walking route',
    location: PLACES.santIgnazio,
    bookingId: BK.santIgnazio,
    notes: 'The mirror below the false dome.',
  },
  {
    title: 'Bus back to the hotel',
    type: 'transfer',
    durationMins: 23,
    travel: {
      mode: 'bus',
      from: {
        key: 'it-rome-bus-senato',
        name: 'Senato',
        kind: 'bus-stop',
        city: 'Rome',
        countryCode: 'IT',
      },
      to: {
        key: 'it-rome-bus-leone-iv',
        name: 'Leone IV',
        kind: 'bus-stop',
        city: 'Rome',
        countryCode: 'IT',
      },
      durationMins: 23,
    },
  },
]);

const d02: Day = buildDay('d02', {
  city: 'Rome',
  countryCode: 'IT',
  theme: 'Ancient Rome and the Borghese',
});

const i02: Item[] = buildItems('d02', [
  {
    title: 'Hotel to the Colosseum',
    type: 'transfer',
    timeLabel: 'morning',
    durationMins: 30,
    travel: {
      mode: 'metro',
      from: PLACES.metroOttaviano,
      to: PLACES.metroColosseo,
      durationMins: 30,
    },
    notes: 'The notes give 19 to 30 minutes by metro, or 22 minutes by taxi.',
  },
  { title: 'Colosseum', type: 'sight', location: PLACES.colosseum, notes: 'Exterior only.' },
  {
    title: 'Roman Forum viewpoint',
    type: 'sight',
    location: PLACES.romanForum,
    notes: 'Exterior viewpoint rather than entry.',
  },
  {
    title: 'Musei Capitolini',
    type: 'sight',
    location: PLACES.museiCapitolini,
    bookingId: BK.museiCapitolini,
    cost: {
      amount: 24,
      currency: 'EUR',
      per: 'person',
      note: 'Recorded as about 24 dollars in the notes.',
    },
    notes: 'Going inside, for the best view over the Forum.',
  },
  {
    title: 'Bus to Roscioli',
    type: 'transfer',
    durationMins: 14,
    travel: { mode: 'bus', from: PLACES.museiCapitolini, to: PLACES.roscioli, durationMins: 14 },
  },
  {
    title: 'Lunch at Roscioli Salumeria con Cucina',
    type: 'meal',
    time: '12:30',
    timeEnd: '14:00',
    location: PLACES.roscioli,
    bookingId: BK.roscioli,
    pinnedToDate: true,
    orderNotes: [
      'Carbonara',
      'Cacio e pepe if available',
      'Salumi and cured meats',
      'Their bread and wine selection',
    ],
  },
  {
    title: 'Two Sizes Tiramisu',
    type: 'meal',
    location: PLACES.twoSizes,
    durationMins: 20,
    notes: 'Eight minutes on foot from the restaurant.',
  },
  {
    title: 'Walk to Villa Borghese',
    type: 'transfer',
    durationMins: 24,
    travel: { mode: 'bus', from: PLACES.twoSizes, to: PLACES.villaBorghese, durationMins: 24 },
  },
  {
    title: 'Villa Borghese Gardens',
    type: 'sight',
    timeLabel: 'afternoon',
    location: PLACES.villaBorghese,
    notes: 'The gardens and the small lake, outdoors and free.',
  },
  {
    title: 'Galleria Borghese',
    type: 'sight',
    timeLabel: 'afternoon',
    location: PLACES.galleriaBorghese,
    bookingId: BK.galleriaBorghese,
    openingHours: hours('Tue-Sun 09:00-19:00, closed Mondays'),
    tags: ['MUST'],
    notes: 'Timed two-hour entry that sells out. Still to book.',
  },
  {
    title: 'Bus to Tropical Ice',
    type: 'transfer',
    durationMins: 13,
    travel: { mode: 'bus', from: PLACES.villaBorghese, to: PLACES.tropicalIce, durationMins: 13 },
  },
  { title: 'Tropical Ice Gelateria', type: 'meal', location: PLACES.tropicalIce },
  {
    title: 'Buy snacks tonight for the Vatican tomorrow',
    type: 'shop',
    tags: ['MUST'],
    notes: 'The Vatican morning starts at 07:00 with nothing open on the way.',
  },
]);

const d03: Day = buildDay('d03', {
  city: 'Rome',
  countryCode: 'IT',
  theme: 'Vatican and a hidden-Rome food day',
});

const i03: Item[] = buildItems('d03', [
  {
    title: 'Wear clothing that meets the Vatican dress code',
    type: 'reminder',
    tags: ['MUST'],
    notes: 'Shoulders and knees covered, for everyone. People are turned away for this daily.',
  },
  {
    title: 'Buy food and snacks before the Vatican',
    type: 'shop',
    tags: ['MUST'],
  },
  {
    title: 'Walk to Vatican City',
    type: 'transfer',
    timeLabel: 'morning',
    durationMins: 25,
    travel: { mode: 'walk', from: PLACES.hotelVisconti, to: PLACES.stPeters, durationMins: 25 },
    notes: 'Twenty-five minutes on foot, or twelve by taxi.',
  },
  {
    title: "St Peter's Basilica",
    type: 'sight',
    time: '07:00',
    location: PLACES.stPeters,
    cost: { amount: 0, currency: 'EUR' },
    notes: 'Free, opens at 07:00, and the queue is shortest right at opening.',
  },
  {
    title: 'Vatican Museums',
    type: 'sight',
    time: '08:00',
    timeEnd: '11:00',
    durationMins: 180,
    location: PLACES.vaticanMuseums,
    bookingId: BK.vaticanMuseums,
    pinnedToDate: true,
    notes: 'Booked. The museums open from 07:00 but this slot is 08:00.',
  },
  {
    title: 'Galleria Doria Pamphilj',
    type: 'sight',
    timeLabel: 'afternoon',
    durationMins: 90,
    location: PLACES.doriaPamphilj,
    openingHours: hours('10:00-19:00'),
    tags: ['CHECK'],
    notes: 'Listed here and again on day 1. Allow an hour to an hour and a half.',
  },
  {
    title: 'Piazza Navona',
    type: 'sight',
    location: PLACES.piazzaNavona,
    notes: 'Outdoors, with the four-rivers fountain.',
  },
  {
    title: 'Two Sizes Tiramisu',
    type: 'meal',
    location: PLACES.twoSizes,
    notes: 'Two minutes on foot from Piazza Navona. The third appearance of this stop.',
  },
  {
    title: 'Walk to dinner',
    type: 'transfer',
    durationMins: 18,
    travel: { mode: 'walk', from: PLACES.piazzaNavona, to: PLACES.daFabrizio, durationMins: 18 },
    notes: 'Eighteen minutes on foot, or twenty-two by bus.',
  },
  {
    title: 'Dinner at Da Fabrizio Al 56',
    type: 'meal',
    time: '19:00',
    location: PLACES.daFabrizio,
    bookingId: BK.daFabrizio,
    pinnedToDate: true,
    orderNotes: ['Fried meatball', 'Carbonara', 'Amatriciana'],
  },
]);

const d04: Day = buildDay('d04', {
  city: 'Florence',
  countryCode: 'IT',
  theme: 'Rome to Florence',
});

const i04: Item[] = buildItems('d04', [
  { title: 'Leave the hotel', type: 'admin', time: '07:45', location: PLACES.hotelVisconti },
  {
    title: 'Hotel to Roma Termini',
    type: 'transfer',
    durationMins: 15,
    travel: { mode: 'metro', from: PLACES.hotelVisconti, to: PLACES.romaTermini, durationMins: 15 },
  },
  {
    title: 'Frecciarossa to Florence',
    type: 'transport',
    time: '08:35',
    timeEnd: '10:11',
    bookingId: BK.frecciarossaRomFlr,
    pinnedToDate: true,
    travel: {
      mode: 'train',
      from: PLACES.romaTermini,
      to: PLACES.firenzeSmn,
      durationMins: 96,
      operator: 'Trenitalia',
    },
    notes:
      'The ticket confirms 08:35 to 10:11, the 1 h 36 m the notes gave. Frecciarossa 9490, no changes or refunds.',
  },
  {
    title: 'Walk to the hotel and store luggage',
    type: 'admin',
    time: '11:00',
    timeApprox: true,
    location: PLACES.hotelSantAntonino,
    notes: 'Luggage store from 11:00. Check-in is 14:00 or 15:00.',
  },
  {
    title: "Lunch at Panetteria e Stuzzicheria De' Neri 18R",
    type: 'meal',
    location: PLACES.deNeri,
    orderNotes: ['Homemade schiacciata Toscana'],
  },
  {
    title: 'Piazza della Signoria',
    type: 'sight',
    groupLabel: 'Free walk',
    location: PLACES.piazzaSignoria,
    cost: { amount: 0, currency: 'EUR' },
  },
  {
    title: 'Loggia dei Lanzi',
    type: 'sight',
    groupLabel: 'Free walk',
    location: PLACES.loggiaLanzi,
    cost: { amount: 0, currency: 'EUR' },
  },
  {
    title: 'Ponte Vecchio',
    type: 'sight',
    groupLabel: 'Free walk',
    location: PLACES.ponteVecchio,
    cost: { amount: 0, currency: 'EUR' },
  },
  {
    title: 'Brandy Melville for souvenirs',
    type: 'shop',
    location: PLACES.brandyMelville,
    cost: { amount: null, currency: 'EUR', note: 'T-shirts around EUR 20 to 30.' },
  },
  {
    title: 'Cathedral of Santa Maria del Fiore',
    type: 'sight',
    timeLabel: 'afternoon',
    location: PLACES.duomoFirenze,
    notes: 'Exterior, free.',
  },
  {
    title: 'Walk to Santa Maria Novella',
    type: 'transfer',
    durationMins: 7,
    travel: {
      mode: 'walk',
      from: PLACES.duomoFirenze,
      to: PLACES.santaMariaNovella,
      durationMins: 7,
    },
  },
  {
    title: 'Basilica of Santa Maria Novella',
    type: 'sight',
    location: PLACES.santaMariaNovella,
    notes: 'Photographs only.',
  },
  {
    title: 'Dinner at Osteria Pastella',
    type: 'meal',
    time: '19:00',
    timeEnd: '20:00',
    location: PLACES.osteriaPastella,
    bookingId: BK.osteriaPastella,
    pinnedToDate: true,
    orderNotes: ['Flambeed tagliatelle with truffle'],
    notes: 'Three minutes on foot from the basilica.',
  },
]);

const d05: Day = buildDay('d05', {
  city: 'Florence',
  countryCode: 'IT',
  theme: 'Pisa in the morning, Florence in the afternoon',
});

const i05: Item[] = buildItems('d05', [
  {
    title: 'Book Pilatus and check the Mt Rigi webcam',
    type: 'reminder',
    tags: ['MUST'],
    notes:
      'Pilatus wants booking three to five days out, after the mountain forecast is worth reading. Start watching the Rigi webcam now.',
  },
  {
    title: 'Buy the regional tickets in the station',
    type: 'shop',
    tags: ['MUST'],
    location: PLACES.firenzeSmn,
    notes:
      'A paper regional ticket must be stamped in a trackside machine before boarding. A ticket bought in the app is already validated.',
  },
  {
    title: 'Regional train to Pisa San Rossore',
    type: 'transport',
    time: '07:30',
    timeEnd: '08:54',
    bookingId: BK.regionalFlrPisa,
    travel: {
      mode: 'train',
      from: PLACES.firenzeSmn,
      to: PLACES.pisaSanRossore,
      durationMins: 84,
      operator: 'Trenitalia',
    },
    notes: 'The notes give 07:30 to 08:30 and separately about 1 h 24 m, which do not agree.',
    tags: ['CHECK'],
  },
  {
    title: 'Walk to Piazza dei Miracoli',
    type: 'transfer',
    durationMins: 10,
    travel: {
      mode: 'walk',
      from: PLACES.pisaSanRossore,
      to: PLACES.piazzaMiracoli,
      durationMins: 10,
    },
    notes: 'Follow the signs for the tower.',
  },
  {
    title: 'Leaning Tower of Pisa',
    type: 'sight',
    groupLabel: 'Pisa route, exteriors only',
    location: PLACES.leaningTower,
  },
  {
    title: 'Pisa Cathedral',
    type: 'sight',
    groupLabel: 'Pisa route, exteriors only',
    location: PLACES.pisaCathedral,
  },
  {
    title: 'Baptistery',
    type: 'sight',
    groupLabel: 'Pisa route, exteriors only',
    location: PLACES.pisaBaptistery,
  },
  {
    title: 'Camposanto',
    type: 'sight',
    groupLabel: 'Pisa route, exteriors only',
    location: PLACES.camposanto,
  },
  {
    title: 'Taxi to Pisa Centrale',
    type: 'transfer',
    durationMins: 10,
    travel: {
      mode: 'taxi',
      from: PLACES.piazzaMiracoli,
      to: PLACES.pisaCentrale,
      durationMins: 10,
    },
    notes:
      'Walk to the right side of the tower and wait at the red taxi sign. Buy the return at the Biglietteria kiosk inside Pisa Centrale.',
  },
  {
    title: 'Regional train back to Florence',
    type: 'transport',
    time: '11:30',
    timeEnd: '12:30',
    bookingId: BK.regionalPisaFlr,
    travel: {
      mode: 'train',
      from: PLACES.pisaCentrale,
      to: PLACES.firenzeSmn,
      durationMins: 60,
      operator: 'Trenitalia',
    },
    notes: 'The notes give departure 11:30 to 12:30 and arrival 12:30 to 13:30.',
  },
  {
    title: "Bus to Girone de' Ghiotti",
    type: 'transfer',
    durationMins: 13,
    travel: { mode: 'bus', from: PLACES.firenzeSmn, to: PLACES.gironeGhiotti, durationMins: 13 },
  },
  {
    title: "Lunch at Girone de' Ghiotti",
    type: 'meal',
    timeLabel: 'afternoon',
    location: PLACES.gironeGhiotti,
  },
  {
    title: 'Don Nino for dessert',
    type: 'meal',
    location: PLACES.donNino,
    orderNotes: ['Pistachio cannolo'],
    notes: 'Five minutes on foot from the sandwich shop.',
  },
  {
    title: 'Cathedral of Santa Maria del Fiore',
    type: 'sight',
    groupLabel: 'Florence afternoon route',
    location: PLACES.duomoFirenze,
    openingHours: hours('10:15-3:45'),
    tags: ['CHECK'],
    notes: 'The notes write the hours as 10:15-3:45, which is presumably 10:15 to 15:45.',
  },
  {
    title: 'Baptistery of St John',
    type: 'sight',
    groupLabel: 'Florence afternoon route',
    location: PLACES.battisteroFirenze,
    notes: 'Exterior, free.',
  },
  {
    title: 'Piazza della Signoria',
    type: 'sight',
    groupLabel: 'Florence afternoon route',
    location: PLACES.piazzaSignoria,
  },
  {
    title: 'Uffizi courtyard',
    type: 'sight',
    groupLabel: 'Florence afternoon route',
    location: PLACES.uffiziCourtyard,
  },
  {
    title: 'Sunset at Piazzale Michelangelo',
    type: 'sight',
    time: '19:00',
    timeApprox: true,
    location: PLACES.piazzaleMichelangelo,
    notes: 'Arrive 30 to 60 minutes before sunset.',
  },
]);

const d06: Day = buildDay('d06', {
  city: 'Venice',
  countryCode: 'IT',
  theme: 'Florence to Venice',
  originalLabel: 'Day 6',
});

const i06: Item[] = buildItems('d06', [
  {
    title: 'Italo to Venice',
    type: 'transport',
    time: '08:39',
    timeEnd: '10:55',
    bookingId: BK.italoFlrVce,
    pinnedToDate: true,
    travel: {
      mode: 'train',
      from: PLACES.firenzeSmn,
      to: PLACES.veneziaSantaLucia,
      durationMins: 150,
      operator: 'Italo',
    },
  },
  {
    title: 'Leave luggage at Hotel Casa Marsilli',
    type: 'admin',
    location: PLACES.hotelCasaMarsilli,
  },
  {
    title: 'Rialto Bridge',
    type: 'sight',
    groupLabel: 'Free sights',
    location: PLACES.rialtoBridge,
  },
  {
    title: 'Piazza San Marco',
    type: 'sight',
    groupLabel: 'Free sights',
    location: PLACES.piazzaSanMarco,
    openingHours: hours('open 24 h'),
  },
  {
    title: "St Mark's Basilica",
    type: 'sight',
    groupLabel: 'Free sights',
    location: PLACES.stMarksBasilica,
    notes: 'Exterior.',
  },
  {
    title: "Doge's Palace",
    type: 'sight',
    groupLabel: 'Free sights',
    location: PLACES.dogesPalace,
    notes: 'Exterior.',
  },
  {
    title: 'Bridge of Sighs',
    type: 'sight',
    groupLabel: 'Free sights',
    location: PLACES.bridgeOfSighs,
  },
  {
    title: 'Gondola ride',
    type: 'transport',
    time: '16:30',
    timeEnd: '17:30',
    location: PLACES.gondolaPier,
    bookingId: BK.gondolaVenice,
    cost: {
      amount: 90,
      currency: 'EUR',
      per: 'group',
      note: 'Daytime rate, private to your group, per gondola rather than per person.',
    },
    travel: { mode: 'gondola', from: PLACES.gondolaPier, to: PLACES.gondolaPier, durationMins: 60 },
    notes: 'The notes pick this hour for the light.',
  },
  { title: 'Dinner, free choice', type: 'meal' },
  {
    title: "Buy snacks for tomorrow's train",
    type: 'shop',
    tags: ['MUST'],
    notes: 'A two-hour train in the morning, leaving the hotel at 07:00.',
  },
]);

const d07: Day = buildDay('d07', {
  city: 'Milan',
  countryCode: 'IT',
  theme: 'Venice to Milan',
  originalLabel: 'Day 6, duplicated in the source notes',
});

const i07: Item[] = buildItems('d07', [
  {
    title: 'Wake, breakfast and check out',
    type: 'admin',
    time: '06:00',
    location: PLACES.hotelCasaMarsilli,
    notes: 'The notes also say check out around 08:00, which the 07:00 departure supersedes.',
    tags: ['CONFLICT'],
  },
  {
    title: 'Leave the Venice hotel for the station',
    type: 'transfer',
    time: '07:00',
    durationMins: 30,
    travel: {
      mode: 'walk',
      from: PLACES.hotelCasaMarsilli,
      to: PLACES.veneziaSantaLucia,
      durationMins: 30,
      alternatives: ['Water bus, 19 minutes'],
    },
  },
  {
    title: 'High-speed train to Milan',
    type: 'transport',
    time: '07:57',
    timeEnd: '10:25',
    bookingId: BK.hsVceMil,
    pinnedToDate: true,
    travel: {
      mode: 'train',
      from: PLACES.veneziaSantaLucia,
      to: PLACES.milanoCentrale,
      durationMins: 148,
    },
  },
  {
    title: 'Drop luggage at the hotel',
    type: 'admin',
    location: PLACES.hotelCentralStationMilan,
  },
  {
    title: 'Metro M3 to the Duomo',
    type: 'transfer',
    durationMins: 13,
    travel: {
      mode: 'metro',
      from: PLACES.metroCentraleFs,
      to: PLACES.metroDuomoMilano,
      durationMins: 13,
      line: 'M3 yellow',
    },
    notes: 'An earlier version of the notes gave this as 10 minutes.',
  },
  {
    title: 'Piazza del Duomo',
    type: 'sight',
    location: PLACES.piazzaDuomoMilano,
  },
  {
    title: 'Duomo di Milano',
    type: 'sight',
    durationMins: 40,
    location: PLACES.duomoMilano,
    cost: { amount: 0, currency: 'EUR' },
    notes: 'Exterior, 30 to 45 minutes. Photographs of the front facade and the square.',
  },
  {
    title: 'Galleria Vittorio Emanuele II',
    type: 'sight',
    location: PLACES.galleriaVittorio,
    notes: 'Two minutes from the Duomo.',
  },
  {
    title: 'Traditional Milanese dinner',
    type: 'meal',
    orderNotes: ['Risotto alla Milanese', 'Cotoletta alla Milanese', 'Ossobuco'],
  },
  {
    title: 'Sleep early, big scenic day tomorrow',
    type: 'reminder',
    tags: ['MUST'],
  },
]);

const d08: Day = buildDay('d08', {
  city: 'Varenna',
  countryCode: 'IT',
  theme: 'Lake Como day trip',
  originalLabel: 'Day 7',
});

const i08: Item[] = buildItems('d08', [
  {
    title: 'Walk to Milano Centrale',
    type: 'transfer',
    time: '07:00',
    durationMins: 7,
    travel: {
      mode: 'walk',
      from: PLACES.hotelCentralStationMilan,
      to: PLACES.milanoCentrale,
      durationMins: 7,
    },
  },
  {
    title: 'Train to Varenna-Esino',
    type: 'transport',
    time: '07:30',
    timeEnd: '08:30',
    bookingId: BK.regionalMilVarenna,
    travel: {
      mode: 'train',
      from: PLACES.milanoCentrale,
      to: PLACES.varennaEsino,
      durationMins: 60,
      operator: 'Trenord',
    },
    notes:
      'The notes give an hour but also an arrival of 09:00 to 09:30, which does not follow from a 07:30 departure.',
    tags: ['CHECK'],
  },
  {
    title: 'Passeggiata degli Innamorati',
    type: 'sight',
    groupLabel: 'Varenna, 09:30 to 12:00',
    location: PLACES.passeggiataInnamorati,
  },
  {
    title: 'Varenna old village',
    type: 'sight',
    groupLabel: 'Varenna, 09:30 to 12:00',
    location: PLACES.varennaOldVillage,
  },
  {
    title: 'Villa Monastero',
    type: 'sight',
    groupLabel: 'Varenna, 09:30 to 12:00',
    location: PLACES.villaMonastero,
    bookingId: BK.villaMonastero,
    openingHours: hours('~09:30-18:00 seasonal'),
  },
  {
    title: 'Ferry to Bellagio',
    type: 'transport',
    time: '12:00',
    timeApprox: true,
    bookingId: BK.comoFerries,
    travel: {
      mode: 'ferry',
      from: PLACES.varennaPier,
      to: PLACES.bellagioPier,
      durationMins: 15,
      operator: 'Navigazione Laghi',
      seasonalTimetable: true,
    },
  },
  {
    title: 'Bellagio old town',
    type: 'sight',
    groupLabel: 'Bellagio, 12:30 to 15:30',
    location: PLACES.bellagioOldTown,
    cost: { amount: 0, currency: 'EUR' },
    notes: 'Salita Serbelloni, the stone streets and the boutiques.',
  },
  {
    title: 'Punta Spartivento',
    type: 'sight',
    groupLabel: 'Bellagio, 12:30 to 15:30',
    location: PLACES.puntaSpartivento,
    cost: { amount: 0, currency: 'EUR' },
  },
  {
    title: 'Villa Melzi Gardens',
    type: 'sight',
    groupLabel: 'Bellagio, 12:30 to 15:30',
    location: PLACES.villaMelzi,
    bookingId: BK.villaMelzi,
    openingHours: hours('10:00-18:00 seasonal'),
  },
  {
    title: 'Ferry to Menaggio',
    type: 'transport',
    time: '15:00',
    timeApprox: true,
    bookingId: BK.comoFerries,
    travel: {
      mode: 'ferry',
      from: PLACES.bellagioPier,
      to: PLACES.menaggioPier,
      durationMins: 18,
      operator: 'Navigazione Laghi',
      seasonalTimetable: true,
    },
  },
  {
    title: 'Piazza Garibaldi',
    type: 'sight',
    groupLabel: 'Menaggio',
    location: PLACES.piazzaGaribaldiMenaggio,
    cost: { amount: 0, currency: 'EUR' },
  },
  {
    title: 'Lake promenade and gelato',
    type: 'meal',
    groupLabel: 'Menaggio',
    location: PLACES.menaggioPromenade,
  },
  {
    title: 'Evening ferry back to Varenna',
    type: 'transport',
    time: '17:00',
    timeApprox: true,
    bookingId: BK.comoFerries,
    tags: ['CHECK'],
    travel: {
      mode: 'ferry',
      from: PLACES.menaggioPier,
      to: PLACES.varennaPier,
      durationMins: 20,
      operator: 'Navigazione Laghi',
      seasonalTimetable: true,
      alternatives: [
        'Menaggio to Como by boat, then a train to Milan',
        'Bus from Menaggio towards Varenna',
      ],
    },
    notes:
      'This is the fragile leg of the day. The 2026 summer timetable runs to 4 October, so 3 October is its last day. Verify the last crossing before committing to the far shore.',
  },
  {
    title: 'Train back to Milan',
    type: 'transport',
    bookingId: BK.regionalMilVarenna,
    travel: {
      mode: 'train',
      from: PLACES.varennaEsino,
      to: PLACES.milanoCentrale,
      durationMins: 60,
      operator: 'Trenord',
    },
    notes: 'Expected back in Milan around 19:30 to 20:00.',
  },
  {
    title: "Buy snacks for tomorrow's four-hour journey",
    type: 'shop',
    tags: ['MUST'],
  },
]);

export const daysOneToEight: Day[] = [d00, d01, d02, d03, d04, d05, d06, d07, d08];
export const itemsOneToEight: Item[] = [
  ...i00,
  ...i01,
  ...i02,
  ...i03,
  ...i04,
  ...i05,
  ...i06,
  ...i07,
  ...i08,
];
