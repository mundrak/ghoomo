/** Cities you can start from. The code is the city's main airport; lat/lon place the city for trains and buses. */
export const ORIGIN_AIRPORTS = [
  { code: "DEL", city: "Delhi", lat: 28.61, lon: 77.21, busSlug: "delhi" },
  { code: "BOM", city: "Mumbai", lat: 19.08, lon: 72.88, busSlug: "mumbai" },
  { code: "BLR", city: "Bengaluru", lat: 12.97, lon: 77.59, busSlug: "bangalore" },
  { code: "MAA", city: "Chennai", lat: 13.08, lon: 80.27, busSlug: "chennai" },
  { code: "HYD", city: "Hyderabad", lat: 17.39, lon: 78.49, busSlug: "hyderabad" },
  { code: "CCU", city: "Kolkata", lat: 22.57, lon: 88.36, busSlug: "kolkata" },
  { code: "PNQ", city: "Pune", lat: 18.52, lon: 73.86, busSlug: "pune" },
  { code: "AMD", city: "Ahmedabad", lat: 23.02, lon: 72.57, busSlug: "ahmedabad" },
  { code: "COK", city: "Kochi", lat: 9.93, lon: 76.27, busSlug: "ernakulam" },
  { code: "JAI", city: "Jaipur", lat: 26.91, lon: 75.79, busSlug: "jaipur" },
  { code: "LKO", city: "Lucknow", lat: 26.85, lon: 80.95, busSlug: "lucknow" },
  { code: "GOI", city: "Goa", lat: 15.38, lon: 73.83, busSlug: "goa" },
];

export const findOrigin = (code: string) => ORIGIN_AIRPORTS.find((a) => a.code === code);
