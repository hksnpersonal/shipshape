/**
 * Canonical identifiers and places for the built-in Europe 2026 sample trip.
 *
 * This file is the contract that lets the day chunks, the bookings chunk and the
 * reminders chunk be written independently. Nothing here may be renamed once the data
 * chunks reference it.
 *
 * Coordinates are deliberately absent: none were in the source notes and inventing them
 * would poison the distance heuristics. Locality comes from `city` and `zone`.
 */
import type { CountryCode, ISODate, Place, PlaceKind } from '@/domain/types';

export const TRIP_ID = 'europe-2026';

/**
 * Day ids in date order. `d00` is the Sydney departure day; `d01`-`d22` are the days on
 * the ground, renumbered by date (the source notes had duplicate labels).
 */
export const DAY_DATES = {
  d00: '2026-09-25',
  d01: '2026-09-26',
  d02: '2026-09-27',
  d03: '2026-09-28',
  d04: '2026-09-29',
  d05: '2026-09-30',
  d06: '2026-10-01',
  d07: '2026-10-02',
  d08: '2026-10-03',
  d09: '2026-10-04',
  d10: '2026-10-05',
  d11: '2026-10-06',
  d12: '2026-10-07',
  d13: '2026-10-08',
  d14: '2026-10-09',
  d15: '2026-10-10',
  d16: '2026-10-11',
  d17: '2026-10-12',
  d18: '2026-10-13',
  d19: '2026-10-14',
  d20: '2026-10-15',
  d21: '2026-10-16',
  d22: '2026-10-17',
} as const satisfies Record<string, ISODate>;

export type DayKey = keyof typeof DAY_DATES;
export const DAY_KEYS = Object.keys(DAY_DATES) as DayKey[];

/** `d01` -> `europe-2026-d01`. Use this everywhere an `Item.dayId` is needed. */
export const dayId = (key: DayKey): string => `${TRIP_ID}-${key}`;

/** Deterministic item id: `europe-2026-d01-i03`. `index` is 1-based, bullet order. */
export const itemId = (key: DayKey, index: number): string =>
  `${TRIP_ID}-${key}-i${String(index).padStart(2, '0')}`;

/** Items are spaced by 1000 so an insert can take the midpoint without renumbering. */
export const sortKeyFor = (index: number): number => index * 1000;

// ---------------------------------------------------------------------------
// Accommodation
// ---------------------------------------------------------------------------

export const ACC = {
  rome: 'acc-rome',
  florence: 'acc-florence',
  venice: 'acc-venice',
  milan: 'acc-milan',
  lucerne: 'acc-lucerne',
  grindelwald: 'acc-grindelwald',
  paris: 'acc-paris',
  amsterdam: 'acc-amsterdam',
} as const;

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const BK = {
  // Flights
  flightSydRom: 'bk-flight-syd-fco',
  flightAmsSyd: 'bk-flight-ams-syd',
  // Long-distance rail
  frecciarossaRomFlr: 'bk-rail-rom-flr',
  italoFlrVce: 'bk-rail-flr-vce',
  hsVceMil: 'bk-rail-vce-mil',
  trenitaliaMilChiasso: 'bk-rail-mil-chiasso',
  tgvBslPar: 'bk-rail-bsl-par',
  eurostarParBru: 'bk-rail-par-bru',
  eurostarBruPar: 'bk-rail-bru-par',
  eurostarParAms: 'bk-rail-par-ams',
  // Regional rail and boats arranged locally
  regionalFlrPisa: 'bk-rail-flr-pisa',
  regionalPisaFlr: 'bk-rail-pisa-flr',
  regionalMilVarenna: 'bk-rail-mil-varenna',
  comoFerries: 'bk-ferry-como',
  // Mountains
  swissTravelPass: 'bk-pass-swiss-travel',
  pilatusGoldenRound: 'bk-mtn-pilatus',
  rigiRoundTrip: 'bk-mtn-rigi',
  firstGondola: 'bk-mtn-first',
  mountainCart: 'bk-mtn-cart',
  oeschinenGondola: 'bk-mtn-oeschinen',
  rodelbahn: 'bk-mtn-rodelbahn',
  blausee: 'bk-att-blausee',
  // Museums and attractions
  vaticanMuseums: 'bk-att-vatican',
  galleriaBorghese: 'bk-att-borghese',
  museiCapitolini: 'bk-att-capitolini',
  santIgnazio: 'bk-att-sant-ignazio',
  villaMonastero: 'bk-att-villa-monastero',
  villaMelzi: 'bk-att-villa-melzi',
  gondolaVenice: 'bk-att-gondola',
  canalCruise: 'bk-att-canal-cruise',
  amsterdamCityCard: 'bk-card-amsterdam',
  // Hotels
  hotelRome: 'bk-hotel-rome',
  hotelFlorence: 'bk-hotel-florence',
  hotelVenice: 'bk-hotel-venice',
  hotelMilan: 'bk-hotel-milan',
  hotelLucerne: 'bk-hotel-lucerne',
  hotelGrindelwald: 'bk-hotel-grindelwald',
  hotelParis: 'bk-hotel-paris',
  hotelAmsterdam: 'bk-hotel-amsterdam',
  // Restaurants
  roscioli: 'bk-rest-roscioli',
  daFabrizio: 'bk-rest-da-fabrizio',
  osteriaPastella: 'bk-rest-pastella',
} as const;

