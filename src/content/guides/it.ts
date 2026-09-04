/**
 * Italy: where to buy, when, and what catches people out.
 *
 * Checked 2026-09-04. Anything not confirmed against an official source that day is
 * prefixed "[unverified]" so a reader knows the difference between a fact and a
 * recollection.
 */
import type { Guide } from '@/playbook/types';

const REVIEWED = '2026-09-04';

export const italyGuides: Guide[] = [
  {
    id: 'it-trenitalia-highspeed',
    title: 'Frecciarossa and other Trenitalia high-speed trains',
    countryCode: 'IT',
    category: 'train',
    summary:
      'Reserved-seat high-speed trains between the big cities. Cheap if booked early, expensive on the day, and the seat is assigned when you buy.',
    match: {
      kinds: ['train', 'international-train'],
      modes: ['train'],
      operators: ['Trenitalia', 'Frecciarossa', 'Frecciargento'],
      keywords: ['frecciarossa', 'freccia', 'trenitalia'],
      placeKeys: ['it-roma-termini', 'it-firenze-smn', 'it-milano-centrale'],
    },
    official: {
      name: 'Trenitalia',
      url: 'https://www.trenitalia.com/en.html',
      note: 'The Trenitalia app is the easiest place to keep the ticket offline.',
    },
    resellers: [
      {
        name: 'Trainline',
        url: 'https://www.thetrainline.com/',
        trust: 'ok-with-markup',
        note: 'Clean interface and one place for several countries, with a small booking fee.',
      },
      {
        name: 'Omio',
        url: 'https://www.omio.com/',
        trust: 'ok-with-markup',
        note: 'Good for comparing train against bus and plane, then buy direct if the price matches.',
      },
    ],
    ticketsOpen: { daysBefore: 120, note: 'Roughly four months ahead, sometimes less.' },
    bookAdvice: {
      latestDaysBefore: 30,
      note: 'Book as far ahead as you are certain of the date. Super Economy fares vanish first and the walk-up Base fare can be three times the price.',
    },
    refundRules:
      'Super Economy is not refundable and not changeable. Economy allows one change for a fee. Base is fully flexible and refundable up to departure.',
    changeRules:
      'If you hold a cheap fare, treat the departure time as fixed. Missing it usually means buying again.',
    priceSignals: ['Rome to Florence is commonly EUR 20-30 booked early and EUR 50-90 on the day.'],
    gotchas: [
      'The seat is printed on the ticket. Coaches are numbered on the platform display, so find your coach before the train arrives.',
      'Roma Termini and Firenze Santa Maria Novella are both terminus stations, so the platform is often announced only 10 to 15 minutes before departure.',
      '[unverified] Ticket gates at Termini and Milano Centrale sometimes require the QR code to be shown before you reach the platform.',
    ],
    trustNotes: [
      'Buying direct from Trenitalia is always at least as cheap as a reseller. There is no exclusive stock a reseller can offer you on these trains.',
    ],
    deepLinks: [
      {
        label: 'Trenitalia timetable',
        kind: 'timetable',
        template: 'https://www.trenitalia.com/en.html',
      },
    ],
    sources: ['https://www.trenitalia.com/en.html'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-italo',
    title: 'Italo high-speed trains',
    countryCode: 'IT',
    category: 'train',
    summary:
      'A private operator running the same high-speed routes as Trenitalia, often a little cheaper and worth checking against it.',
    match: {
      kinds: ['train'],
      modes: ['train'],
      operators: ['Italo', 'NTV'],
      keywords: ['italo'],
    },
    official: { name: 'Italo', url: 'https://www.italotreno.com/en' },
    ticketsOpen: { daysBefore: 120 },
    bookAdvice: {
      latestDaysBefore: 30,
      note: 'Same logic as Trenitalia: early is cheap, late is not. Always price both operators for the same journey, they are genuinely competitive.',
    },
    refundRules:
      'Low Cost fares are not refundable. Economy and Flex allow changes for a fee or free respectively.',
    gotchas: [
      'Italo does not always use the same station as Trenitalia in every city, though in Florence and Venice it does.',
    ],
    sources: ['https://www.italotreno.com/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-regional-trains',
    title: 'Regional trains and the validation rule',
    countryCode: 'IT',
    category: 'regional-train',
    summary:
      'Slow trains with no seat reservation and a flat fare that does not change with demand. The famous validation rule now applies only to paper tickets.',
    match: {
      kinds: ['regional-train'],
      modes: ['train'],
      operators: ['Trenitalia', 'Trenord'],
      keywords: ['regional', 'regionale', 'pisa', 'varenna'],
      placeKeys: ['it-pisa-centrale', 'it-pisa-san-rossore', 'it-varenna-esino'],
    },
    official: {
      name: 'Trenitalia regional',
      url: 'https://www.trenitalia.com/en/information/travelling-on-regional-trains.html',
    },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Buy on the day. The fare is fixed, so booking ahead saves nothing and locks you to a train you may not want.',
    },
    validation: {
      required: true,
      note: 'A paper ticket bought at the station must be stamped in a trackside machine before you board, on the day of travel. A ticket bought online or in the app is already validated and needs no stamping.',
    },
    refundRules:
      'A paper regional ticket is usually valid for a period after purchase rather than for one named train, so a missed train is not a lost ticket.',
    gotchas: [
      'Travelling on an unstamped paper ticket is treated as travelling without one, and the fine is charged on the spot.',
      'A digital regional ticket is personal and non-transferable, and staff may ask for photo identification with it.',
      'Keep the QR code reachable offline. Station gates and onboard inspections both ask for it.',
    ],
    trustNotes: [
      'There is no advantage to a reseller here. Buy at the machine, the counter, or in the Trenitalia app.',
    ],
    sources: [
      'https://www.trenitalia.com/en/information/travelling-on-regional-trains.html',
      'https://www.trenitalia.com/en/information/digital-regional-ticket.html',
    ],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-trenord-como',
    title: 'Milan to Lake Como by train, and the combined boat ticket',
    countryCode: 'IT',
    category: 'regional-train',
    summary:
      'Milano Centrale to Varenna-Esino takes about an hour on a regional service. The Trenord desk sells a combined rail and lake-boat ticket that saves queueing at the pier.',
    match: {
      kinds: ['regional-train'],
      modes: ['train'],
      operators: ['Trenord'],
      keywords: ['varenna', 'como', 'trenord'],
      placeKeys: ['it-varenna-esino'],
    },
    official: { name: 'Trenord', url: 'https://www.trenord.it/en/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Buy at Milano Centrale on the morning. Ask specifically for the combined rail plus Varenna to Bellagio boat ticket if you want it.',
    },
    gotchas: [
      'Varenna-Esino station is a walk downhill from the pier, and back uphill on the return. Allow more than the map suggests with luggage or tired legs.',
      '[unverified] The combined ticket was noted at around EUR 14 for the boat portion. Confirm the current price at the desk.',
    ],
    sources: ['https://www.trenord.it/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-lake-como-ferries',
    title: 'Lake Como ferries',
    countryCode: 'IT',
    category: 'ferry',
    summary:
      'Public boats between Varenna, Bellagio, Menaggio and Cadenabbia. Frequent in summer, noticeably thinner once the summer timetable ends.',
    match: {
      kinds: ['ferry'],
      modes: ['ferry', 'boat'],
      operators: ['Navigazione Laghi', 'Navigazione Lago di Como'],
      keywords: ['ferry', 'bellagio', 'menaggio', 'varenna'],
      placeKeys: ['it-varenna-pier', 'it-bellagio-pier', 'it-menaggio-pier'],
    },
    official: {
      name: 'Navigazione Laghi',
      url: 'https://www.navigazionelaghi.it/en/tickets-and-timetables-lake-como/',
    },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Buy at the pier ticket office on the day. What matters is not the ticket but the timetable: check the last departure of the evening before you commit to the far shore.',
    },
    seasonal: {
      offSeasonMonths: [10, 11, 12, 1, 2, 3],
      note: 'The 2026 summer timetable runs to 4 October. From 5 October the service drops to roughly autumn frequency, and the last evening crossings are earlier than people expect.',
    },
    gotchas: [
      'The fast hydrofoil and the slow boat are priced differently and stop at different piers. Read the column headings on the timetable.',
      'If the evening Menaggio to Varenna crossing has finished for the day you are on the wrong side of the lake with a long detour. The land alternative is Menaggio to Como and a train back to Milan.',
    ],
    trustNotes: [
      'Only the operator timetable is authoritative. Third-party schedule pages go stale between seasons and are a common source of missed last boats.',
    ],
    deepLinks: [
      {
        label: 'Official timetables',
        kind: 'timetable',
        template: 'https://www.navigazionelaghi.it/en/tickets-and-timetables-lake-como/',
      },
    ],
    sources: ['https://www.navigazionelaghi.it/en/tickets-and-timetables-lake-como/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-leonardo-express',
    title: 'Leonardo Express, Fiumicino airport to Roma Termini',
    countryCode: 'IT',
    category: 'train',
    summary:
      'A non-stop train from the airport to the main station, about half an hour, running every 15 to 30 minutes.',
    match: {
      kinds: ['train'],
      modes: ['train'],
      keywords: ['leonardo express', 'fiumicino', 'fco'],
      placeKeys: ['it-rome-fco', 'it-roma-termini'],
    },
    official: {
      name: 'Trenitalia',
      url: 'https://www.trenitalia.com/en/services/leonardo_express.html',
    },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Buy at the machine in the arrivals hall. The fare is fixed and there is no reason to book ahead.',
    },
    gotchas: [
      'It is a flat fare that does not vary, so a prepaid voucher from a reseller saves nothing.',
      'The regional FL1 line is cheaper but does not serve Termini. Only take it if your hotel is near Trastevere, Ostiense or Tiburtina.',
    ],
    sources: ['https://www.trenitalia.com/en/services/leonardo_express.html'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-rome-public-transport',
    title: 'Rome metro and bus tickets',
    countryCode: 'IT',
    category: 'metro',
    summary:
      'One ticket type covers metro, bus and tram for 100 minutes. Day and multi-day passes exist and are worth it only if you ride a lot.',
    match: {
      modes: ['metro', 'bus', 'tram'],
      keywords: ['metro', 'atac', 'ottaviano', 'barberini', 'colosseo'],
      countries: ['IT'],
    },
    official: { name: 'ATAC Roma', url: 'https://www.atac.roma.it/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Buy at a metro machine, a tabaccheria, or tap a contactless card at the metro gate.',
    },
    gotchas: [
      'A single ticket is valid for 100 minutes across buses but only one metro entry.',
      'Buses are not reliably punctual. For a fixed appointment the metro is the safer choice even if the walk is longer.',
    ],
    sources: ['https://www.atac.roma.it/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-vatican-museums',
    title: 'Vatican Museums and the Sistine Chapel',
    countryCode: 'IT',
    category: 'museum',
    summary:
      'Timed entry that sells out weeks ahead in season. The official site is the cheapest, and resellers hold separate stock that appears when the official quota is gone.',
    match: {
      kinds: ['attraction'],
      keywords: ['vatican', 'sistine', 'musei vaticani'],
      placeKeys: ['it-rome-vatican-museums'],
    },
    official: {
      name: 'Musei Vaticani',
      url: 'https://tickets.museivaticani.va/',
      note: 'The only place selling at the base price plus the fixed online booking fee.',
    },
    resellers: [
      {
        name: 'Authorised tour operators',
        url: 'https://www.museivaticani.va/',
        trust: 'ok-with-markup',
        note: 'They hold their own time-slot quota, so they are the fallback when the official site shows nothing. You pay for that convenience.',
      },
    ],
    ticketsOpen: { daysBefore: 60, note: '[unverified] Roughly two months ahead.' },
    bookAdvice: {
      latestDaysBefore: 30,
      note: 'Book the moment your date is fixed. This is the single most likely thing on an Italian itinerary to be sold out when you get round to it.',
    },
    refundRules:
      'Official tickets are generally non-refundable and tied to a time slot. Many resellers offer free cancellation, which is part of what the markup buys.',
    priceSignals: [
      'The official adult ticket was EUR 20 plus a EUR 5 online booking fee at the time of writing.',
    ],
    gotchas: [
      'There is a dress code: shoulders and knees covered, for everyone. People are turned away at the door for this every day.',
      'Security screening is at the entrance, so a timed slot is the time you join the queue, not the time you walk in. Arrive 20 minutes early and expect to be there longer.',
      "St Peter's Basilica is free and separate, with its own security queue. It is not part of the museums ticket.",
    ],
    trustNotes: [
      'Sites with names resembling the official one are resellers. The official ticket office is tickets.museivaticani.va and nothing else.',
    ],
    deepLinks: [
      {
        label: 'Official ticket office',
        kind: 'book',
        template: 'https://tickets.museivaticani.va/',
      },
    ],
    sources: ['https://tickets.museivaticani.va/', 'https://www.museivaticani.va/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-st-peters-basilica',
    title: "St Peter's Basilica",
    countryCode: 'IT',
    category: 'attraction',
    summary:
      'Free to enter, no ticket, but a long security queue that is shortest at opening. The dome climb is a separate paid ticket.',
    match: { keywords: ['st peter', 'basilica', 'san pietro'], placeKeys: ['it-rome-st-peters'] },
    official: { name: "St Peter's Basilica", url: 'https://www.vatican.va/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Nothing to book for the basilica itself. Turn up early, ideally at opening, and the queue is minutes rather than an hour.',
    },
    gotchas: [
      'Anyone selling you a paid "skip the line" entry to the basilica is selling you a guided tour, because entry itself is free.',
      'The same dress code as the museums applies and is enforced at the door.',
    ],
    sources: ['https://www.vatican.va/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-galleria-borghese',
    title: 'Galleria Borghese',
    countryCode: 'IT',
    category: 'museum',
    summary:
      'Strictly timed two-hour entry slots with a hard visitor cap, closed Mondays. It sells out well ahead and there is no turning up on spec.',
    match: {
      kinds: ['attraction'],
      keywords: ['borghese'],
      placeKeys: ['it-rome-galleria-borghese'],
    },
    official: { name: 'Galleria Borghese', url: 'https://galleriaborghese.beniculturali.it/en/' },
    ticketsOpen: { daysBefore: 90, note: '[unverified] About three months ahead.' },
    bookAdvice: {
      latestDaysBefore: 21,
      note: 'Book the slot before you plan the rest of the afternoon around it. The gallery decides your time, not you.',
    },
    refundRules: '[unverified] Timed tickets are generally not refundable.',
    gotchas: [
      'Closed on Mondays. An itinerary that puts it on a Monday has to move it or drop it.',
      'You must leave at the end of your two hours, so a late arrival costs you the visit rather than delaying it.',
    ],
    sources: ['https://galleriaborghese.beniculturali.it/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-musei-capitolini',
    title: 'Musei Capitolini',
    countryCode: 'IT',
    category: 'museum',
    summary:
      'The civic museums on the Capitoline hill, and the best free-standing view over the Roman Forum from the terrace.',
    match: { keywords: ['capitolini', 'capitoline'], placeKeys: ['it-rome-capitolini'] },
    official: { name: 'Musei Capitolini', url: 'https://www.museicapitolini.org/en' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Tickets at the door are normally fine. Booking ahead only helps on a free-entry Sunday.',
    },
    gotchas: [
      'The Forum view most people come for is inside the ticketed area, reached through the Tabularium gallery.',
    ],
    sources: ['https://www.museicapitolini.org/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-doria-pamphilj',
    title: 'Galleria Doria Pamphilj',
    countryCode: 'IT',
    category: 'museum',
    summary:
      'A private palace gallery on the Corso with an excellent free audio guide narrated by the family. Quiet compared to the state museums.',
    match: { keywords: ['doria', 'pamphilj'], placeKeys: ['it-rome-doria-pamphilj'] },
    official: { name: 'Galleria Doria Pamphilj', url: 'https://www.doriapamphilj.it/roma/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Walk-up tickets are normally available. Check the opening days for your date, because a private gallery keeps its own calendar.',
    },
    gotchas: [
      'It is a private house and closes on days that state museums stay open, including some Sundays and holidays. Verify the specific date rather than the usual pattern.',
    ],
    sources: ['https://www.doriapamphilj.it/roma/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-florence-duomo',
    title: 'Florence cathedral complex',
    countryCode: 'IT',
    category: 'attraction',
    summary:
      'The cathedral itself is free to enter. The dome, bell tower, baptistery, crypt and museum are sold together as a pass, and the dome needs a timed slot.',
    match: {
      keywords: ['duomo', 'santa maria del fiore', 'brunelleschi', 'baptistery'],
      placeKeys: ['it-florence-duomo', 'it-florence-battistero'],
    },
    official: { name: 'Duomo di Firenze', url: 'https://duomo.firenze.it/en/home' },
    ticketsOpen: { daysBefore: 60 },
    bookAdvice: {
      latestDaysBefore: 14,
      note: 'Only needed if you want to climb the dome, which requires a booked time and sells out. For the cathedral floor and the exteriors, book nothing.',
    },
    gotchas: [
      'Cathedral opening hours are shorter than the square suggests and vary on Sundays and feast days.',
      'The dome climb is 463 steps with no lift and no way back down other than the way you came.',
    ],
    sources: ['https://duomo.firenze.it/en/home'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-uffizi',
    title: 'Uffizi Gallery',
    countryCode: 'IT',
    category: 'museum',
    summary:
      'Timed entry, long queues without a booking, and a courtyard that is free to walk through if you only want the exterior.',
    match: { keywords: ['uffizi'], placeKeys: ['it-florence-uffizi-courtyard'] },
    official: { name: 'Uffizi Galleries', url: 'https://www.uffizi.it/en' },
    bookAdvice: {
      latestDaysBefore: 14,
      note: 'Book a slot if you are going inside. The courtyard and the statues in the Loggia dei Lanzi cost nothing and need no ticket.',
    },
    gotchas: ['Closed on Mondays.'],
    sources: ['https://www.uffizi.it/en'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-pisa-miracoli',
    title: 'Piazza dei Miracoli, Pisa',
    countryCode: 'IT',
    category: 'attraction',
    summary:
      'The square and the outside of every building are free. Only going inside the tower, cathedral, baptistery and Camposanto needs a ticket.',
    match: {
      keywords: ['pisa', 'leaning tower', 'miracoli', 'camposanto'],
      placeKeys: ['it-pisa-piazza-miracoli', 'it-pisa-leaning-tower'],
    },
    official: { name: 'Opera della Primaziale Pisana', url: 'https://www.opapisa.it/en/' },
    bookAdvice: {
      latestDaysBefore: 7,
      note: 'Only the tower climb needs booking, and it is a timed slot with a bag rule. For photographs from the grass, buy nothing.',
    },
    gotchas: [
      'The tower climb has a strict no-bags rule with lockers nearby, which costs more time than the climb.',
      'Pisa has two useful stations. San Rossore is a ten-minute walk from the square and Pisa Centrale is about twenty-five, so check which one your ticket names.',
    ],
    sources: ['https://www.opapisa.it/en/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-villa-monastero',
    title: 'Villa Monastero, Varenna',
    countryCode: 'IT',
    category: 'attraction',
    summary:
      'A lakeside botanical garden and house museum along the Varenna waterfront, with a seasonal opening calendar.',
    match: { keywords: ['villa monastero'], placeKeys: ['it-varenna-villa-monastero'] },
    official: { name: 'Villa Monastero', url: 'https://villamonastero.eu/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Tickets at the gate. Check the seasonal calendar for your date, since autumn hours are shorter and some days are closed.',
    },
    seasonal: {
      offSeasonMonths: [11, 12, 1, 2],
      note: 'Hours contract sharply outside the main season.',
    },
    sources: ['https://villamonastero.eu/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-villa-melzi',
    title: 'Villa Melzi Gardens, Bellagio',
    countryCode: 'IT',
    category: 'attraction',
    summary:
      'Waterfront gardens a short walk from the Bellagio ferry pier, open seasonally and ticketed at the gate.',
    match: { keywords: ['villa melzi', 'melzi'], placeKeys: ['it-bellagio-villa-melzi'] },
    official: { name: 'Giardini di Villa Melzi', url: 'https://giardinidivillamelzi.it/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Pay at the entrance. Confirm the closing date for the season, as the gardens shut for winter earlier than the town does.',
    },
    seasonal: {
      offSeasonMonths: [11, 12, 1, 2, 3],
      note: '[unverified] The gardens typically close for the winter season.',
    },
    sources: ['https://giardinidivillamelzi.it/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-venice-gondola',
    title: 'Venice gondola rides',
    countryCode: 'IT',
    category: 'attraction',
    summary:
      'The city sets an official tariff. It is priced per gondola for up to five people, not per person, and the evening rate is higher than the daytime one.',
    match: {
      kinds: ['attraction'],
      modes: ['gondola'],
      keywords: ['gondola'],
      placeKeys: ['it-venice-gondola-pier'],
    },
    official: { name: 'Comune di Venezia', url: 'https://www.comune.venezia.it/' },
    bookAdvice: {
      latestDaysBefore: null,
      onSiteOk: true,
      note: 'Walk to a gondola station and agree the price and the length of the ride before stepping in. There is no need to prepay online.',
    },
    priceSignals: [
      "[unverified] The traveller's notes record about EUR 90 per gondola at the daytime rate. Confirm the current official tariff before agreeing.",
    ],
    gotchas: [
      'The price is for the boat. Splitting it between more people is the only way to make it cheaper.',
      'Prepaid online gondola "tours" are usually the same ride with a commission added.',
      'Confirm the duration in minutes before you board. Thirty minutes is the standard ride.',
    ],
    trustNotes: [
      'The rate is regulated, so a quote well above the official tariff is a negotiation, not a price.',
    ],
    sources: ['https://www.comune.venezia.it/'],
    lastReviewed: REVIEWED,
  },
  {
    id: 'it-restaurant-reservations',
    title: 'Booking restaurants in Italy',
    countryCode: 'IT',
    category: 'restaurant',
    summary:
      'Popular places book out days ahead and many take reservations only by phone, email or their own site rather than a platform.',
    match: { kinds: ['restaurant'], keywords: ['dinner', 'lunch', 'osteria', 'trattoria'] },
    official: { name: 'TheFork', url: 'https://www.thefork.com/' },
    resellers: [
      {
        name: 'TheFork',
        url: 'https://www.thefork.com/',
        trust: 'fine',
        note: 'Widely used in Italy and free to the diner. Not every good restaurant is on it.',
      },
    ],
    bookAdvice: {
      latestDaysBefore: 14,
      note: 'Two weeks ahead for a named restaurant you actually care about, longer for the well-known ones. Booking direct is more reliable than any platform.',
    },
    gotchas: [
      'A coperto, a fixed per-person cover charge, is normal and is not a tip.',
      'Kitchens often close between lunch and dinner, roughly 15:00 to 19:00, so a late lunch plan can fail.',
      'If you cannot make it, cancel. No-shows are why the good places stopped taking walk-ins.',
    ],
    sources: ['https://www.thefork.com/'],
    lastReviewed: REVIEWED,
  },
];
