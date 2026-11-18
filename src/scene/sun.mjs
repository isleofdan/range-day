// Where the sun stands, from a place, a day and a clock time: the National
// Oceanic and Atmospheric Administration's solar position calculation
// (NOAA Global Monitoring Laboratory, "Solar Calculation Details",
// https://gml.noaa.gov/grad/solcalc/calcdetails.html, the same steps as its
// spreadsheet; after Meeus, "Astronomical Algorithms"), accurate to well
// under a tenth of a degree. Angles in degrees. Used by the scene for the
// light and the sky, and by the tests.
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

// Julian day of a calendar date (Meeus, ch. 7), for a time given as a fraction of the day in UTC.
function julianDay(year, month, day, utcFraction) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5 + utcFraction;
}

// The sun's declination and the equation of time for a Julian day.
function sunTables(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const declination = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eot = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  return { declination, equationOfTimeMin: eot };
}

// The sun's elevation above the horizon and azimuth (from north through
// east) at latitude, longitude, on year-month-day, at a clock hour in a
// time zone tz (hours east of UTC; -8 is Pacific standard time).
export function sunPosition({ lat, lon, year = 2026, month, day = 15, hour, tz = -8 }) {
  const utcHour = hour - tz;
  const jd = julianDay(year, month, day, 0) + utcHour / 24;
  const { declination, equationOfTimeMin } = sunTables(jd);
  const tst = (hour * 60 + equationOfTimeMin + 4 * lon - 60 * tz + 1440 * 10) % 1440;
  const H = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cosZen = Math.sin(rad(lat)) * Math.sin(rad(declination)) + Math.cos(rad(lat)) * Math.cos(rad(declination)) * Math.cos(rad(H));
  const zenith = deg(Math.acos(Math.max(-1, Math.min(1, cosZen))));
  const denom = Math.cos(rad(lat)) * Math.sin(rad(zenith));
  let az = denom === 0 ? 180 : deg(Math.acos(Math.max(-1, Math.min(1, (Math.sin(rad(lat)) * Math.cos(rad(zenith)) - Math.sin(rad(declination))) / denom))));
  az = H > 0 ? (az + 180) % 360 : (540 - az) % 360;
  return { elevation: 90 - zenith, azimuth: az, declination, equationOfTimeMin, hourAngle: H };
}

// The sun's elevation at solar noon (hour angle 0): 90 − latitude + declination.
export function noonElevation({ lat, year = 2026, month, day = 15 }) {
  const { declination } = sunTables(julianDay(year, month, day, 0.5));
  return 90 - lat + declination;
}

// A unit vector toward the sun in the scene's frame: x east, y up, z south
// (three.js's right-handed frame with y up, looking down -z = north).
export function sunVector(pos) {
  const el = rad(pos.elevation), az = rad(pos.azimuth);
  return { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az) };
}
