// India's six zones, grouped the way travellers usually think of them (close to the tourism
// ministry's regions): North India includes Uttarakhand and UP, so Rishikesh and Agra count as
// near Delhi. Used to rank nearby places first: a 2–3 day trip from Kolkata should lead with the
// East and North East, not Goa.

export const ZONES = ["north", "central", "east", "north-east", "west", "south"] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABELS: Record<Zone, string> = {
  north: "North",
  central: "Central",
  east: "East",
  "north-east": "North East",
  west: "West",
  south: "South",
};

/** States and union territories by zone. Spellings without diacritics; see `zoneOfState`. */
const STATE_ZONE: Record<string, Zone> = {
  delhi: "north",
  haryana: "north",
  punjab: "north",
  chandigarh: "north",
  "himachal pradesh": "north",
  "jammu and kashmir": "north",
  ladakh: "north",
  rajasthan: "north",
  "uttar pradesh": "north",
  uttarakhand: "north",
  "madhya pradesh": "central",
  chhattisgarh: "central",
  bihar: "east",
  jharkhand: "east",
  odisha: "east",
  "west bengal": "east",
  assam: "north-east",
  meghalaya: "north-east",
  manipur: "north-east",
  mizoram: "north-east",
  nagaland: "north-east",
  tripura: "north-east",
  "arunachal pradesh": "north-east",
  sikkim: "north-east",
  goa: "west",
  gujarat: "west",
  maharashtra: "west",
  "dadra and nagar haveli and daman and diu": "west",
  "andhra pradesh": "south",
  telangana: "south",
  karnataka: "south",
  kerala: "south",
  "tamil nadu": "south",
  puducherry: "south",
};

/** Zone for a state name, with or without diacritics ("Mahārāshtra" works). */
export function zoneOfState(state: string): Zone | undefined {
  const plain = state.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return STATE_ZONE[plain];
}

/** Zones that share a border, so a trip across it is usually still short. */
const NEIGHBOURS: Record<Zone, Zone[]> = {
  north: ["central", "west", "east"],
  central: ["north", "east", "west", "south"],
  east: ["north", "central", "north-east", "south"],
  "north-east": ["east"],
  west: ["north", "central", "south"],
  south: ["west", "central", "east"],
};

export type Nearness = "same" | "neighbour" | "far";

// The East and the North East are one trip region for most people starting there
// (Kolkata → Shillong or Gangtok, Guwahati → Darjeeling), so they count as the same.
const SAME_REGION: [Zone, Zone][] = [["east", "north-east"]];

export function nearness(from: Zone, to: Zone): Nearness {
  if (from === to) return "same";
  if (SAME_REGION.some(([a, b]) => (a === from && b === to) || (a === to && b === from))) return "same";
  return NEIGHBOURS[from].includes(to) ? "neighbour" : "far";
}
