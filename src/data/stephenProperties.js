/** Printed names & addresses for Stephen’s route — slugs for URLs */
export const STEPHEN_PROPERTIES = [
  {
    slug: "just-one-more-day-key",
    name: "Just One More Day key",
    address: "24201 Caribbean Way, Rodanthe",
  },
  {
    slug: "jamaican-me-happy",
    name: "Jamaican Me Happy",
    address: "24224 Caribbean Way, Rodanthe",
  },
  {
    slug: "eels-in-the-sand",
    name: "Eels in the Sand",
    address: "24234 Caribbean Way, Rodanthe",
  },
  {
    slug: "cape-winds-key",
    name: "Cape Winds key",
    address: "24236 Caribbean Way, Rodanthe",
  },
  {
    slug: "its-sunbelievable",
    name: "It's Sunbelievable",
    address: "24240 Caribbean Way, Rodanthe",
  },
  {
    slug: "whale-kept-secret",
    name: "Whale Kept Secret",
    address: "24242 Caribbean Way, Rodanthe",
  },
  {
    slug: "caribbean-wave",
    name: "Caribbean Wave",
    address: "24246 Caribbean Way, Rodanthe",
  },
  {
    slug: "dolphin-view-hideaway",
    name: "Dolphin View Hideaway",
    address: "24252 Caribbean Way, Rodanthe",
  },
  {
    slug: "blue-ocean-views",
    name: "Blue Ocean Views",
    address: "24253 Caribbean Way, Rodanthe",
  },
  {
    slug: "caribbean-paradise",
    name: "Caribbean Paradise",
    address: "24249 Caribbean Way, Rodanthe",
  },
  {
    slug: "atlantic-dreams",
    name: "Atlantic Dreams",
    address: "24240 Atlantic Dr., Rodanthe",
  },
  {
    slug: "a-wave-from-it-all",
    name: "A Wave From It All",
    address: "24246 Atlantic Drive, Rodanthe",
  },
];

export function getStephenPropertyBySlug(slug) {
  if (!slug) return null;
  const key = slug.toLowerCase();
  return STEPHEN_PROPERTIES.find((p) => p.slug === key) ?? null;
}
