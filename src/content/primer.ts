/**
 * The "New to Europe?" primer: how things work day to day, as distinct from the Playbook
 * (src/content/guides), which covers how to book things.
 *
 * Plain typed module rather than markdown, same reasoning as the guides: an authoring
 * mistake is a compile error, and the whole thing is available offline with no fetch.
 */

export interface PrimerSection {
  id: string;
  title: string;
  bullets: string[];
}

/**
 * `city` matches (via aliases handled in PrimerPage) a trip day's `city`, for ordering.
 * `title` is the display heading.
 */
export interface CityNote {
  city: string;
  title: string;
  bullets: string[];
}

export const lastReviewed = '2026-09-24';

export const generalTips: PrimerSection[] = [
  {
    id: 'money',
    title: 'Money',
    bullets: [
      'Tap-to-pay is widely accepted, including at transit gates in many cities.',
      'Carry some cash for small cafés, markets and public toilets.',
      'Switzerland uses CHF, not EUR - many places take EUR but give change in CHF at a poor rate.',
      'At a card terminal, always choose to pay in the local currency, not your home currency - decline any "dynamic currency conversion" offer.',
    ],
  },
  {
    id: 'tipping',
    title: 'Tipping',
    bullets: [
      'Not expected the way it is in the US.',
      'Round up, or leave about 5-10% for good table service.',
      "Italy's coperto (cover charge) is normal and already on the bill - it is not a tip.",
    ],
  },
  {
    id: 'trains',
    title: 'Trains',
    bullets: [
      'Italian regional paper tickets must be validated in the green/white machines before boarding, or risk a fine.',
      'High-speed Frecciarossa/Italo tickets are tied to a named train and seat - no validation needed.',
      'Check the departures board for the platform (binario/Gleis/voie), which usually appears 10-20 minutes before departure.',
      'Swiss Travel Pass: carry your passport, no seat reservation needed, just board.',
      'Eurostar has airport-style security and passport control - arrive at the time printed on the ticket, not just before departure.',
    ],
  },
  {
    id: 'safety',
    title: 'Safety',
    bullets: [
      'Pickpockets work metros, Roma Termini, Trevi Fountain, Gare du Nord and crowded trams - keep bags cross-body or in front pockets.',
      'Decline petition and bracelet scams.',
      '112 is the emergency number everywhere in the EU and Switzerland.',
    ],
  },
  {
    id: 'churches',
    title: 'Churches and the Vatican',
    bullets: [
      'Shoulders and knees covered to enter.',
      'A light scarf is an easy fix if you are caught out.',
    ],
  },
  {
    id: 'power',
    title: 'Power and phone',
    bullets: [
      "Australian plugs don't fit - Italy uses type C/F/L, Switzerland type J (a flat 2-pin type C plug still fits), France/Belgium type E/C, Netherlands type F/C.",
      'One universal adapter covers all of them.',
      'Mains is 230V, so Australian phone and laptop chargers work as-is.',
      'Check phone roaming or an eSIM before leaving.',
    ],
  },
  {
    id: 'water',
    title: 'Water and toilets',
    bullets: [
      'Tap water is safe to drink in Italy, Switzerland, France, Belgium and the Netherlands.',
      "Rome's street drinking fountains (nasoni) are safe too.",
      'Public toilets usually cost around €0.50-1.',
      "A café's toilet is usually for paying customers.",
    ],
  },
  {
    id: 'eating',
    title: 'Eating times',
    bullets: [
      'Italian lunch runs roughly 12:30-14:30 and dinner from about 19:30, with kitchens often closed in between.',
      'Switzerland eats earlier than Italy.',
    ],
  },
  {
    id: 'time',
    title: 'Time',
    bullets: [
      'Europe is 8 hours behind Sydney until 4 October, then 9 hours behind once Sydney starts daylight saving.',
      'Europe stays on summer time (CEST) for the whole trip.',
      'When you call home in the evening, it is already early the next morning in Sydney.',
    ],
  },
];

