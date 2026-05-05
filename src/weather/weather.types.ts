export type WeatherCurrent = {
  cityId: string;
  cityName: string;
  weatherText: string;
  temperature: string;
  apparentTemperature?: string;
  precipitationProbability?: string;
  precipitationAmount?: string;
  cloudCover?: string;
  windDirection?: string;
  windSpeed?: string;
  humidity?: string;
  visibility?: string;
  pressure?: string;
  dewPoint?: string;
  airQuality?: string;
  observedAt: string;
  source: string;
};

export type WeatherHourlyItem = {
  time: string;
  temperature: string;
  weatherText: string;
  apparentTemperature?: string;
  precipitationProbability?: string;
  precipitationAmount?: string;
  cloudCover?: string;
  windDirection?: string;
  windSpeed?: string;
  humidity?: string;
  visibility?: string;
  pressure?: string;
  dewPoint?: string;
  windDirectionDegrees?: number | null;
  isDay?: boolean;
  airQuality?: string;
};

export type WeatherDailyItem = {
  date: string;
  weatherText: string;
  temperatureMax: string;
  temperatureMin: string;
  sunrise?: string;
  sunset?: string;
  dayWeatherText?: string;
  nightWeatherText?: string;
};

export type DayPeriodMetrics = {
  feelsLike: string;
  precipitationProbability: string;
  precipitationAmount: string;
  airQuality: string;
  windDirection: string;
  cloudCover: string;
};

export type DailyWeatherDetailItem = {
  date: string;
  temperatureMax: string;
  temperatureMin: string;
  sunrise: string;
  sunset: string;
  dayWeatherText: string;
  nightWeatherText: string;
  dayMetrics: DayPeriodMetrics;
  nightMetrics: DayPeriodMetrics;
};

export type DailyWeatherDetailPayload = {
  cityId: string;
  cityName: string;
  source: string;
  items: DailyWeatherDetailItem[];
};

export type WeatherSnapshotPayload = {
  current: Omit<WeatherCurrent, 'cityId' | 'cityName'>;
  hourly: WeatherHourlyItem[];
  hourlyDetail?: WeatherHourlyItem[];
  daily: WeatherDailyItem[];
  fetchedAt: string;
  expiresAt: string;
  source: string;
};

export type CityWeatherBundle = {
  current: WeatherCurrent;
  hourly: {
    cityId: string;
    cityName: string;
    source: string;
    items: WeatherHourlyItem[];
  };
  daily: {
    cityId: string;
    cityName: string;
    source: string;
    items: WeatherDailyItem[];
  };
  dailyDetail: DailyWeatherDetailPayload;
};

export type CityMetadata = {
  cityName: string;
  cityCode?: string;
  province?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export type { ReverseGeocodeResult } from './reverse-geocode.types';
