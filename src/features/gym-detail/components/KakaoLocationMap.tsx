import { useEffect, useRef, useState } from 'react';
import {
  getKakaoMapScriptSrc,
  hasKakaoLocationSource,
  isValidKakaoMapPoint,
  normalizeKakaoMapAddress,
} from '../gym-detail-controls';

interface KakaoLocationMapProps {
  appKey: string | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  address?: string | null;
  title: string;
  isActive: boolean;
}

type KakaoMapStatus = 'idle' | 'loading' | 'ready' | 'error';

interface KakaoLatLng {}

interface KakaoMapInstance {
  relayout?: () => void;
  setCenter: (latlng: KakaoLatLng) => void;
}

interface KakaoMarkerInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoAddressResult {
  x: string;
  y: string;
}

interface KakaoMaps {
  load: (callback: () => void) => void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number; scrollwheel: boolean }) => KakaoMapInstance;
  Marker: new (options: { map: KakaoMapInstance; position: KakaoLatLng; title: string }) => KakaoMarkerInstance;
  services: {
    Status: {
      OK: string;
    };
    Geocoder: new () => {
      addressSearch: (address: string, callback: (result: KakaoAddressResult[], status: string) => void) => void;
    };
  };
}

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMaps;
    };
  }
}

const scriptPromises = new Map<string, Promise<void>>();

function loadKakaoMaps(appKey: string) {
  const existingMaps = window.kakao?.maps;
  if (existingMaps) {
    return new Promise<void>((resolve) => existingMaps.load(resolve));
  }

  const scriptSrc = getKakaoMapScriptSrc(appKey);
  const existingPromise = scriptPromises.get(scriptSrc);
  if (existingPromise) return existingPromise;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.dataset.kakaoMapSdk = 'true';
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error('Kakao Maps SDK is unavailable.'));
        return;
      }
      maps.load(resolve);
    };
    script.onerror = () => reject(new Error('Kakao Maps SDK failed to load.'));
    document.head.appendChild(script);
  });

  scriptPromises.set(scriptSrc, promise);
  return promise;
}

function resolveAddressPoint(maps: KakaoMaps, address: string) {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    const geocoder = new maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      const first = result[0];
      const latitude = Number(first?.y);
      const longitude = Number(first?.x);
      if (status !== maps.services.Status.OK || !isValidKakaoMapPoint(latitude, longitude)) {
        reject(new Error('Kakao address geocoding failed.'));
        return;
      }
      resolve({ latitude, longitude });
    });
  });
}

export default function KakaoLocationMap({ appKey, latitude, longitude, address, title, isActive }: KakaoLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<KakaoMapStatus>('idle');
  const addressQuery = normalizeKakaoMapAddress(address);
  const hasLocationSource = hasKakaoLocationSource({ latitude, longitude, address });
  const normalizedAppKey = appKey?.trim() ?? '';

  useEffect(() => {
    if (!isActive || !hasLocationSource || !normalizedAppKey || !containerRef.current) return;

    let isMounted = true;
    let marker: KakaoMarkerInstance | null = null;
    setStatus('loading');

    loadKakaoMaps(normalizedAppKey)
      .then(() => {
        if (!isMounted || !containerRef.current || !window.kakao?.maps) return;

        const { maps } = window.kakao;
        const explicitPoint = isValidKakaoMapPoint(latitude, longitude)
          ? { latitude: latitude!, longitude: longitude! }
          : null;
        return explicitPoint ?? resolveAddressPoint(maps, addressQuery!);
      })
      .then((point) => {
        if (!point || !isMounted || !containerRef.current || !window.kakao?.maps) return;

        const { maps } = window.kakao;
        const position = new maps.LatLng(point.latitude, point.longitude);
        const map = new maps.Map(containerRef.current, {
          center: position,
          level: 3,
          scrollwheel: false,
        });
        marker = new maps.Marker({ map, position, title });

        window.requestAnimationFrame(() => {
          if (!isMounted) return;
          map.relayout?.();
          map.setCenter(position);
        });
        setStatus('ready');
      })
      .catch(() => {
        if (isMounted) setStatus('error');
      });

    return () => {
      isMounted = false;
      marker?.setMap(null);
    };
  }, [addressQuery, hasLocationSource, isActive, latitude, longitude, normalizedAppKey, title]);

  if (!hasLocationSource) {
    return <MapState message="좌표 또는 주소 정보가 없어 위치 지도를 열 수 없습니다." />;
  }

  if (!normalizedAppKey) {
    return <MapState message="카카오 지도 키가 설정되지 않았습니다." />;
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 bg-neutral-100" aria-label={`${title} 위치 지도`} />
      {status === 'loading' && <MapState message="지도를 불러오는 중입니다." />}
      {status === 'error' && <MapState message="지도를 불러오지 못했습니다." />}
    </>
  );
}

function MapState({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 px-6 text-center text-[13px] text-neutral-500">
      {message}
    </div>
  );
}
