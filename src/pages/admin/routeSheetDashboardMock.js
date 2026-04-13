/**
 * Mock data for Route Sheet Dashboard (replace with Supabase later).
 * technicianSlug values: stephen | bella | brian
 */

export const ROUTE_SHEET_TECHNICIANS = [
  { slug: "stephen", name: "Stephen" },
  { slug: "bella", name: "Bella" },
  { slug: "brian", name: "Brian" },
];

/** Calendar days for the outgoing dispatch sheet (UI only for now). */
export const ROUTE_CALENDAR_DAYS = [
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
];

/** Weekly route categories for the status panel (not per calendar day). */
export const ROUTE_SHEET_TYPES = [
  { key: "turnover", label: "Turnover" },
  { key: "midweek", label: "Midweek" },
];

/** @type {Array<{
 *   id: string,
 *   propertyName: string,
 *   address: string,
 *   technicianSlug: string,
 *   serviceType: 'guest' | 'check',
 *   poolHeat: boolean,
 *   comments: string,
 *   activeOnSaturday: boolean,
 *   activeOnSunday: boolean,
 *   activeOnMidweek: boolean,
 * }>} */
export const MOCK_ROUTE_PROPERTIES = [
  /* Stephen — Rodanthe corridor. Check rows use activeOnMidweek: true so they still appear on
     the Midweek list (muted + off by default via defaultIncludedOnSheet). */
  {
    id: "st1",
    propertyName: "Just One More Day",
    address: "24201 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "check",
    poolHeat: false,
    comments: "",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st2",
    propertyName: "Jamaican Me Happy",
    address: "24224 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "check",
    poolHeat: false,
    comments: "Pool open 6/2",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st3",
    propertyName: "Eers in the Sand",
    address: "24234 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "check",
    poolHeat: false,
    comments: "",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st4",
    propertyName: "It's Sunbelievable",
    address: "24240 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "check",
    poolHeat: false,
    comments: "EOW 4/4 (next 5/16)",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st5",
    propertyName: "Whale Kept Secret",
    address: "24242 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "guest",
    poolHeat: true,
    comments: "YES POOL HEAT",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st6",
    propertyName: "Caribbean Wave",
    address: "24246 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "guest",
    poolHeat: true,
    comments: "Early check-in, owner leaving",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st7",
    propertyName: "Dolphin View Hideaway",
    address: "24252 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "guest",
    poolHeat: true,
    comments: "Owner guest leaving",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st8",
    propertyName: "Blue Ocean Views",
    address: "24253 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "guest",
    poolHeat: true,
    comments: "Leave heat on",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st9",
    propertyName: "Caribbean Paradise",
    address: "24249 Caribbean Way, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "guest",
    poolHeat: true,
    comments: "YES POOL HEAT",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "st10",
    propertyName: "Atlantic Dreams",
    address: "24240 Atlantic Dr, Rodanthe",
    technicianSlug: "stephen",
    serviceType: "check",
    poolHeat: false,
    comments: "",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "p6",
    propertyName: "Harbor Lights",
    address: "9 Marina Ct",
    technicianSlug: "bella",
    serviceType: "guest",
    poolHeat: true,
    comments: "Full clean both days",
    activeOnSaturday: true,
    activeOnSunday: true,
    activeOnMidweek: true,
  },
  {
    id: "p7",
    propertyName: "Tern Nest",
    address: "77 Gull St",
    technicianSlug: "bella",
    serviceType: "check",
    poolHeat: false,
    comments: "",
    activeOnSaturday: true,
    activeOnSunday: true,
    activeOnMidweek: true,
  },
  {
    id: "p8",
    propertyName: "Coral Reef Club",
    address: "15 Reef Ave",
    technicianSlug: "bella",
    serviceType: "guest",
    poolHeat: false,
    comments: "Gate code 4521",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "p9",
    propertyName: "Pelican Perch",
    address: "2 Bay Dr",
    technicianSlug: "bella",
    serviceType: "guest",
    poolHeat: true,
    comments: "",
    activeOnSaturday: false,
    activeOnSunday: true,
    activeOnMidweek: true,
  },
  {
    id: "p10",
    propertyName: "Sunset Pier House",
    address: "30 Pier Rd",
    technicianSlug: "brian",
    serviceType: "guest",
    poolHeat: false,
    comments: "Midweek preferred after 10am",
    activeOnSaturday: true,
    activeOnSunday: true,
    activeOnMidweek: true,
  },
  {
    id: "p11",
    propertyName: "Osprey Landing",
    address: "55 Marsh View",
    technicianSlug: "brian",
    serviceType: "check",
    poolHeat: false,
    comments: "",
    activeOnSaturday: true,
    activeOnSunday: false,
    activeOnMidweek: true,
  },
  {
    id: "p12",
    propertyName: "Breakers Inn (west)",
    address: "400 Coast Hwy",
    technicianSlug: "brian",
    serviceType: "guest",
    poolHeat: true,
    comments: "Pool heat yes; spa check midweek OK to skip unless owner texts",
    activeOnSaturday: true,
    activeOnSunday: true,
    activeOnMidweek: true,
  },
];

const WEEKDAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);

export function isWeekdayDispatch(dayKey) {
  return WEEKDAYS.has(dayKey);
}

/** Map calendar day → status panel key (turnover = Sat/Sun, midweek = Mon–Fri). */
export function sheetTypeForCalendarDay(dayKey) {
  if (dayKey === "saturday" || dayKey === "sunday") return "turnover";
  if (isWeekdayDispatch(dayKey)) return "midweek";
  return "midweek";
}

export function isActiveOnDay(prop, dayKey) {
  if (dayKey === "saturday") return prop.activeOnSaturday;
  if (dayKey === "sunday") return prop.activeOnSunday;
  if (isWeekdayDispatch(dayKey)) return prop.activeOnMidweek;
  return false;
}

/** Default “included on sheet” before admin override. */
export function defaultIncludedOnSheet(prop, dayKey) {
  if (isWeekdayDispatch(dayKey) && prop.serviceType === "check") return false;
  return true;
}

export function inclusionStorageKey(propertyId, dayKey) {
  return `${propertyId}::${dayKey}`;
}
