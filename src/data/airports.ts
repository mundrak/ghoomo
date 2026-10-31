import type { Zone } from "@/lib/zones";

/**
 * Cities you can start from. The code is the city's main airport; lat/lon place the city for
 * trains and buses; zone ranks nearby places first. The first 12 are the original metros; the
 * rest are the larger cities with airports from India's city list.
 */
export const ORIGIN_AIRPORTS: { code: string; city: string; lat: number; lon: number; busSlug: string; zone: Zone }[] = [
  { code: "DEL", city: "Delhi", lat: 28.61, lon: 77.21, busSlug: "delhi", zone: "north" },
  { code: "BOM", city: "Mumbai", lat: 19.08, lon: 72.88, busSlug: "mumbai", zone: "west" },
  { code: "BLR", city: "Bengaluru", lat: 12.97, lon: 77.59, busSlug: "bangalore", zone: "south" },
  { code: "MAA", city: "Chennai", lat: 13.08, lon: 80.27, busSlug: "chennai", zone: "south" },
  { code: "HYD", city: "Hyderabad", lat: 17.39, lon: 78.49, busSlug: "hyderabad", zone: "south" },
  { code: "CCU", city: "Kolkata", lat: 22.57, lon: 88.36, busSlug: "kolkata", zone: "east" },
  { code: "PNQ", city: "Pune", lat: 18.52, lon: 73.86, busSlug: "pune", zone: "west" },
  { code: "AMD", city: "Ahmedabad", lat: 23.02, lon: 72.57, busSlug: "ahmedabad", zone: "west" },
  { code: "COK", city: "Kochi", lat: 9.93, lon: 76.27, busSlug: "ernakulam", zone: "south" },
  { code: "JAI", city: "Jaipur", lat: 26.91, lon: 75.79, busSlug: "jaipur", zone: "north" },
  { code: "LKO", city: "Lucknow", lat: 26.85, lon: 80.95, busSlug: "lucknow", zone: "north" },
  { code: "GOI", city: "Goa", lat: 15.38, lon: 73.83, busSlug: "goa", zone: "west" },
  { code: "IXC", city: "Chandigarh", lat: 30.74, lon: 76.79, busSlug: "chandigarh", zone: "north" },
  { code: "ATQ", city: "Amritsar", lat: 31.63, lon: 74.88, busSlug: "amritsar", zone: "north" },
  { code: "VNS", city: "Varanasi", lat: 25.32, lon: 83.01, busSlug: "varanasi", zone: "north" },
  { code: "IDR", city: "Indore", lat: 22.72, lon: 75.86, busSlug: "indore", zone: "central" },
  { code: "BHO", city: "Bhopal", lat: 23.25, lon: 77.42, busSlug: "bhopal", zone: "central" },
  { code: "RPR", city: "Raipur", lat: 21.24, lon: 81.63, busSlug: "raipur", zone: "central" },
  { code: "PAT", city: "Patna", lat: 25.61, lon: 85.14, busSlug: "patna", zone: "east" },
  { code: "IXR", city: "Ranchi", lat: 23.36, lon: 85.33, busSlug: "ranchi", zone: "east" },
  { code: "BBI", city: "Bhubaneswar", lat: 20.3, lon: 85.83, busSlug: "bhubaneswar", zone: "east" },
  { code: "GAU", city: "Guwahati", lat: 26.18, lon: 91.75, busSlug: "guwahati", zone: "north-east" },
  { code: "NAG", city: "Nagpur", lat: 21.15, lon: 79.08, busSlug: "nagpur", zone: "west" },
  { code: "STV", city: "Surat", lat: 21.21, lon: 72.84, busSlug: "surat", zone: "west" },
  { code: "BDQ", city: "Vadodara", lat: 22.3, lon: 73.2, busSlug: "vadodara", zone: "west" },
  { code: "VTZ", city: "Visakhapatnam", lat: 17.69, lon: 83.29, busSlug: "visakhapatnam", zone: "south" },
  { code: "CJB", city: "Coimbatore", lat: 11.0, lon: 76.96, busSlug: "coimbatore", zone: "south" },
  { code: "TRV", city: "Thiruvananthapuram", lat: 8.49, lon: 76.95, busSlug: "trivandrum", zone: "south" },
];

export const findOrigin = (code: string) => ORIGIN_AIRPORTS.find((a) => a.code === code);
