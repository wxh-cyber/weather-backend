export type WeatherCurrent = {
  cityId: string;
  cityName: string;
  weatherText: string;
  temperature: string;
  observedAt: string;
  source: string;
};

export type WeatherHourlyItem = {
  time: string;
  temperature: string;
  weatherText: string;
};

export type WeatherDailyItem = {
  date: string;
  weatherText: string;
  temperatureMax: string;
  temperatureMin: string;
};

export type WeatherSnapshotPayload = {
  current: Omit<WeatherCurrent, 'cityId' | 'cityName'>;
  hourly: WeatherHourlyItem[];
  daily: WeatherDailyItem[];
  fetchedAt: string;
  expiresAt: string;
  source: string;
};

export type CityMetadata = {
  cityName: string;
  cityCode?: string;
  province?: string;
  country?: string;
  latitude: number;
  longitude: number;
};
