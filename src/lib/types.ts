import type { AbroadRegion, Zone } from "./zones";
export type Tier = "budget" | "comfort" | "luxury";
export type PartyType = "solo" | "couple" | "students" | "group";
export type StayType = "hostel" | "hotel" | "airbnb";
export type Diet = "any" | "vegetarian" | "jain" | "vegan" | "halal" | "eggetarian";
export type Interest =
  | "beach"
  | "mountains"
  | "nightlife"
  | "culture"
  | "adventure"
  | "food"
  | "shopping"
  | "nature";

export type Category = "flights" | "stay" | "food" | "activities" | "transport";
export type CategoryBudget = Record<Category, number>;

export interface TripInput {
  origin: string; // IATA code of departure airport
  startDate: string; // YYYY-MM-DD
  days: number;
  party: PartyType;
  travellers: number;
  tier: Tier;
  /** Per-person budget split by category, in INR. */
  budget: CategoryBudget;
  stay: StayType;
  /** For hotels: how many share a room (2 by default; students often take 3–4 with extra beds). */
  roomShare?: number;
  diet: Diet;
  cuisines: string[];
  interests: Interest[];
  scope: "anywhere" | "india" | "abroad";
  /** Set when the user has already picked a destination. */
  destinationId?: string;
}

export interface Activity {
  name: string;
  cost: number; // INR per person
  tags: Interest[];
}

export interface Destination {
  id: string;
  name: string;
  /** The place's name in its local script, shown beside the English name. */
  localName?: string;
  /** BCP 47 language of localName, so screen readers and fonts handle it properly. */
  localLang?: string;
  country: string;
  international: boolean;
  /** Zone within India, for ranking nearby places first. Not set for places abroad. */
  zone?: Zone;
  /** For places abroad: which region they're in, for the board filters. */
  abroadRegion?: AbroadRegion;
  airport: string;
  /** How to get from the airport to the destination, if it isn't right there. */
  arrivalNote?: string;
  /** Typical economy return fare from a metro, INR per person. Used for trips abroad; domestic fares are worked out by distance. */
  flightEstimate: number;
  /** Roughly where the place is, for working out distance and travel time from each city. */
  lat: number;
  lon: number;
  /** How people usually get there over land, if that's practical. Leave out for places you have to fly to. */
  ground?: {
    mode: "train" | "bus";
    /** Where the train or bus actually goes, e.g. "Hosapete" for Hampi. */
    to: string;
    /** redBus's name for the town, for bus search links. */
    busSlug?: string;
  };
  bestMonths: number[]; // 1-12
  tags: Interest[];
  visa: string;
  /** 1 (hard) – 5 (easy) to eat vegetarian / Indian food. */
  vegScore: number;
  /** Per-night costs in INR. Hostel per bed, hotel per room (2 people), airbnb per whole place for 4-6. */
  stay: {
    hostelBed: number;
    hotelRoom: Record<Tier, number>;
    airbnbPlace: Record<Tier, number>;
  };
  foodPerDay: Record<Tier, number>; // per person
  transportPerDay: Record<Tier, number>; // per person
  activities: Activity[];
  /** Months to warn about (monsoon, extreme heat, closed roads), with what to expect. */
  cautions?: { months: number[]; note: string }[];
  /** Search terms the hotel provider and booking sites understand. */
  hotelCity: string;
  countryCode: string;
}

export type TravelMode = "flight" | "train" | "bus" | "none";

/** How you get there and back. Named for flights, which came first; it now covers trains and buses too. */
export interface FlightQuote {
  price: number; // INR per person, return
  source: "live" | "estimate";
  /** Missing on quotes from before trains and buses were added: treat as a flight. */
  mode?: TravelMode;
  /** In words, e.g. "Overnight train, about 11 h". */
  label?: string;
  /** One-way travel time in hours, roughly. */
  hours?: number;
  airline?: string;
  departAt?: string;
  returnAt?: string;
  transfers?: number;
  bookingUrl: string;
}

export interface StayQuote {
  /** INR per person per night. */
  perPersonNight: number;
  source: "live" | "estimate";
  name?: string;
  roomName?: string;
  bookingUrl: string;
  options?: { name: string; perPersonNight: number }[];
}

export interface CostBreakdown extends CategoryBudget {
  total: number;
}

export interface Suggestion {
  destination: Destination;
  cost: CostBreakdown; // per person
  flight: FlightQuote;
  fitScore: number;
  overBudgetBy: number; // INR per person; 0 if within budget
  reasons: string[];
}
