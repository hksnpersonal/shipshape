/**
 * Advice that is not about one country: how far ahead to buy, who to buy from, and the
 * handful of things that go wrong for a first-time visitor regardless of where they are.
 *
 * Checked 2026-09-04.
 */
import type { Guide } from '@/playbook/types';

const REVIEWED = '2026-09-04';

export const euGuides: Guide[] = [
  {
    id: 'eu-airport-lead-time',
    title: 'How early to be at the airport, and why',
    countryCode: 'EU',
    category: 'airport',
    summary:
      'For a long-haul departure the number that matters is not the flight time but the sum of bag drop, any tax refund, passport control and security.',
    match: { kinds: ['flight'], modes: ['flight'], keywords: ['airport', 'flight', 'check in'] },
    official: { name: 'Your airline', url: 'https://www.iata.org/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Nothing to book, but budget three hours for a long-haul departure and four if you are claiming a tax refund or travelling in a school holiday.',
    },
    gotchas: [
      'A tax refund claim must happen before you check the bag holding the goods, which means arriving earlier, not just leaving earlier.',
      'Leaving the Schengen area adds a passport control queue that domestic European flights do not have.',
      'Hotel checkout is usually 10:00 or 11:00. If your flight is in the afternoon, the gap between checkout and departure is real time you need a plan for.',
    ],
    sources: [],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-buying-rail-tickets',
    title: 'Where to buy European train tickets',
    countryCode: 'EU',
    category: 'train',
    summary:
      'The operator sells the same seat as the aggregator, usually for less. Aggregators earn their fee only when a journey crosses several operators.',
    match: { kinds: ['train', 'international-train', 'regional-train'], modes: ['train'] },
    official: { name: 'The operator running the train', url: 'https://www.raileurope.com/' },
    resellers: [
      {
        name: 'Trainline',
        url: 'https://www.thetrainline.com/',
        trust: 'ok-with-markup',
        note: 'Reliable, adds a booking fee, and genuinely useful for a multi-country trip in one basket.',
      },
      {
        name: 'Omio',
        url: 'https://www.omio.com/',
        trust: 'ok-with-markup',
        note: 'Best as a comparison tool. Find the train, then buy from the operator.',
      },
      {
        name: 'Rail Europe',
        url: 'https://www.raileurope.com/',
        trust: 'ok-with-markup',
        note: 'Aimed at overseas visitors, with the pricing that implies.',
      },
    ],
    bookAdvice: {
      latestDaysBefore: 45,
      note: 'For reserved high-speed and international trains, book six weeks out or more. For regional trains with fixed fares, book nothing.',
    },
    trustNotes: [
      'No reseller has access to cheaper stock than the operator. What you pay a fee for is one account, one language and one support line.',
      'If a site is charging noticeably more than the operator for the same train, that difference is its margin, not a better seat.',
    ],
    gotchas: [
      'A reseller booking means dealing with the reseller when something goes wrong, not the railway. On a tight connection that is a real disadvantage.',
    ],
    sources: [],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-advance-fares-and-missed-trains',
    title: 'What a missed train actually costs',
    countryCode: 'EU',
    category: 'train',
    summary:
      'Cheap international fares are tied to one departure. Miss it and you are buying a new ticket at the walk-up price, which can be several times what you paid.',
    match: { kinds: ['train', 'international-train'], keywords: ['advance', 'non-refundable'] },
    official: { name: 'Your operator', url: 'https://www.eurostar.com/' },
    bookAdvice: {
      latestDaysBefore: 45,
      note: 'When you hold a non-refundable ticket, buy margin instead of speed. An earlier connecting train costs nothing; a missed one costs the fare again.',
    },
    refundRules:
      'Advance and promotional fares are typically non-refundable and non-changeable. Flexible fares cost more and are worth it on the leg where a delay upstream would hurt.',
    gotchas: [
      "A delay on a separately booked earlier leg is your problem, not the operator's. Through tickets protect connections; separate tickets do not.",
      'Thirty minutes between a scheduled arrival and a non-refundable departure is not a connection, it is a bet.',
    ],
    sources: [],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-seat-reservations',
    title: 'Passes, seats, and the difference between them',
    countryCode: 'EU',
    category: 'pass',
    summary:
      'A rail pass buys the right to travel. On many high-speed and international trains it does not buy a seat, which is bought separately and can sell out.',
    match: { kinds: ['pass'], keywords: ['pass', 'reservation', 'seat'] },
    official: { name: 'Eurail', url: 'https://www.eurail.com/en' },
    bookAdvice: {
      latestDaysBefore: 30,
      note: 'If your route uses a pass on a train that requires reservations, book the reservation as early as the pass allows. The quota for pass holders is small.',
    },
    gotchas: [
      'Switzerland is the pleasant exception: most trains take no reservation and a pass is enough to board.',
      'France, Italy and international high-speed services are the opposite, and a pass without a reservation is not a ticket to travel.',
    ],
    sources: ['https://www.eurail.com/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-offline-tickets',
    title: 'Keeping tickets usable without signal',
    countryCode: 'EU',
    category: 'train',
    summary:
      'Every ticket you will need is a QR code, and every place you will need it is somewhere with poor signal: a platform, a mountain, an early-morning station.',
    match: { keywords: ['ticket', 'qr', 'offline', 'boarding pass'] },
    official: { name: 'Your operator app', url: 'https://www.eurostar.com/' },
    bookAdvice: {
      latestDaysBefore: 1,
      note: 'The evening before each travel day, save every ticket as a PDF or a screenshot in your phone gallery, not only in the operator app.',
    },
    gotchas: [
      'Operator apps often need a network to re-render a ticket, even one you have already downloaded.',
      'A screenshot cannot be revoked by an app update or a logged-out session.',
      'Bring a power bank. A phone that holds every ticket is a single point of failure.',
    ],
    sources: [],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-luggage-between-checkout-and-train',
    title: 'Luggage between checkout and a late departure',
    countryCode: 'EU',
    category: 'hotel',
    summary:
      'Almost every hotel will hold bags after checkout and before check-in, at no cost. Stations have lockers or a staffed left-luggage office for the days you have neither.',
    match: { kinds: ['hotel'], keywords: ['luggage', 'check out', 'store', 'deposit'] },
    official: { name: 'Your hotel', url: 'https://www.booking.com/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Ask at checkout on the morning. Nothing to arrange in advance, but confirm the hotel does it if your last day depends on it.',
    },
    gotchas: [
      'Station left-luggage offices in Italy charge by the hour and can have a queue at midday.',
      'An early arrival works the same way: most hotels will take the bags well before the room is ready, which turns a wasted morning into a usable one.',
    ],
    sources: [],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-entry-requirements',
    title: 'Entering the Schengen area on an Australian passport',
    countryCode: 'EU',
    category: 'airport',
    summary:
      'Short visits are visa-free, with a limit on days within any rolling period, a passport validity rule, and new border systems being introduced.',
    match: { keywords: ['passport', 'visa', 'schengen', 'immigration', 'entry'] },
    official: {
      name: 'European Union immigration portal',
      url: 'https://immigration-portal.ec.europa.eu/',
    },
    bookAdvice: {
      latestDaysBefore: 90,
      note: 'Check passport validity three months before you fly. The usual rule is at least three months remaining beyond your intended departure from the area, and at least ten years since issue.',
    },
    gotchas: [
      '[unverified] Entry and exit registration systems for non-EU visitors have been phasing in. Check the official portal close to departure, as queue times at first entry may be longer than usual.',
      'Switzerland is in the Schengen area but not the EU. There is no passport control on the Italy to Switzerland train, but there is a customs boundary.',
      '[unverified] A separate travel authorisation for visa-exempt visitors has been announced. Confirm whether it applies to your dates before you travel.',
    ],
    sources: ['https://immigration-portal.ec.europa.eu/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'eu-seat-side-for-views',
    title: 'Which side of the train to sit on',
    countryCode: 'EU',
    category: 'train',
    summary:
      'On scenic routes the view is genuinely one-sided, and on unreserved trains choosing the right side costs nothing but boarding a few minutes early.',
    match: { modes: ['train', 'boat', 'cogwheel'], keywords: ['scenic', 'view', 'seat'] },
    official: { name: 'Seat 61', url: 'https://www.seat61.com/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'On a reserved train, ask for the side when you book. On an unreserved Swiss train, get to the platform early and pick the seat.',
    },
    gotchas: [
      'Which side is better depends on the direction of travel, so a note that says "sit left" is only useful with the departure city attached.',
      'On the cogwheel railways the good side is usually the downhill one, which is the right going up from the valley.',
    ],
    sources: ['https://www.seat61.com/'],
    lastReviewed: REVIEWED,
  },
];