export type BookingKey = keyof typeof BK;

/** The Swiss Travel Pass id as referenced by `TravelLeg.passId` and guide coverage. */
export const PASS_SWISS = BK.swissTravelPass;

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

interface PlaceSeed {
  name: string;
  kind: PlaceKind;
  city: string;
  countryCode: CountryCode;
  zone?: string;
  address?: string;
}

const place = (key: string, seed: PlaceSeed): Place => ({ key, ...seed });

const IT = 'IT';
const CH = 'CH';
const FR = 'FR';
const BE = 'BE';
const NL = 'NL';
const AU = 'AU';

/**
 * Canonical places. `key` is what the linter compares, so two items meaning the same
 * physical place must reuse the same entry rather than introduce a similar name.
 */
export const PLACES = {
  // --- Australia ---
  sydAirport: place('au-syd-airport', {
    name: 'Sydney Airport (SYD)',
    kind: 'airport',
    city: 'Sydney',
    countryCode: AU,
  }),

  // --- Rome ---
  fco: place('it-rome-fco', {
    name: 'Rome Fiumicino Airport (FCO)',
    kind: 'airport',
    city: 'Rome',
    countryCode: IT,
  }),
  romaTermini: place('it-roma-termini', {
    name: 'Roma Termini',
    kind: 'rail-station',
    city: 'Rome',
    countryCode: IT,
  }),
  hotelVisconti: place('it-rome-hotel-visconti', {
    name: 'Hotel Visconti Suites by FNA Hospitality',
    kind: 'hotel',
    city: 'Rome',
    zone: 'rome-prati',
    countryCode: IT,
    address: 'Viale Giulio Cesare 78, 00192 Roma RM',
  }),
  metroOttaviano: place('it-rome-metro-ottaviano', {
    name: 'Ottaviano (Metro A)',
    kind: 'metro-station',
    city: 'Rome',
    zone: 'rome-prati',
    countryCode: IT,
  }),
  metroBarberini: place('it-rome-metro-barberini', {
    name: 'Barberini (Metro A)',
    kind: 'metro-station',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  metroColosseo: place('it-rome-metro-colosseo', {
    name: 'Colosseo (Metro B)',
    kind: 'metro-station',
    city: 'Rome',
    zone: 'rome-colosseo',
    countryCode: IT,
  }),
  treviFountain: place('it-rome-trevi', {
    name: 'Trevi Fountain',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  pantheon: place('it-rome-pantheon', {
    name: 'Pantheon',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  anticoVinaioRome: place('it-rome-antico-vinaio', {
    name: "All'Antico Vinaio (Rome)",
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  tazzaDoro: place('it-rome-tazza-doro', {
    name: "La Casa del Caffe Tazza d'Oro",
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  twoSizes: place('it-rome-two-sizes', {
    name: 'Two Sizes Tiramisu',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  doriaPamphilj: place('it-rome-doria-pamphilj', {
    name: 'Galleria Doria Pamphilj',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  santIgnazio: place('it-rome-sant-ignazio', {
    name: "Chiesa di Sant'Ignazio di Loyola",
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  colosseum: place('it-rome-colosseum', {
    name: 'Colosseum',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-colosseo',
    countryCode: IT,
  }),
  romanForum: place('it-rome-forum', {
    name: 'Roman Forum',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-colosseo',
    countryCode: IT,
  }),
  museiCapitolini: place('it-rome-capitolini', {
    name: 'Musei Capitolini',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-colosseo',
    countryCode: IT,
  }),
  roscioli: place('it-rome-roscioli', {
    name: 'Roscioli Salumeria con Cucina',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  villaBorghese: place('it-rome-villa-borghese', {
    name: 'Villa Borghese Gardens',
    kind: 'area',
    city: 'Rome',
    zone: 'rome-borghese',
    countryCode: IT,
  }),
  galleriaBorghese: place('it-rome-galleria-borghese', {
    name: 'Galleria Borghese',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-borghese',
    countryCode: IT,
  }),
  tropicalIce: place('it-rome-tropical-ice', {
    name: 'Tropical Ice Gelateria',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-borghese',
    countryCode: IT,
  }),
  stPeters: place('it-rome-st-peters', {
    name: "St Peter's Basilica",
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-vatican',
    countryCode: IT,
  }),
  vaticanMuseums: place('it-rome-vatican-museums', {
    name: 'Vatican Museums',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-vatican',
    countryCode: IT,
  }),
  piazzaNavona: place('it-rome-piazza-navona', {
    name: 'Piazza Navona',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),
  daFabrizio: place('it-rome-da-fabrizio', {
    name: 'Da Fabrizio Al 56',
    kind: 'venue',
    city: 'Rome',
    zone: 'rome-centro',
    countryCode: IT,
  }),

  // --- Florence ---
  firenzeSmn: place('it-firenze-smn', {
    name: 'Firenze Santa Maria Novella',
    kind: 'rail-station',
    city: 'Florence',
    countryCode: IT,
  }),
  hotelSantAntonino: place('it-florence-hotel-santantonino', {
    name: "Sant'Antonino First Floor Relais",
    kind: 'hotel',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
    address: "Via Sant'Antonino 7, 50123 Firenze",
  }),
  deNeri: place('it-florence-de-neri', {
    name: "Panetteria e Stuzzicheria De' Neri 18R",
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  piazzaSignoria: place('it-florence-piazza-signoria', {
    name: 'Piazza della Signoria',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  loggiaLanzi: place('it-florence-loggia-lanzi', {
    name: 'Loggia dei Lanzi',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  ponteVecchio: place('it-florence-ponte-vecchio', {
    name: 'Ponte Vecchio',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  brandyMelville: place('it-florence-brandy-melville', {
    name: 'Brandy Melville (Florence)',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  duomoFirenze: place('it-florence-duomo', {
    name: 'Cathedral of Santa Maria del Fiore',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  battisteroFirenze: place('it-florence-battistero', {
    name: 'Baptistery of St John',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  santaMariaNovella: place('it-florence-santa-maria-novella', {
    name: 'Basilica of Santa Maria Novella',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  osteriaPastella: place('it-florence-osteria-pastella', {
    name: 'Osteria Pastella',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  gironeGhiotti: place('it-florence-girone-ghiotti', {
    name: "Girone de' Ghiotti",
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  donNino: place('it-florence-don-nino', {
    name: 'Don Nino',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  uffiziCourtyard: place('it-florence-uffizi-courtyard', {
    name: 'Uffizi courtyard',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-centro',
    countryCode: IT,
  }),
  piazzaleMichelangelo: place('it-florence-piazzale-michelangelo', {
    name: 'Piazzale Michelangelo',
    kind: 'venue',
    city: 'Florence',
    zone: 'florence-oltrarno',
    countryCode: IT,
  }),

  // --- Pisa ---
  pisaSanRossore: place('it-pisa-san-rossore', {
    name: 'Pisa San Rossore',
    kind: 'rail-station',
    city: 'Pisa',
    countryCode: IT,
  }),
  pisaCentrale: place('it-pisa-centrale', {
    name: 'Pisa Centrale',
    kind: 'rail-station',
    city: 'Pisa',
    countryCode: IT,
  }),
  piazzaMiracoli: place('it-pisa-piazza-miracoli', {
    name: 'Piazza dei Miracoli',
    kind: 'area',
    city: 'Pisa',
    zone: 'pisa-miracoli',
    countryCode: IT,
  }),
  leaningTower: place('it-pisa-leaning-tower', {
    name: 'Leaning Tower of Pisa',
    kind: 'venue',
    city: 'Pisa',
    zone: 'pisa-miracoli',
    countryCode: IT,
  }),
  pisaCathedral: place('it-pisa-cathedral', {
    name: 'Pisa Cathedral',
    kind: 'venue',
    city: 'Pisa',
    zone: 'pisa-miracoli',
    countryCode: IT,
  }),
  pisaBaptistery: place('it-pisa-baptistery', {
    name: 'Pisa Baptistery',
    kind: 'venue',
    city: 'Pisa',
    zone: 'pisa-miracoli',
    countryCode: IT,
  }),
  camposanto: place('it-pisa-camposanto', {
    name: 'Camposanto Monumentale',
    kind: 'venue',
    city: 'Pisa',
    zone: 'pisa-miracoli',
    countryCode: IT,
  }),

  // --- Venice ---
  veneziaSantaLucia: place('it-venezia-santa-lucia', {
    name: 'Venezia Santa Lucia',
    kind: 'rail-station',
    city: 'Venice',
    countryCode: IT,
  }),
  hotelCasaMarsilli: place('it-venice-casa-marsilli', {
    name: 'Hotel Casa Marsilli',
    kind: 'hotel',
    city: 'Venice',
    zone: 'venice-castello',
    countryCode: IT,
    address: 'Castello 5977, 30122 Venice',
  }),
  rialtoBridge: place('it-venice-rialto', {
    name: 'Rialto Bridge',
    kind: 'venue',
    city: 'Venice',
    zone: 'venice-san-marco',
    countryCode: IT,
  }),
  piazzaSanMarco: place('it-venice-piazza-san-marco', {
    name: 'Piazza San Marco',
    kind: 'venue',
    city: 'Venice',
    zone: 'venice-san-marco',
    countryCode: IT,
  }),
  stMarksBasilica: place('it-venice-st-marks', {
    name: "St Mark's Basilica",
    kind: 'venue',
    city: 'Venice',
    zone: 'venice-san-marco',
    countryCode: IT,
  }),
  dogesPalace: place('it-venice-doges-palace', {
    name: "Doge's Palace",
    kind: 'venue',
    city: 'Venice',
    zone: 'venice-san-marco',
    countryCode: IT,
  }),
  bridgeOfSighs: place('it-venice-bridge-of-sighs', {
    name: 'Bridge of Sighs',
    kind: 'venue',
    city: 'Venice',
    zone: 'venice-san-marco',
    countryCode: IT,
  }),
  gondolaPier: place('it-venice-gondola-pier', {
    name: 'Gondola station (San Marco area)',
    kind: 'pier',
    city: 'Venice',
    zone: 'venice-san-marco',
    countryCode: IT,
  }),

  // --- Milan ---
  milanoCentrale: place('it-milano-centrale', {
    name: 'Milano Centrale',
    kind: 'rail-station',
    city: 'Milan',
    countryCode: IT,
  }),
  hotelCentralStationMilan: place('it-milan-hotel-central-station', {
    name: 'Hotel Central Station Apartment',
    kind: 'hotel',
    city: 'Milan',
    zone: 'milan-centrale',
    countryCode: IT,
    address: 'Via Luigi Galvani 15, 20124 Milan',
  }),
  metroCentraleFs: place('it-milan-metro-centrale-fs', {
    name: 'Centrale FS (M3)',
    kind: 'metro-station',
    city: 'Milan',
    zone: 'milan-centrale',
    countryCode: IT,
  }),
  metroDuomoMilano: place('it-milan-metro-duomo', {
    name: 'Duomo (M3)',
    kind: 'metro-station',
    city: 'Milan',
    zone: 'milan-duomo',
    countryCode: IT,
  }),
  piazzaDuomoMilano: place('it-milan-piazza-duomo', {
    name: 'Piazza del Duomo',
    kind: 'venue',
    city: 'Milan',
    zone: 'milan-duomo',
    countryCode: IT,
  }),
  duomoMilano: place('it-milan-duomo', {
    name: 'Duomo di Milano',
    kind: 'venue',
    city: 'Milan',
    zone: 'milan-duomo',
    countryCode: IT,
  }),
  galleriaVittorio: place('it-milan-galleria-vittorio', {
    name: 'Galleria Vittorio Emanuele II',
    kind: 'venue',
    city: 'Milan',
    zone: 'milan-duomo',
    countryCode: IT,
  }),

  // --- Lake Como ---
  varennaEsino: place('it-varenna-esino', {
    name: 'Varenna-Esino',
    kind: 'rail-station',
    city: 'Varenna',
    countryCode: IT,
  }),
  varennaPier: place('it-varenna-pier', {
    name: 'Varenna ferry pier',
    kind: 'pier',
    city: 'Varenna',
    countryCode: IT,
  }),
  passeggiataInnamorati: place('it-varenna-passeggiata', {
    name: 'Passeggiata degli Innamorati',
    kind: 'venue',
    city: 'Varenna',
    countryCode: IT,
  }),
  varennaOldVillage: place('it-varenna-old-village', {
    name: 'Varenna Old Village',
    kind: 'area',
    city: 'Varenna',
    countryCode: IT,
  }),
  villaMonastero: place('it-varenna-villa-monastero', {
    name: 'Villa Monastero',
    kind: 'venue',
    city: 'Varenna',
    countryCode: IT,
  }),
  bellagioPier: place('it-bellagio-pier', {
    name: 'Bellagio ferry pier',
    kind: 'pier',
    city: 'Bellagio',
    countryCode: IT,
  }),
  bellagioOldTown: place('it-bellagio-old-town', {
    name: 'Bellagio Old Town',
    kind: 'area',
    city: 'Bellagio',
    countryCode: IT,
  }),
  puntaSpartivento: place('it-bellagio-punta-spartivento', {
    name: 'Punta Spartivento',
    kind: 'venue',
    city: 'Bellagio',
    countryCode: IT,
  }),
  villaMelzi: place('it-bellagio-villa-melzi', {
    name: 'Villa Melzi Gardens',
    kind: 'venue',
    city: 'Bellagio',
    countryCode: IT,
  }),
  menaggioPier: place('it-menaggio-pier', {
    name: 'Menaggio ferry pier',
    kind: 'pier',
    city: 'Menaggio',
    countryCode: IT,
  }),
  piazzaGaribaldiMenaggio: place('it-menaggio-piazza-garibaldi', {
    name: 'Piazza Garibaldi',
    kind: 'venue',
    city: 'Menaggio',
    countryCode: IT,
  }),
  menaggioPromenade: place('it-menaggio-promenade', {
    name: 'Menaggio lake promenade',
    kind: 'area',
    city: 'Menaggio',
    countryCode: IT,
  }),

  // --- Italy / Switzerland border ---
  chiasso: place('ch-chiasso', {
    name: 'Chiasso',
    kind: 'rail-station',
    city: 'Chiasso',
    countryCode: CH,
  }),
  arthGoldau: place('ch-arth-goldau', {
    name: 'Arth-Goldau',
    kind: 'rail-station',
    city: 'Arth',
    countryCode: CH,
  }),

  // --- Lucerne ---
  luzernBahnhof: place('ch-luzern-bahnhof', {
    name: 'Luzern train station',
    kind: 'rail-station',
    city: 'Lucerne',
    countryCode: CH,
  }),
  luzernBahnhofquai: place('ch-luzern-bahnhofquai', {
    name: 'Luzern Bahnhofquai pier',
    kind: 'pier',
    city: 'Lucerne',
    countryCode: CH,
  }),
  hotelBaslertor: place('ch-lucerne-hotel-baslertor', {
    name: 'Hotel Baslertor',
    kind: 'hotel',
    city: 'Lucerne',
    countryCode: CH,
    address: 'Pfistergasse 17, 6003 Lucerne',
  }),
  lionMonument: place('ch-lucerne-lion-monument', {
    name: 'Lion Monument',
    kind: 'venue',
    city: 'Lucerne',
    countryCode: CH,
  }),
  jesuitChurch: place('ch-lucerne-jesuit-church', {
    name: 'Jesuit Church',
    kind: 'venue',
    city: 'Lucerne',
    countryCode: CH,
  }),
  lucerneOldTown: place('ch-lucerne-old-town', {
    name: 'Lucerne Old Town',
    kind: 'area',
    city: 'Lucerne',
    countryCode: CH,
  }),
  chapelBridge: place('ch-lucerne-chapel-bridge', {
    name: 'Chapel Bridge',
    kind: 'venue',
    city: 'Lucerne',
    countryCode: CH,
  }),
  lucernePromenade: place('ch-lucerne-promenade', {
    name: 'Lake Lucerne promenade',
    kind: 'area',
    city: 'Lucerne',
    countryCode: CH,
  }),

  // --- Pilatus ---
  alpnachstad: place('ch-alpnachstad', {
    name: 'Alpnachstad',
    kind: 'rail-station',
    city: 'Alpnach',
    countryCode: CH,
  }),
  alpnachstadCogwheel: place('ch-alpnachstad-cogwheel', {
    name: 'Alpnachstad cogwheel station',
    kind: 'rail-station',
    city: 'Alpnach',
    countryCode: CH,
  }),
  pilatusKulm: place('ch-pilatus-kulm', {
    name: 'Pilatus Kulm',
    kind: 'venue',
    city: 'Pilatus',
    countryCode: CH,
  }),
  fraekmuentegg: place('ch-fraekmuentegg', {
    name: 'Fraekmuentegg',
    kind: 'venue',
    city: 'Kriens',
    countryCode: CH,
  }),
  kriens: place('ch-kriens', {
    name: 'Kriens gondola station',
    kind: 'bus-stop',
    city: 'Kriens',
    countryCode: CH,
  }),

  // --- Rigi ---
  vitznau: place('ch-vitznau', {
    name: 'Vitznau',
    kind: 'pier',
    city: 'Vitznau',
    countryCode: CH,
  }),
  rigiKulm: place('ch-rigi-kulm', {
    name: 'Rigi Kulm',
    kind: 'venue',
    city: 'Rigi',
    countryCode: CH,
  }),
  rigiKaltbad: place('ch-rigi-kaltbad', {
    name: 'Rigi Kaltbad',
    kind: 'rail-station',
    city: 'Rigi',
    countryCode: CH,
  }),
  weggis: place('ch-weggis', {
    name: 'Weggis',
    kind: 'pier',
    city: 'Weggis',
    countryCode: CH,
  }),

  // --- Interlaken / Grindelwald ---
  interlakenOst: place('ch-interlaken-ost', {
    name: 'Interlaken Ost',
    kind: 'rail-station',
    city: 'Interlaken',
    countryCode: CH,
  }),
  grindelwaldBahnhof: place('ch-grindelwald-bahnhof', {
    name: 'Grindelwald station',
    kind: 'rail-station',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  hotelCentralWalter: place('ch-grindelwald-hotel-central-walter', {
    name: 'Hotel Central Wolter',
    kind: 'hotel',
    city: 'Grindelwald',
    countryCode: CH,
    address: 'Dorfstrasse 93, 3818 Grindelwald',
  }),
  grindelwaldVillage: place('ch-grindelwald-village', {
    name: 'Grindelwald village centre',
    kind: 'area',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  goldenIndia: place('ch-grindelwald-goldenindia', {
    name: 'Restaurant GoldenIndia',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  barrysRestaurant: place('ch-grindelwald-barrys', {
    name: "Barry's Restaurant",
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  coopGrindelwald: place('ch-grindelwald-coop', {
    name: 'Coop / Migros Grindelwald',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  cafe3692: place('ch-grindelwald-cafe-3692', {
    name: 'Cafe 3692',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  avocadoBar: place('ch-grindelwald-avocado-bar', {
    name: 'Avocado Bar',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  endweg: place('ch-grindelwald-endweg', {
    name: 'Endweg Road viewpoint',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),

  // --- Grindelwald First ---
  firstbahn: place('ch-grindelwald-firstbahn', {
    name: 'Grindelwald Firstbahn station',
    kind: 'rail-station',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  bort: place('ch-bort', { name: 'Bort', kind: 'venue', city: 'Grindelwald', countryCode: CH }),
  schreckfeld: place('ch-schreckfeld', {
    name: 'Schreckfeld',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  first: place('ch-first', { name: 'First', kind: 'venue', city: 'Grindelwald', countryCode: CH }),
  firstCliffWalk: place('ch-first-cliff-walk', {
    name: 'First Cliff Walk',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  bachalpsee: place('ch-bachalpsee', {
    name: 'Bachalpsee Lake',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),
  firstRestaurant: place('ch-first-restaurant', {
    name: 'First Mountain Restaurant',
    kind: 'venue',
    city: 'Grindelwald',
    countryCode: CH,
  }),

  // --- Kandersteg / Oeschinensee ---
  spiez: place('ch-spiez', { name: 'Spiez', kind: 'rail-station', city: 'Spiez', countryCode: CH }),
  kandersteg: place('ch-kandersteg', {
    name: 'Kandersteg',
    kind: 'rail-station',
    city: 'Kandersteg',
    countryCode: CH,
  }),
  oeschinenGondolaBase: place('ch-oeschinen-gondola-base', {
    name: 'Oeschinen gondola valley station',
    kind: 'venue',
    city: 'Kandersteg',
    countryCode: CH,
  }),
  oeschinenMountainStation: place('ch-oeschinen-mountain-station', {
    name: 'Oeschinen mountain station',
    kind: 'venue',
    city: 'Kandersteg',
    countryCode: CH,
  }),
  oeschinensee: place('ch-oeschinensee', {
    name: 'Oeschinensee',
    kind: 'venue',
    city: 'Kandersteg',
    countryCode: CH,
  }),
  rodelbahnOeschinen: place('ch-oeschinen-rodelbahn', {
    name: 'Rodelbahn Oeschinensee',
    kind: 'venue',
    city: 'Kandersteg',
    countryCode: CH,
  }),
  blausee: place('ch-blausee', {
    name: 'Blausee Nature Park',
    kind: 'venue',
    city: 'Blausee',
    countryCode: CH,
  }),

  // --- Lauterbrunnen valley ---
  lauterbrunnen: place('ch-lauterbrunnen', {
    name: 'Lauterbrunnen',
    kind: 'rail-station',
    city: 'Lauterbrunnen',
    countryCode: CH,
  }),
  staubbachFalls: place('ch-staubbach-falls', {
    name: 'Staubbach Falls',
    kind: 'venue',
    city: 'Lauterbrunnen',
    countryCode: CH,
  }),
  wengen: place('ch-wengen', {
    name: 'Wengen',
    kind: 'rail-station',
    city: 'Wengen',
    countryCode: CH,
  }),
  gruetschalp: place('ch-gruetschalp', {
    name: 'Gruetschalp',
    kind: 'rail-station',
    city: 'Lauterbrunnen',
    countryCode: CH,
  }),
  muerren: place('ch-muerren', {
    name: 'Muerren',
    kind: 'rail-station',
    city: 'Muerren',
    countryCode: CH,
  }),

  // --- Basel ---
  baselSbb: place('ch-basel-sbb', {
    name: 'Basel SBB',
    kind: 'rail-station',
    city: 'Basel',
    countryCode: CH,
  }),

  // --- Paris ---
  parisGareDeLyon: place('fr-paris-gare-de-lyon', {
    name: 'Paris Gare de Lyon',
    kind: 'rail-station',
    city: 'Paris',
    zone: 'paris-12e',
    countryCode: FR,
  }),
  parisGareDuNord: place('fr-paris-gare-du-nord', {
    name: 'Paris Gare du Nord',
    kind: 'rail-station',
    city: 'Paris',
    zone: 'paris-10e',
    countryCode: FR,
  }),
  hotelFlanelles: place('fr-paris-hotel-flanelles', {
    name: 'Hotel Flanelles Paris Gare du Nord',
    kind: 'hotel',
    city: 'Paris',
    zone: 'paris-10e',
    countryCode: FR,
  }),
  chatelet: place('fr-paris-chatelet', {
    name: 'Chatelet',
    kind: 'metro-station',
    city: 'Paris',
    zone: 'paris-1er',
    countryCode: FR,
  }),
  notreDame: place('fr-paris-notre-dame', {
    name: 'Notre-Dame Cathedral',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-4e',
    countryCode: FR,
  }),
  pontNeuf: place('fr-paris-pont-neuf', {
    name: 'Pont Neuf',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-1er',
    countryCode: FR,
  }),
  seineBanks: place('fr-paris-seine-banks', {
    name: 'Seine river banks',
    kind: 'area',
    city: 'Paris',
    zone: 'paris-1er',
    countryCode: FR,
  }),
  palaisRoyalLouvre: place('fr-paris-palais-royal-louvre', {
    name: 'Palais Royal - Musee du Louvre',
    kind: 'metro-station',
    city: 'Paris',
    zone: 'paris-1er',
    countryCode: FR,
  }),
  louvreCourtyard: place('fr-paris-louvre-courtyard', {
    name: 'Louvre courtyard and glass pyramid',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-1er',
    countryCode: FR,
  }),
  jardinTuileries: place('fr-paris-tuileries', {
    name: 'Jardin des Tuileries',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-1er',
    countryCode: FR,
  }),
  placeConcorde: place('fr-paris-concorde', {
    name: 'Place de la Concorde',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-8e',
    countryCode: FR,
  }),
  cdgEtoile: place('fr-paris-cdg-etoile', {
    name: 'Charles de Gaulle - Etoile',
    kind: 'metro-station',
    city: 'Paris',
    zone: 'paris-8e',
    countryCode: FR,
  }),
  arcDeTriomphe: place('fr-paris-arc-de-triomphe', {
    name: 'Arc de Triomphe',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-8e',
    countryCode: FR,
  }),
  carette: place('fr-paris-carette', {
    name: 'Carette, Place du Trocadero',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-16e',
    countryCode: FR,
  }),
  trocadero: place('fr-paris-trocadero', {
    name: 'Trocadero',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-16e',
    countryCode: FR,
  }),
  grandeEpicerie: place('fr-paris-grande-epicerie', {
    name: 'La Grande Epicerie de Paris',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-7e',
    countryCode: FR,
  }),
  saintGermainDesPres: place('fr-paris-saint-germain', {
    name: 'Saint-Germain-des-Pres',
    kind: 'metro-station',
    city: 'Paris',
    zone: 'paris-6e',
    countryCode: FR,
  }),
  lesDeuxMagots: place('fr-paris-les-deux-magots', {
    name: 'Les Deux Magots',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-6e',
    countryCode: FR,
  }),
  jardinLuxembourg: place('fr-paris-luxembourg', {
    name: 'Jardin du Luxembourg',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-6e',
    countryCode: FR,
  }),
  montparnasse: place('fr-paris-montparnasse', {
    name: 'Montparnasse',
    kind: 'metro-station',
    city: 'Paris',
    zone: 'paris-14e',
    countryCode: FR,
  }),
  lesFondusRaclette: place('fr-paris-les-fondus-raclette', {
    name: 'Les Fondus de la Raclette',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-14e',
    countryCode: FR,
  }),
  avenueCamoens: place('fr-paris-avenue-camoens', {
    name: 'Avenue de Camoens',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-16e',
    countryCode: FR,
  }),
  portDeDebilly: place('fr-paris-port-de-debilly', {
    name: 'Port de Debilly',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-16e',
    countryCode: FR,
  }),
  pontIena: place('fr-paris-pont-iena', {
    name: "Pont d'Iena",
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-7e',
    countryCode: FR,
  }),
  pontAlexandreIii: place('fr-paris-pont-alexandre-iii', {
    name: 'Pont Alexandre III',
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-8e',
    countryCode: FR,
  }),
  jardinErevan: place('fr-paris-jardin-erevan', {
    name: "Jardin d'Erevan",
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-8e',
    countryCode: FR,
  }),
  pontAlma: place('fr-paris-pont-alma', {
    name: "Pont de l'Alma",
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-8e',
    countryCode: FR,
  }),
  aubergeAveyronnaise: place('fr-paris-auberge-aveyronnaise', {
    name: "L'Auberge Aveyronnaise",
    kind: 'venue',
    city: 'Paris',
    zone: 'paris-12e',
    countryCode: FR,
  }),

  // --- Brussels ---
  brusselsMidi: place('be-brussels-midi', {
    name: 'Brussels Midi',
    kind: 'rail-station',
    city: 'Brussels',
    countryCode: BE,
  }),
  grandPlace: place('be-brussels-grand-place', {
    name: 'Grand Place',
    kind: 'venue',
    city: 'Brussels',
    zone: 'brussels-centre',
    countryCode: BE,
  }),
  galeriesRoyales: place('be-brussels-galeries-royales', {
    name: 'Galeries Royales Saint-Hubert',
    kind: 'venue',
    city: 'Brussels',
    zone: 'brussels-centre',
    countryCode: BE,
  }),
  mannekenPis: place('be-brussels-manneken-pis', {
    name: 'Manneken Pis',
    kind: 'venue',
    city: 'Brussels',
    zone: 'brussels-centre',
    countryCode: BE,
  }),

  // --- Amsterdam ---
  amsterdamCentraal: place('nl-amsterdam-centraal', {
    name: 'Amsterdam Centraal',
    kind: 'rail-station',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  nhowRai: place('nl-amsterdam-nhow-rai', {
    name: 'nhow Amsterdam RAI',
    kind: 'hotel',
    city: 'Amsterdam',
    zone: 'amsterdam-zuid',
    countryCode: NL,
    address: 'Europaplein, Amsterdam',
  }),
  europaplein: place('nl-amsterdam-europaplein', {
    name: 'Europaplein station',
    kind: 'metro-station',
    city: 'Amsterdam',
    zone: 'amsterdam-zuid',
    countryCode: NL,
  }),
  damSquare: place('nl-amsterdam-dam-square', {
    name: 'Dam Square',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  rokin: place('nl-amsterdam-rokin', {
    name: 'Rokin',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  vanStapele: place('nl-amsterdam-van-stapele', {
    name: 'Van Stapele Koekmakerij',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  cafePapeneiland: place('nl-amsterdam-cafe-papeneiland', {
    name: 'Cafe Papeneiland',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-jordaan',
    countryCode: NL,
  }),
  jordaan: place('nl-amsterdam-jordaan', {
    name: 'Jordaan',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-jordaan',
    countryCode: NL,
  }),
  nineStreets: place('nl-amsterdam-nine-streets', {
    name: 'Nine Streets (De 9 Straatjes)',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  canalBelt: place('nl-amsterdam-canal-belt', {
    name: 'Canal Belt',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  prinsengracht: place('nl-amsterdam-prinsengracht', {
    name: 'Prinsengracht',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  keizersgracht: place('nl-amsterdam-keizersgracht', {
    name: 'Keizersgracht',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  herengracht: place('nl-amsterdam-herengracht', {
    name: 'Herengracht',
    kind: 'area',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  zaandijkZaanseSchans: place('nl-zaandijk-zaanse-schans', {
    name: 'Zaandijk Zaanse Schans',
    kind: 'rail-station',
    city: 'Zaandijk',
    countryCode: NL,
  }),
  zaanseSchans: place('nl-zaanse-schans', {
    name: 'Zaanse Schans',
    kind: 'venue',
    city: 'Zaandijk',
    countryCode: NL,
  }),
  albertCuyp: place('nl-amsterdam-albert-cuyp', {
    name: 'Albert Cuyp Market',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-de-pijp',
    countryCode: NL,
  }),
  canalCruisePier: place('nl-amsterdam-canal-cruise-pier', {
    name: 'Canal cruise departure pier',
    kind: 'pier',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  bloemenmarkt: place('nl-amsterdam-bloemenmarkt', {
    name: 'Bloemenmarkt (Flower Market)',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-centrum',
    countryCode: NL,
  }),
  tokoBersama: place('nl-amsterdam-toko-bersama', {
    name: 'Toko Bersama',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-de-pijp',
    countryCode: NL,
  }),
  warungSpang: place('nl-amsterdam-warung-spang', {
    name: 'Warung Spang Makandra',
    kind: 'venue',
    city: 'Amsterdam',
    zone: 'amsterdam-de-pijp',
    countryCode: NL,
  }),
  schiphol: place('nl-schiphol', {
    name: 'Amsterdam Schiphol Airport (AMS)',
    kind: 'airport',
    city: 'Amsterdam',
    countryCode: NL,
  }),
} as const satisfies Record<string, Place>;

export type PlaceName = keyof typeof PLACES;
