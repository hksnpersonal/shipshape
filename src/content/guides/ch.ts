/**
 * Switzerland: what the Swiss Travel Pass actually covers, and which mountains still cost
 * money. Getting this wrong is the most expensive mistake on a Swiss itinerary.
 *
 * Checked 2026-09-04.
 */
import type { Guide } from '@/playbook/types';

const REVIEWED = '2026-09-04';

/** Matches the pass id used by the sample trip's seed data. */
const SWISS_PASS = 'bk-pass-swiss-travel';

export const switzerlandGuides: Guide[] = [
  {
    id: 'ch-swiss-travel-pass',
    title: 'Swiss Travel Pass: what it covers and what it does not',
    countryCode: 'CH',
    category: 'pass',
    summary:
      'Unlimited travel on trains, buses and boats, plus most museums. Mountain railways are the exception: three summits are included and the rest are half price.',
    match: {
      kinds: ['pass'],
      operators: ['SBB', 'Swiss Travel System'],
      keywords: ['swiss travel pass', 'travel pass', 'stp'],
    },
    official: {
      name: 'Swiss Travel System',
      url: 'https://www.sbb.ch/en/tickets-offers/tickets/swiss-travel-pass.html',
    },
    ticketsOpen: { daysBefore: 180 },
    bookAdvice: {
      latestDaysBefore: 7,
      note: 'Buy before you arrive so the first day is not spent at a counter. The price does not rise as the date approaches, so there is no early-bird advantage, only convenience.',
    },
    refundRules:
      '[unverified] Refund rules depend on the seller and whether the pass has been activated. Check before you buy if your dates might move.',
    passCoverage: [
      {
        passId: SWISS_PASS,
        coverage: 'covered',
        note: 'Trains, city trams and buses, PostBus, and the lake boats including Lake Lucerne.',
      },
    ],
    gotchas: [
      'Rigi is fully included. Pilatus, Grindelwald First and the Oeschinen gondola are 50 per cent off, not free.',
      'The half-price mountain fares still have to be bought, either online or at the valley station. Showing the pass at the barrier is not enough.',
      'The pass covers entry to a long list of museums, which quietly makes it better value than the transport alone suggests.',
    ],
    trustNotes: [
      'Buy from SBB or the official Swiss Travel System site. Resellers add a fee for a product with a fixed price.',
    ],
    deepLinks: [
      {
        label: 'Swiss Travel Pass on SBB',
        kind: 'book',
        template: 'https://www.sbb.ch/en/tickets-offers/tickets/swiss-travel-pass.html',
      },
    ],
    sources: [
      'https://www.sbb.ch/en/tickets-offers/tickets/swiss-travel-pass.html',
      'https://www.myswissalps.com/details/swiss-travel-pass-validity/',
    ],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-sbb-trains',
    title: 'Swiss trains and the SBB timetable',
    countryCode: 'CH',
    category: 'train',
    summary:
      'No seat reservations, no advance-purchase fares to chase, and connections built to be made. The timetable is the thing to trust, not the ticket.',
    match: {
      kinds: ['train', 'regional-train'],
      modes: ['train'],
      operators: ['SBB', 'BLS', 'Zentralbahn', 'Jungfraubahn'],
      keywords: ['sbb', 'interlaken', 'lucerne', 'grindelwald', 'basel'],
      placeKeys: [
        'ch-luzern-bahnhof',
        'ch-interlaken-ost',
        'ch-grindelwald-bahnhof',
        'ch-basel-sbb',
      ],
    },
    official: { name: 'SBB', url: 'https://www.sbb.ch/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'With a Swiss Travel Pass there is nothing to book. Without one, buy on the day: the walk-up fare is the normal fare.',
    },
    gotchas: [
      'Swiss trains leave on the minute. A connection listed as five minutes is genuinely five minutes and is designed to work.',
      'Platforms occasionally change, and sector letters on the platform tell you where your coach stops. Check the board on the day.',
      'Download the SBB app timetable before going into the mountains, where signal disappears.',
    ],
    deepLinks: [{ label: 'SBB timetable', kind: 'timetable', template: 'https://www.sbb.ch/en' }],
    sources: ['https://www.sbb.ch/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-pilatus',
    title: 'Mount Pilatus Golden Round Trip',
    countryCode: 'CH',
    category: 'mountain-railway',
    summary:
      'Boat, the steepest cogwheel railway in the world, then cable cars down to Kriens. Half price with a Swiss Travel Pass, and only worth doing in clear weather.',
    match: {
      kinds: ['mountain-railway'],
      modes: ['cogwheel', 'cablecar', 'gondola'],
      operators: ['Pilatus'],
      keywords: ['pilatus', 'golden round', 'alpnachstad', 'kriens'],
      placeKeys: ['ch-pilatus-kulm', 'ch-alpnachstad', 'ch-fraekmuentegg'],
    },
    official: { name: 'Pilatus Bahnen', url: 'https://www.pilatus.ch/en/' },
    bookAdvice: {
      latestDaysBefore: 3,
      note: 'Book three to five days out, once the mountain forecast is reliable. Booking earlier commits you to the weather you get.',
    },
    passCoverage: [
      { passId: SWISS_PASS, coverage: 'discount', note: '50 per cent off, not included.' },
    ],
    seasonal: {
      offSeasonMonths: [11, 12, 1, 2, 3, 4],
      note: 'The Alpnachstad cogwheel railway is a summer railway and closes for the winter, which changes the round trip entirely.',
    },
    gotchas: [
      'The cogwheel railway is the highlight and the reason to go up from Alpnachstad rather than down. Sitting on the right going up gives the better view.',
      'Cloud at the summit means you have paid for a view of the inside of a cloud. Check the summit webcam the morning of, not the valley forecast.',
      'It is cold at the top even when the valley is warm. Bring a layer regardless of the date.',
    ],
    deepLinks: [
      { label: 'Book the Golden Round Trip', kind: 'book', template: 'https://www.pilatus.ch/en/' },
    ],
    sources: ['https://www.pilatus.ch/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-rigi',
    title: 'Mount Rigi',
    countryCode: 'CH',
    category: 'mountain-railway',
    summary:
      'The one big summit fully included in the Swiss Travel Pass. Boat from Lucerne, cogwheel up from Vitznau, cable car down to Weggis.',
    match: {
      kinds: ['mountain-railway'],
      modes: ['cogwheel', 'cablecar', 'boat'],
      operators: ['Rigi Bahnen'],
      keywords: ['rigi', 'vitznau', 'kaltbad', 'weggis'],
      placeKeys: ['ch-rigi-kulm', 'ch-vitznau', 'ch-rigi-kaltbad', 'ch-weggis'],
    },
    official: { name: 'Rigi Bahnen', url: 'https://www.rigi.ch/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Nothing to book with a Swiss Travel Pass. Just turn up, which is exactly why Rigi is the right mountain to keep flexible for the weather.',
    },
    passCoverage: [
      {
        passId: SWISS_PASS,
        coverage: 'covered',
        note: 'Fully included, boat and railway both.',
      },
    ],
    gotchas: [
      'Check the summit webcam before setting out. Rigi is worth the day in clear air and worth nothing in cloud.',
      'Because it costs nothing extra with the pass, it is the day to move when the forecast changes. Move Rigi, not the mountain you have prepaid.',
      'The boat from Lucerne is part of the experience. Sitting on the upper deck on the left gives the better shore.',
    ],
    deepLinks: [{ label: 'Rigi timetable', kind: 'timetable', template: 'https://www.rigi.ch/en' }],
    sources: ['https://www.rigi.ch/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-lake-lucerne-boats',
    title: 'Lake Lucerne boats',
    countryCode: 'CH',
    category: 'ferry',
    summary:
      'Scheduled passenger boats from Lucerne to the lakeside villages, included in the Swiss Travel Pass and a pleasant way to reach Vitznau or Weggis.',
    match: {
      modes: ['boat', 'ferry'],
      operators: ['SGV', 'Lake Lucerne Navigation'],
      keywords: ['boat', 'bahnhofquai', 'vitznau', 'weggis'],
      placeKeys: ['ch-luzern-bahnhofquai', 'ch-vitznau', 'ch-weggis'],
    },
    official: { name: 'SGV Lake Lucerne', url: 'https://www.lakelucerne.ch/en/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Covered by the pass and boarded without a reservation. Arrive 15 minutes early if you want a seat on the open upper deck.',
    },
    passCoverage: [{ passId: SWISS_PASS, coverage: 'covered' }],
    seasonal: {
      offSeasonMonths: [11, 12, 1, 2, 3],
      note: 'Sailings thin out considerably in winter.',
    },
    gotchas: [
      'The paddle steamers run on a subset of departures and are worth choosing deliberately if you care.',
    ],
    sources: ['https://www.lakelucerne.ch/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-grindelwald-first',
    title: 'Grindelwald First',
    countryCode: 'CH',
    category: 'gondola',
    summary:
      'A gondola from the village to a ridge with the Cliff Walk, the Bachalpsee hike, and the mountain cart and trottibike descents.',
    match: {
      kinds: ['gondola', 'mountain-railway'],
      modes: ['gondola', 'cablecar'],
      operators: ['Jungfrau', 'Firstbahn'],
      keywords: ['first', 'firstbahn', 'cliff walk', 'bachalpsee', 'mountain cart'],
      placeKeys: ['ch-first', 'ch-grindelwald-firstbahn', 'ch-bort', 'ch-schreckfeld'],
    },
    official: { name: 'Jungfrau Region', url: 'https://www.jungfrau.ch/en-gb/' },
    bookAdvice: {
      latestDaysBefore: 3,
      note: 'Buy online a few days ahead for a weekend or holiday, otherwise the valley station on the morning is fine. Decide by the forecast.',
    },
    passCoverage: [{ passId: SWISS_PASS, coverage: 'discount', note: '50 per cent off.' }],
    seasonal: {
      offSeasonMonths: [11],
      note: 'The adventure activities run on a shorter season than the gondola itself, and close in poor weather with no notice.',
    },
    gotchas: [
      'The mountain cart and trottibike run between Schreckfeld and Bort, not from the top, so the day involves riding the gondola down one stage first.',
      'They close when the track is wet. Treat them as a bonus rather than the reason for the day.',
      'Bachalpsee is a two-hour return walk on an easy path, and it is the best thing up there in clear weather.',
    ],
    deepLinks: [
      {
        label: 'Jungfrau Region tickets',
        kind: 'book',
        template: 'https://www.jungfrau.ch/en-gb/',
      },
    ],
    sources: ['https://www.jungfrau.ch/en-gb/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-oeschinensee',
    title: 'Oeschinensee gondola and toboggan run',
    countryCode: 'CH',
    category: 'gondola',
    summary:
      'A gondola above Kandersteg to a turquoise lake in a mountain bowl, with a summer toboggan run beside the top station.',
    match: {
      kinds: ['gondola'],
      modes: ['gondola', 'cablecar'],
      operators: ['Oeschinensee'],
      keywords: ['oeschinen', 'oeschinensee', 'rodelbahn', 'kandersteg'],
      placeKeys: ['ch-oeschinensee', 'ch-oeschinen-gondola-base', 'ch-kandersteg'],
    },
    official: { name: 'Oeschinensee Bergbahnen', url: 'https://www.oeschinensee.ch/en/' },
    bookAdvice: {
      latestDaysBefore: 3,
      note: 'Book the gondola online a few days before in high season. The toboggan run is paid at the ride itself.',
    },
    passCoverage: [{ passId: SWISS_PASS, coverage: 'discount', note: '50 per cent off.' }],
    seasonal: {
      offSeasonMonths: [11, 4],
      note: 'The gondola closes for maintenance between seasons, and the toboggan run does not operate in the wet.',
    },
    gotchas: [
      'It is a 20 to 25 minute walk from the top station to the lake, or a short electric shuttle. Neither is included in the gondola ticket.',
      'This is the day to spend your clearest weather on. The lake without sun is a grey puddle.',
    ],
    sources: ['https://www.oeschinensee.ch/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-blausee',
    title: 'Blausee Nature Park',
    countryCode: 'CH',
    category: 'attraction',
    summary:
      'A small, intensely blue spring-fed lake in a private nature park near Kandersteg, with a visitor cap and a reservation requirement.',
    match: {
      kinds: ['attraction'],
      keywords: ['blausee'],
      placeKeys: ['ch-blausee'],
    },
    official: { name: 'Blausee', url: 'https://www.blausee.ch/en/' },
    bookAdvice: {
      latestDaysBefore: 7,
      note: 'Reserve ahead. It is a private park that limits numbers, and turning up without a booking can mean not getting in.',
    },
    gotchas: [
      'Reached by PostBus from Kandersteg station, which is covered by the Swiss Travel Pass but runs to a timetable you need to check both ways.',
      'It is small. An hour and a half is plenty, and the day works best paired with Oeschinensee.',
    ],
    sources: ['https://www.blausee.ch/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-postbus',
    title: 'PostBus, the yellow buses',
    countryCode: 'CH',
    category: 'bus',
    summary:
      'The bus network that reaches everywhere the trains do not, timed to connect with them and covered by the Swiss Travel Pass.',
    match: {
      modes: ['bus'],
      operators: ['PostBus', 'PostAuto'],
      keywords: ['postbus', 'bus', 'kandersteg', 'blausee'],
      countries: ['CH'],
    },
    official: { name: 'PostBus', url: 'https://www.postauto.ch/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Covered by the pass, no booking. The thing to check is the timetable, since rural routes can be hourly or less.',
    },
    passCoverage: [{ passId: SWISS_PASS, coverage: 'covered' }],
    gotchas: [
      'Departures are timed off the arriving train. If you miss the train you often miss the bus by an hour, not by minutes.',
    ],
    sources: ['https://www.postauto.ch/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'ch-lauterbrunnen-wengen',
    title: 'Lauterbrunnen, Wengen and Murren',
    countryCode: 'CH',
    category: 'mountain-railway',
    summary:
      'A valley of waterfalls with two car-free villages above it, reachable by mountain railway and cable car. The right choice for a cloudy day.',
    match: {
      modes: ['train', 'cablecar', 'cogwheel'],
      keywords: ['lauterbrunnen', 'wengen', 'murren', 'staubbach', 'grutschalp'],
      placeKeys: ['ch-lauterbrunnen', 'ch-wengen', 'ch-muerren', 'ch-gruetschalp'],
    },
    official: { name: 'Jungfrau Region', url: 'https://www.jungfrau.ch/en-gb/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'All covered by the Swiss Travel Pass and boarded without a booking, which makes this the flexible day in the Bernese Oberland.',
    },
    passCoverage: [
      {
        passId: SWISS_PASS,
        coverage: 'covered',
        note: '[unverified] Coverage on the Lauterbrunnen valley lines is good but check the specific leg to Murren.',
      },
    ],
    gotchas: [
      'Staubbach Falls carries much less water late in the season than the photographs suggest.',
      'Wengen and Murren are car-free, which is the point, and everything is uphill from the station.',
    ],
    sources: ['https://www.jungfrau.ch/en-gb/'],
    lastReviewed: REVIEWED,
  },
];
