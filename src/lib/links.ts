import type { Destination, TripInput } from "./types";

export function tripDates(input: Pick<TripInput, "startDate" | "days">) {
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + Math.max(input.days - 1, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { checkin: iso(start), checkout: iso(end) };
}

const yymmdd = (iso: string) => iso.slice(2).replaceAll("-", "");

export function skyscannerUrl(input: TripInput, d: Destination) {
  const { checkin, checkout } = tripDates(input);
  return (
    `https://www.skyscanner.co.in/transport/flights/${input.origin.toLowerCase()}/${d.airport.toLowerCase()}/` +
    `${yymmdd(checkin)}/${yymmdd(checkout)}/?adultsv2=${input.travellers}&cabinclass=economy`
  );
}

export function stayUrl(input: TripInput, d: Destination) {
  const { checkin, checkout } = tripDates(input);
  const city = encodeURIComponent(d.hotelCity);
  switch (input.stay) {
    case "hostel":
      return `https://www.hostelworld.com/search?search_keywords=${city}&dateFrom=${checkin}&dateTo=${checkout}&number_of_guests=${input.travellers}`;
    case "airbnb":
      return `https://www.airbnb.co.in/s/${city}/homes?checkin=${checkin}&checkout=${checkout}&adults=${input.travellers}`;
    case "hotel":
      return (
        `https://www.booking.com/searchresults.html?ss=${city}&checkin=${checkin}&checkout=${checkout}` +
        `&group_adults=${input.travellers}&no_rooms=${Math.ceil(input.travellers / 2)}&selected_currency=INR`
      );
  }
}
