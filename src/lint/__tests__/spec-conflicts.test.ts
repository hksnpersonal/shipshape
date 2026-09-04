/**
 * One case per conflict listed in section 8 of the source itinerary spec.
 *
 * Each case builds the SMALLEST fixture that reproduces the situation and asserts the
 * named rule fires. These are not seed tests: the seed has its own suite. Chunks C3a/b/c
 * each replace the `it.todo` entries assigned to them with a real test.
 *
 * Owner column: which C3 chunk fills the case in.
 */
import { describe, it } from 'vitest';

describe('spec section 8 conflicts', () => {
  // C3a - timing rules
  it.todo('#3  Paris 11 Oct: 14:30 check-in overlaps a 15:40 arrival (time-overlap)');
  it.todo('#3b Paris 11 Oct: check-in + rest leaves no gap before 16:30 (insufficient-transfer)');
  it.todo('#4  Basel: 33 min onto a non-refundable TGV (insufficient-transfer, raised bar)');
  it.todo('#6  Eurostar labelled "2 hr" but booked 06:49-08:14 (transit-duration-mismatch)');
  it.todo('#6b Brussels: 08:14 arrival, nothing until 09:30 (idle-gap)');
  it.todo('#10 Louvre: metro at 08:30, nothing until 10:20 (idle-gap)');
  it.todo('#5  Amsterdam: stale "12:45 arrive" beside booked 12:50 (stale-duplicate)');
  it.todo('#3c Paris: stale "13:40 arrive" beside booked 15:40 (item-booking-time-mismatch)');

  // C3b - place and venue rules
  it.todo(
    '#7  Milan-Lucerne: leg ends Chiasso, next leg starts Arth-Goldau (chain-station-mismatch)',
  );
  it.todo('#16 Pisa: out to San Rossore, back from Centrale (round-trip-asymmetry)');
  it.todo('#8  Zaanse Schans to Albert Cuyp with no return leg (missing-transit-leg)');
  it.todo('#11 Paris 14e to Trocadero with no metro leg (missing-transit-leg)');
  it.todo('#8b "Metro" to Zaandijk which is a rail station (mode-place-kind)');
  it.todo('#9  RUDI stroopwafels is Monday-only, 16 Oct is a Friday (venue-closed-weekday)');
  it.todo('#13 Galleria Doria Pamphilj on a Sunday (venue-closed-weekday)');
  it.todo('#12 Florence Duomo hours written "10:15-3:45" (opening-hours-suspicious)');
  it.todo('#13b Galleria Doria Pamphilj listed on two days (duplicate-venue)');
  it.todo('#14 Two Sizes Tiramisu on three days (duplicate-venue, warning at 3+)');
  it.todo('#17 Menaggio-Varenna ferry in October (seasonal-service)');

  // C3c - trip and booking rules
  it.todo('#15 Schiphol: 09:45 checkout, 14:15 flight, 4 h rule (airport-lead-time)');
  it.todo('#1  Trip end date disagrees with the flight home (trip-range)');
  it.todo('#2  Duplicate and missing day numbers (day-sequence)');
  it.todo('#manual A ManualConflict becomes a finding with ruleId "manual"');
});
