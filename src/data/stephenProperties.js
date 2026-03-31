/** Printed names & addresses for Stephen’s route — slugs for URLs */
export const STEPHEN_PROPERTIES = [
  {
    id: "0b2d5d4b-67c1-4e8d-a9a8-1e7d2c1c5b30",
    slug: "just-one-more-day-key",
    name: "Just One More Day key",
    address: "24201 Caribbean Way, Rodanthe",
  },
  {
    id: "8d6aef1b-2d4d-4f01-a6d8-7f8c6a0d7f23",
    slug: "jamaican-me-happy",
    name: "Jamaican Me Happy",
    address: "24224 Caribbean Way, Rodanthe",
  },
  {
    id: "b7c5a9f8-9c4e-4a62-9f8a-5b6f4a3a2b1c",
    slug: "eels-in-the-sand",
    name: "Eels in the Sand",
    address: "24234 Caribbean Way, Rodanthe",
  },
  {
    id: "3a1f2c4d-5e6b-4a3f-9c8d-7e6f5a4b3c2d",
    slug: "cape-winds-key",
    name: "Cape Winds key",
    address: "24236 Caribbean Way, Rodanthe",
  },
  {
    id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    slug: "its-sunbelievable",
    name: "It's Sunbelievable",
    address: "24240 Caribbean Way, Rodanthe",
  },
  {
    id: "6f5e4d3c-2b1a-4c5d-8e7f-9a0b1c2d3e4f",
    slug: "whale-kept-secret",
    name: "Whale Kept Secret",
    address: "24242 Caribbean Way, Rodanthe",
  },
  {
    id: "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
    slug: "caribbean-wave",
    name: "Caribbean Wave",
    address: "24246 Caribbean Way, Rodanthe",
  },
  {
    id: "2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b",
    slug: "dolphin-view-hideaway",
    name: "Dolphin View Hideaway",
    address: "24252 Caribbean Way, Rodanthe",
  },
  {
    id: "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
    slug: "blue-ocean-views",
    name: "Blue Ocean Views",
    address: "24253 Caribbean Way, Rodanthe",
  },
  {
    id: "4d3c2b1a-0f9e-4d8c-7b6a-5f4e3d2c1b0a",
    slug: "caribbean-paradise",
    name: "Caribbean Paradise",
    address: "24249 Caribbean Way, Rodanthe",
  },
  {
    id: "5b6a7c8d-9e0f-4a1b-2c3d-4e5f6a7b8c9d",
    slug: "atlantic-dreams",
    name: "Atlantic Dreams",
    address: "24240 Atlantic Dr., Rodanthe",
  },
  {
    id: "0a1b2c3d-4e5f-4a6b-7c8d-9e0f1a2b3c4d",
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

export function getStephenPropertyById(id) {
  if (!id) return null;
  return STEPHEN_PROPERTIES.find((p) => p.id === id) ?? null;
}
