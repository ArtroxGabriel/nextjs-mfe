import type { UserSession, ToastPayload, MapMarker } from '@mfe/ui-shell';

export type { UserSession, ToastPayload, MapMarker };

export interface ServerMetrics {
  readonly cpuArch: string;
  readonly platform: string;
  readonly memoryUsageMb: number;
}

export interface ServerPayload {
  readonly origin: string;
  readonly timestamp: string;
  readonly serverNodeVersion: string;
  readonly requestId: string;
  readonly session?: UserSession | null;
  readonly metrics: ServerMetrics;
  readonly cached?: boolean;
}

export interface TelemetryEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'critical';
  readonly source: string;
  readonly message: string;
  readonly value: number;
}

export interface ServerCardProps {
  readonly initialData?: ServerPayload;
  readonly title?: string;
  readonly session?: UserSession;
}

export interface RemoteMapProps {
  readonly selectedCity?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly zoom?: number;
  readonly onMarkerClick?: (marker: MapMarker) => void;
  readonly session?: UserSession;
}

export interface RemoteTelemetryProps {
  readonly filterLevel?: 'all' | 'info' | 'warn' | 'critical';
  readonly maxEvents?: number;
  readonly session?: UserSession;
}
