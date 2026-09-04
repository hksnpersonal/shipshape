/**
 * France, Belgium and the Netherlands.
 *
 * Checked 2026-09-04. Facts not confirmed against an official source are marked
 * "[unverified]".
 */
import type { Guide } from '@/playbook/types';

const REVIEWED = '2026-09-04';

export const franceGuides: Guide[] = [
  {
    id: 'fr-tgv-lyria',
    title: 'TGV Lyria, Switzerland to France',
    countryCode: 'FR',
    category: 'international-train',
    summary:
      'The direct high-speed service between Basel or Geneva and Paris. Reserved seats, cheap when booked early, and not something you can catch the next one of.',
    match: {
      kinds: ['international-train', 'train'],
      modes: ['train'],
      operators: ['TGV Lyria', 'Lyria', 'SNCF'],
      keywords: ['lyria', 'tgv', 'basel'],
      placeKeys: ['ch-basel-sbb', 'fr-paris-gare-de-lyon'],
    },
    official: { name: 'TGV Lyria', url: 'https://www.tgv-lyria.com/en/' },
    resellers: [
      {
        name: 'SNCF Connect',
        url: 'https://www.sncf-connect.com/en-en/',
        trust: 'fine',
        note: 'The French national seller, same stock and same price.',
      },
      {
        name: 'Trainline',
        url: 'https://www.thetrainline.com/',
        trust: 'ok-with-markup',
        note: 'Convenient if you are buying several countries at once.',
      },
    ],
    ticketsOpen: { daysBefore: 120, note: '[unverified] Roughly four months, sometimes three.' },
    bookAdvice: {
      latestDaysBefore: 45,
      note: 'Book early. This is a single daily-ish service on a popular route and the cheap fares go first.',
    },
    refundRules:
      'Standard advance fares are non-refundable and non-changeable. A missed departure is a new ticket at the walk-up price.',
    gotchas: [
      'A Swiss Travel Pass does not cover the French portion. The Lyria ticket is separate and must be bought.',
      'Because it is non-refundable, treat any connection into Basel as needing a real margin, not a five-minute one.',
      'It arrives at Paris Gare de Lyon, which is across the city from Gare du Nord. Allow around 25 minutes on the metro plus walking.',
    ],
    deepLinks: [
      { label: 'TGV Lyria booking', kind: 'book', template: 'https://www.tgv-lyria.com/en/' },
    ],
    sources: ['https://www.tgv-lyria.com/en/', 'https://www.sncf-connect.com/en-en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'fr-eurostar',
    title: 'Eurostar to Brussels, Amsterdam and London',
    countryCode: 'FR',
    category: 'international-train',
    summary:
      'High-speed international services from Paris Gare du Nord. Reserved seats, airport-style check-in for some routes, and steep price rises close to departure.',
    match: {
      kinds: ['international-train'],
      modes: ['train'],
      operators: ['Eurostar', 'Thalys'],
      keywords: ['eurostar', 'brussels', 'amsterdam', 'thalys'],
      placeKeys: ['fr-paris-gare-du-nord', 'be-brussels-midi', 'nl-amsterdam-centraal'],
    },
    official: { name: 'Eurostar', url: 'https://www.eurostar.com/' },
    ticketsOpen: { daysBefore: 180, note: '[unverified] Around six months ahead.' },
    bookAdvice: {
      latestDaysBefore: 45,
      note: 'Book well ahead. Fares climb sharply in the final weeks and the cheapest tickets are gone months out.',
    },
    refundRules:
      'Standard fares are non-refundable. Changes cost a fee plus any fare difference, which on a busy train is substantial.',
    gotchas: [
      'Arrive at the station with real margin. Paris to Brussels and Amsterdam boards from a dedicated area and closes before departure.',
      'Have the ticket available offline. Station wifi at Gare du Nord is not something to depend on at 06:30.',
      'Journey times differ by service. Paris to Brussels is around an hour and a half, not two hours, so a plan built on the longer figure wastes a morning.',
    ],
    deepLinks: [{ label: 'Eurostar booking', kind: 'book', template: 'https://www.eurostar.com/' }],
    sources: ['https://www.eurostar.com/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'fr-paris-metro',
    title: 'Paris metro tickets',
    countryCode: 'FR',
    category: 'metro',
    summary:
      'Contactless bank cards now work directly at the gates, which is the simplest option for a visitor. Paper tickets have been phased out in favour of the Navigo Easy card.',
    match: {
      modes: ['metro', 'bus', 'tram'],
      keywords: ['metro', 'navigo', 'ratp', 'line 1', 'line 4', 'line 6', 'line 14'],
      countries: ['FR'],
    },
    official: { name: 'Ile-de-France Mobilites', url: 'https://www.iledefrance-mobilites.fr/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Nothing to book. Tap a contactless card, or buy a Navigo Easy card at a machine and load journeys onto it.',
    },
    gotchas: [
      '[unverified] Contactless bank card acceptance has been rolling out across the network. Have a Navigo Easy card as a fallback.',
      'A metro journey covers changes within the metro but not a transfer to a bus on the same fare.',
      'Interchange walks at Chatelet and Montparnasse are genuinely long. Add ten minutes to any route that changes there.',
    ],
    sources: ['https://www.iledefrance-mobilites.fr/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'fr-paris-museums',
    title: 'Paris museums and monuments',
    countryCode: 'FR',
    category: 'museum',
    summary:
      'The major sites use timed entry booked on their own websites. The exteriors, gardens and bridges that make up most photo itineraries are free.',
    match: {
      kinds: ['attraction'],
      keywords: ['louvre', 'arc de triomphe', 'notre-dame', 'orsay'],
      countries: ['FR'],
    },
    official: { name: 'Musee du Louvre', url: 'https://www.louvre.fr/en' },
    bookAdvice: {
      latestDaysBefore: 14,
      note: 'Book a timed slot for anything you intend to go inside. If your plan is courtyards and photographs, book nothing.',
    },
    gotchas: [
      'The Louvre is closed on Tuesdays. The pyramid and courtyard are open ground and can be walked through any day.',
      'Notre-Dame has its own visiting arrangements separate from the square outside. Check before building a morning around going in.',
      'The Arc de Triomphe rooftop is ticketed and reached by an underpass, not by crossing the roundabout.',
    ],
    sources: ['https://www.louvre.fr/en'],
    lastReviewed: REVIEWED,
  },
];

export const belgiumGuides: Guide[] = [
  {
    id: 'be-brussels-transport',
    title: 'Getting around Brussels',
    countryCode: 'BE',
    category: 'metro',
    summary:
      'Metro, tram and bus on one ticket. From Brussels Midi the centre is about twenty minutes on foot or a couple of stops underground.',
    match: {
      modes: ['metro', 'tram', 'bus'],
      operators: ['STIB', 'MIVB'],
      keywords: ['brussels', 'stib', 'midi', 'grand place'],
      placeKeys: ['be-brussels-midi', 'be-brussels-grand-place'],
    },
    official: { name: 'STIB-MIVB', url: 'https://www.stib-mivb.be/index.htm?l=en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Buy at a station machine or tap a contactless card. For a single day trip, a day pass is usually cheaper than four singles.',
    },
    gotchas: [
      'Brussels Midi is also called Bruxelles-Midi and Brussel-Zuid. All three names mean the same station, and signs switch between them.',
      'The walk from Midi to the Grand Place is about twenty minutes and unremarkable. The metro is worth it if the day is short.',
    ],
    sources: ['https://www.stib-mivb.be/index.htm?l=en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'be-brussels-sights',
    title: 'Grand Place, Manneken Pis and the chocolate',
    countryCode: 'BE',
    category: 'attraction',
    summary:
      'The centre is compact and almost entirely free to walk. What costs money is chocolate and waffles, and quality varies enormously by street.',
    match: {
      keywords: ['grand place', 'manneken', 'galeries royales', 'waffle', 'chocolate'],
      countries: ['BE'],
    },
    official: { name: 'Visit Brussels', url: 'https://www.visit.brussels/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Nothing to book for a day trip. The square, the galleries and the statue are all open street.',
    },
    gotchas: [
      'Manneken Pis is much smaller than photographs imply and is a two-minute stop, not an attraction.',
      'The waffle stands immediately around the Grand Place are the tourist tier. Walking two streets out improves things noticeably.',
      'The historic chocolate houses have shops in the Galeries Royales Saint-Hubert, which is also the nicest indoor walk if it rains.',
    ],
    sources: ['https://www.visit.brussels/en'],
    lastReviewed: REVIEWED,
  },
];

export const netherlandsGuides: Guide[] = [
  {
    id: 'nl-ns-trains',
    title: 'Dutch trains and OVpay',
    countryCode: 'NL',
    category: 'train',
    summary:
      'Frequent turn-up-and-go services with no reservations. Tapping a contactless card in and out is the simplest way to pay.',
    match: {
      kinds: ['train', 'regional-train'],
      modes: ['train'],
      operators: ['NS', 'Nederlandse Spoorwegen'],
      keywords: ['ns', 'zaandijk', 'schiphol', 'centraal'],
      placeKeys: ['nl-amsterdam-centraal', 'nl-zaandijk-zaanse-schans', 'nl-schiphol'],
    },
    official: { name: 'NS', url: 'https://www.ns.nl/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'No booking. Tap in at the gate with a contactless card and tap out at the other end.',
    },
    gotchas: [
      'You must tap out. Forgetting leaves the journey open and charges a maximum fare.',
      'Everyone in the group needs their own card. One card cannot cover two people.',
      'Amsterdam Centraal to Zaandijk Zaanse Schans is a train, not a metro. It leaves from the main platforms.',
    ],
    deepLinks: [{ label: 'NS timetable', kind: 'timetable', template: 'https://www.ns.nl/en' }],
    sources: ['https://www.ns.nl/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'nl-amsterdam-transport',
    title: 'Amsterdam metro, tram and bus',
    countryCode: 'NL',
    category: 'metro',
    summary:
      'GVB runs the city network, separate from the national railway. Europaplein and the RAI are on the north-south metro line into the centre.',
    match: {
      modes: ['metro', 'tram', 'bus'],
      operators: ['GVB'],
      keywords: ['gvb', 'tram', 'europaplein', 'rai', 'dam square'],
      placeKeys: ['nl-amsterdam-europaplein'],
    },
    official: { name: 'GVB', url: 'https://www.gvb.nl/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Tap a contactless card, or buy a GVB day ticket if you will make more than four journeys in a day.',
    },
    gotchas: [
      'GVB day tickets do not cover NS trains, so they are no use for the airport or Zaanse Schans.',
      'Cyclists have priority in practice as well as in law. Look right before stepping off any kerb.',
    ],
    sources: ['https://www.gvb.nl/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'nl-amsterdam-city-card',
    title: 'Is the Amsterdam City Card worth it?',
    countryCode: 'NL',
    category: 'city-card',
    summary:
      'Bundles museum entry, GVB transport and a canal cruise for a fixed daily price. It pays for itself only on a museum-heavy schedule.',
    match: {
      kinds: ['city-card'],
      keywords: ['city card', 'iamsterdam', 'amsterdam card'],
      countries: ['NL'],
    },
    official: { name: 'I amsterdam City Card', url: 'https://www.iamsterdam.com/en/city-card' },
    bookAdvice: {
      latestDaysBefore: 3,
      note: 'Do the arithmetic before buying. Add up the entry prices of the museums you will genuinely visit, then compare. Two or fewer museums a day and it does not pay.',
    },
    gotchas: [
      'The clock starts when you first use it and runs continuously, not by calendar day.',
      'It covers GVB city transport but not the NS train to Schiphol or Zaandijk.',
      'A canal cruise is included, which is a large part of the value if you were going to do one anyway.',
    ],
    sources: ['https://www.iamsterdam.com/en/city-card'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'nl-canal-cruise',
    title: 'Amsterdam canal cruises',
    countryCode: 'NL',
    category: 'attraction',
    summary:
      'An hour on the water from several departure points. Operators differ more in boat than in route, and the covered glass-topped boats are the common option.',
    match: {
      kinds: ['attraction'],
      keywords: ['canal cruise', 'canal'],
      placeKeys: ['nl-amsterdam-canal-cruise-pier'],
    },
    official: { name: 'I amsterdam', url: 'https://www.iamsterdam.com/en' },
    bookAdvice: {
      latestDaysBefore: 3,
      note: 'Book a specific departure a few days ahead in season, and note which pier it leaves from. There are several and they are not close together.',
    },
    gotchas: [
      'Departure points near Centraal and near the Rijksmuseum are twenty minutes apart. Check the ticket rather than the operator name.',
      'The last cruise of the day is often the nicest and the least crowded.',
    ],
    sources: ['https://www.iamsterdam.com/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'nl-schiphol-departure',
    title: 'Leaving from Schiphol, and the VAT refund',
    countryCode: 'NL',
    category: 'airport',
    summary:
      'A large, efficient airport with a direct train from the city. The thing that eats time on departure is a VAT refund claim, not the airport itself.',
    match: {
      kinds: ['flight'],
      keywords: ['schiphol', 'vat', 'tax refund', 'departure'],
      placeKeys: ['nl-schiphol'],
    },
    official: { name: 'Schiphol Airport', url: 'https://www.schiphol.nl/en/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Nothing to book. What to plan is the journey in: trains from Amsterdam RAI and Centraal are frequent and take about 15 to 20 minutes.',
    },
    gotchas: [
      'A VAT refund needs the goods, the receipts and the forms, stamped before you check the bags containing them. Doing this properly takes an hour on a busy morning.',
      'As a non-EU resident departing the EU, this is your last chance to claim on anything bought in Italy, Switzerland aside, France or the Netherlands.',
      'Check whether your flight leaves from a non-Schengen pier, which adds a passport control queue after security.',
    ],
    sources: ['https://www.schiphol.nl/en/'],
    lastReviewed: REVIEWED,
  },
];
