export interface ReverseGeocodeResult {
  displayName: string;
  name?: string;
  township?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  latitude: number;
  longitude: number;
}
