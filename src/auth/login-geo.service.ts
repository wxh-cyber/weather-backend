import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GeoLookupResult = {
  country?: string;
  province?: string;
  city?: string;
  isp?: string;
};

@Injectable()
export class LoginGeoService {
  constructor(private readonly configService: ConfigService) {}

  async resolveLoginAddress(ipAddress?: string) {
    const normalizedIp = this.normalizeIp(ipAddress);
    if (!normalizedIp || this.isLoopbackAddress(normalizedIp)) {
      return '本地网络 / 开发环境';
    }

    if (this.isPrivateOrReservedAddress(normalizedIp)) {
      return '局域网 / 内网环境';
    }

    const geo = await this.lookupPublicIpGeo(normalizedIp);
    return this.formatLoginAddress(normalizedIp, geo);
  }

  normalizeIp(ipAddress?: string) {
    if (!ipAddress) {
      return undefined;
    }

    const firstIp = ipAddress.split(',')[0]?.trim();
    if (!firstIp) {
      return undefined;
    }

    if (firstIp.startsWith('::ffff:')) {
      return firstIp.slice('::ffff:'.length);
    }

    return firstIp;
  }

  private isLoopbackAddress(ipAddress: string) {
    return ipAddress === '127.0.0.1' || ipAddress === '::1';
  }

  private isPrivateOrReservedAddress(ipAddress: string) {
    if (ipAddress.includes(':')) {
      const normalized = ipAddress.toLowerCase();
      return (
        normalized === '::' ||
        normalized.startsWith('fe80:') ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd')
      );
    }

    const octets = ipAddress.split('.').map((value) => Number(value));
    if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
      return false;
    }

    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  private async lookupPublicIpGeo(
    ipAddress: string,
  ): Promise<GeoLookupResult | null> {
    const lookupEnabled = this.configService.get<string>(
      'LOGIN_GEO_LOOKUP_ENABLED',
      'true',
    );
    if (lookupEnabled.toLowerCase() !== 'true') {
      return null;
    }

    const baseUrl = this.configService.get<string>(
      'LOGIN_GEO_LOOKUP_BASE_URL',
      '',
    );
    if (!baseUrl) {
      return null;
    }

    const timeoutMs = Number(
      this.configService.get<string>('LOGIN_GEO_LOOKUP_TIMEOUT_MS', '1500'),
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestUrl = this.buildLookupUrl(baseUrl, ipAddress);
      const apiKey = this.configService.get<string>(
        'LOGIN_GEO_LOOKUP_API_KEY',
        '',
      );
      const response = await fetch(requestUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      return this.extractGeoLookupResult(payload);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildLookupUrl(baseUrl: string, ipAddress: string) {
    const apiKey = this.configService.get<string>(
      'LOGIN_GEO_LOOKUP_API_KEY',
      '',
    );
    const resolvedBaseUrl = baseUrl.includes('{ip}')
      ? baseUrl.replaceAll('{ip}', encodeURIComponent(ipAddress))
      : baseUrl;
    const url = new URL(resolvedBaseUrl);

    if (!baseUrl.includes('{ip}') && !url.searchParams.has('ip')) {
      url.searchParams.set('ip', ipAddress);
    }
    if (!url.searchParams.has('lang')) {
      url.searchParams.set('lang', 'zh-CN');
    }
    if (
      apiKey &&
      !url.searchParams.has('key') &&
      !url.searchParams.has('token')
    ) {
      url.searchParams.set('key', apiKey);
    }

    return url.toString();
  }

  private extractGeoLookupResult(
    payload: Record<string, unknown>,
  ): GeoLookupResult | null {
    const data =
      this.asRecord(payload.data) ??
      this.asRecord(payload.result) ??
      this.asRecord(payload.location) ??
      payload;

    const country = this.pickString(data, [
      'country',
      'country_name',
      'nation',
    ]);
    const province = this.pickString(data, [
      'province',
      'regionName',
      'region',
      'prov',
      'state_prov',
    ]);
    const city = this.pickString(data, ['city', 'cityName']);
    const isp = this.pickString(data, [
      'isp',
      'isp_name',
      'org',
      'owner',
      'as',
      'addr',
    ]);

    if (!country && !province && !city && !isp) {
      return null;
    }

    return { country, province, city, isp };
  }

  private formatLoginAddress(ipAddress: string, geo: GeoLookupResult | null) {
    if (!geo) {
      return `网络节点 ${ipAddress}`;
    }

    const orderedParts = [geo.city, geo.province, geo.isp].filter(
      (value): value is string => Boolean(value),
    );
    const uniqueParts = orderedParts.filter(
      (value, index) => orderedParts.indexOf(value) === index,
    );

    if (uniqueParts.length >= 2) {
      return uniqueParts.join(' / ');
    }

    if (uniqueParts.length === 1) {
      return `${uniqueParts[0]} / ${ipAddress}`;
    }

    if (geo.country) {
      return `${geo.country} / ${ipAddress}`;
    }

    return `网络节点 ${ipAddress}`;
  }

  private asRecord(value: unknown) {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : null;
  }

  private pickString(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }
}