export const cityNotes: CityNote[] = [
  {
    city: 'Rome',
    title: 'Rome',
    bullets: [
      'Roma Termini → Prati: metro line A to Ottaviano, or a licensed white taxi from the rank - ignore anyone offering you a ride inside the station.',
      'Roma Termini is a known pickpocket hotspot - stay alert.',
      'Tap-to-pay works on metro and bus gates.',
      'Validate any paper transit ticket before you ride.',
    ],
  },
  {
    city: 'Florence',
    title: 'Florence',
    bullets: [
      'Santa Maria Novella station → old town is walkable.',
      'The Duomo area gets very crowded - go early.',
      'City buses usually take tap-to-pay on board - most sights are walkable anyway.',
    ],
  },
  {
    city: 'Pisa',
    title: 'Pisa',
    bullets: [
      'A day trip from Florence, by regional train from Firenze SMN.',
      'Pisa San Rossore station is about 10 minutes on foot from the Leaning Tower; Pisa Centrale is 20-25 minutes, or a short taxi ride.',
      'Validate the paper regional ticket before boarding.',
    ],
  },
  {
    city: 'Venice',
    title: 'Venice',
    bullets: [
      'No wheeled-case-friendly streets - bridges have steps, so expect to carry your bags, not roll them.',
      'Vaporetto tickets are expensive per ride - walking is usually faster and cheaper for short hops.',
      'Watch your footing on bridges with luggage.',
    ],
  },
  {
    city: 'Milan',
    title: 'Milan',
    bullets: [
      'Milano Centrale → city centre by metro.',
      'Tap-to-pay works on ATM metro and tram gates.',
      'Keep bags zipped on the metro.',
    ],
  },
  {
    city: 'Lake Como',
    title: 'Lake Como',
    bullets: [
      'A day trip from Milan, usually by train to Varenna then ferry across to Bellagio or Menaggio.',
      'Ferry tickets are bought at the pier or by app - cash and card both usually fine.',
      'Check the ferry timetable before committing to a return time - service can be reduced outside summer.',
    ],
  },
  {
    city: 'Lucerne',
    title: 'Lucerne',
    bullets: [
      'The Swiss Travel Pass covers the lake boats, city buses and trains - no separate ticket, just show the pass (and your passport) if asked.',
      'Trains run to the minute, so be on the platform early.',
      'Tap-to-pay is widely accepted - small change may come back in CHF even after paying in EUR.',
    ],
  },
  {
    city: 'Grindelwald',
    title: 'Grindelwald / Jungfrau region',
    bullets: [
      'Reached by train via Interlaken.',
      'Day trips to Kandersteg/Oeschinensee and to Lauterbrunnen run on the same Swiss Travel Pass.',
      'Mountain railways and cable cars are usually covered or discounted by the pass - check locally.',
      'Weather can close a summit gondola with little notice, so keep a backup plan.',
    ],
  },
  {
    city: 'Paris',
    title: 'Paris',
    bullets: [
      'Paper metro tickets have been phased out. Buy a Navigo Easy card at a station machine and load tickets onto it, or buy them in the Bonjour RATP app.',
      'Check at the station whether tapping a bank card at the gate works yet - it was being rolled out.',
      'Gare du Nord is a known pickpocket hotspot - stay alert.',
      'Keep transport tickets until you exit - inspectors do check.',
    ],
  },
  {
    city: 'Brussels',
    title: 'Brussels',
    bullets: [
      'A day trip from Paris, usually by international train into Bruxelles-Midi.',
      'That station has a reputation for pickpockets - move straight to the platform or taxi rank.',
      'City trams and metro usually take tap-to-pay.',
    ],
  },
  {
    city: 'Amsterdam',
    title: 'Amsterdam',
    bullets: [
      'Bike lanes are red-paved and bikes do not stop for pedestrians - look both ways before stepping into one.',
      'Trams, metro and trains take a contactless bank card or phone (OVpay).',
      'Tap in AND tap out with the same card every time - forgetting to tap out charges a large default fare.',
      'Keep to the pedestrian side of any path with a cycle lane.',
    ],
  },
];
