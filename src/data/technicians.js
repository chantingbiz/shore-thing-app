import { STEPHEN_PROPERTIES } from "./stephenProperties.js";

export const TECHNICIANS = [
  { slug: "stephen", name: "Stephen" },
  { slug: "bella", name: "Bella" },
  { slug: "leah", name: "Leah" },
  { slug: "eliza", name: "Eliza" },
  { slug: "buddy", name: "Buddy" },
];

/**
 * Properties on a technician’s route (slugs for admin completion totals).
 * Add entries here as each technician’s route is modeled in the app.
 */
export function getTechnicianRouteProperties(techSlug) {
  if (!techSlug) return [];
  const key = techSlug.toLowerCase();
  if (key === "stephen") return STEPHEN_PROPERTIES;
  return [];
}

export function getTechnicianBySlug(slug) {
  if (!slug) return null;
  return TECHNICIANS.find((t) => t.slug === slug.toLowerCase()) ?? null;
}
