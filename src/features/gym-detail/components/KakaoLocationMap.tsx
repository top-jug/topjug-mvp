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

interface KakaoPlaceResult {
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
    Places: new () => {
      keywordSearch: (query: string, callback: (result: KakaoPlaceResult[], status: string) => void) => void;
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
  const scriptSrc = getKakaoMapScriptSrc(appKey);
  const existingMaps = window.kakao?.maps;
  if (existingMaps?.services?.Geocoder && existingMaps.services.Places) {
    return new Promise<void>((resolve) => existingMaps.load(resolve));
  }

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
        reject(new Error('카카오 지도 SDK를 불러오지 못했습니다. JavaScript 키와 등록 도메인을 확인해주세요.'));
        return;
      }
      maps.load(resolve);
    };
    script.onerror = () => reject(new Error('카카오 지도 SDK를 불러오지 못했습니다. JavaScript 키와 등록 도메인을 확인해주세요.'));
    document.head.appendChild(script);
  });

  scriptPromises.set(scriptSrc, promise);
  promise.catch(() => {
    scriptPromises.delete(scriptSrc);
  });
  return promise;
}

function resolveAddressPoint(maps: KakaoMaps, address: string, title: string) {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!maps.services?.Geocoder || !maps.services.Places) {
      reject(new Error('카카오 지도 주소 검색 라이브러리를 불러오지 못했습니다.'));
      return;
    }

    const resolveResult = (first: KakaoAddressResult | KakaoPlaceResult | undefined, status: string) => {
      const latitude = Number(first?.y);
      const longitude = Number(first?.x);
      if (status === maps.services.Status.OK && isValidKakaoMapPoint(latitude, longitude)) {
        resolve({ latitude, longitude });
        return true;
      }
      return false;
    };

    const geocoder = new maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      if (resolveResult(result[0], status)) return;

      const places = new maps.services.Places();
      places.keywordSearch(`${title} ${address}`, (placeResult, placeStatus) => {
        if (resolveResult(placeResult[0], placeStatus)) return;
        reject(new Error('주소로 지도 위치를 찾지 못했습니다.'));
      });
    });
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return '지도를 불러오지 못했습니다.';
}

function createKakaoMap(options: {
  maps: KakaoMaps;
  container: HTMLElement;
  latitude: number;
  longitude: number;
  title: string;
}) {
  const position = new options.maps.LatLng(options.latitude, options.longitude);
  const map = new options.maps.Map(options.container, {
    center: position,
    level: 3,
    scrollwheel: false,
  });
  const marker = new options.maps.Marker({ map, position, title: options.title });

  return { map, marker, position };
}

export default function KakaoLocationMap({ appKey, latitude, longitude, address, title, isActive }: KakaoLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<KakaoMapStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const addressQuery = normalizeKakaoMapAddress(address);
  const hasLocationSource = hasKakaoLocationSource({ latitude, longitude, address });
  const normalizedAppKey = appKey?.trim() ?? '';

  useEffect(() => {
    if (!isActive || !hasLocationSource || !normalizedAppKey || !containerRef.current) return;

    let isMounted = true;
    let marker: KakaoMarkerInstance | null = null;
    setStatus('loading');
    setMessage(null);

    loadKakaoMaps(normalizedAppKey)
      .then(() => {
        if (!isMounted || !containerRef.current || !window.kakao?.maps) return;

        const { maps } = window.kakao;
        const explicitPoint = isValidKakaoMapPoint(latitude, longitude)
          ? { latitude: latitude!, longitude: longitude! }
          : null;
        return explicitPoint ?? resolveAddressPoint(maps, addressQuery!, title);
      })
      .then((point) => {
        if (!point || !isMounted || !containerRef.current || !window.kakao?.maps) return;

        const { maps } = window.kakao;
        const rendered = createKakaoMap({
          maps,
          container: containerRef.current,
          latitude: point.latitude,
          longitude: point.longitude,
          title,
        });
        marker = rendered.marker;

        window.requestAnimationFrame(() => {
          if (!isMounted) return;
          rendered.map.relayout?.();
          rendered.map.setCenter(rendered.position);
        });
        setStatus('ready');
      })
      .catch((error) => {
        if (isMounted) {
          setMessage(errorMessage(error));
          setStatus('error');
        }
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
      {status === 'error' && <MapState message={message ?? '지도를 불러오지 못했습니다.'} />}
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
