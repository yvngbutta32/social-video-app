'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrowserSession } from './browser-session';

type JsonRecord = Record<string, unknown>;

interface WebSocketMessage {
  type: string;
  payload: JsonRecord;
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

type RuntimeWindow = Window & { __NEXT_PUBLIC_WS_URL__?: string };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMessage(raw: unknown): WebSocketMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.type !== 'string' || !isRecord(parsed.payload) || typeof parsed.timestamp !== 'string') return null;
    return { type: parsed.type, payload: parsed.payload, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

function socketBaseUrl(path: string) {
  const configuredUrl = typeof window === 'undefined' ? undefined : (window as RuntimeWindow).__NEXT_PUBLIC_WS_URL__;
  return `${configuredUrl || 'ws://localhost:3003'}${path}`;
}

function stringField(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === 'string' ? value[key] : undefined;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { accessToken } = useBrowserSession();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const connectRef = useRef<() => void>(() => undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const maxReconnectAttempts = 10;
  const { onMessage, onConnect, onDisconnect, onError, reconnect = true, reconnectInterval = 3000 } = options;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    const token = accessToken || '';
    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
      onConnect?.();
    };

    ws.onmessage = (event) => {
      const message = parseMessage(event.data);
      if (!message) {
        console.warn('Ignored malformed WebSocket message.');
        return;
      }
      setLastMessage(message);
      onMessage?.(message);
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();
      if (!reconnect || reconnectAttempts.current >= maxReconnectAttempts) return;
      reconnectAttempts.current += 1;
      const delay = Math.min(reconnectInterval * Math.pow(1.5, reconnectAttempts.current - 1), 30000);
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
    };

    ws.onerror = (event) => onError?.(event);
  }, [url, accessToken, onMessage, onConnect, onDisconnect, onError, reconnect, reconnectInterval]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: JsonRecord) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, lastMessage, send, connect, disconnect };
}

export function useJobUpdates(jobId?: string) {
  const [jobStatus, setJobStatus] = useState<JsonRecord | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const { isConnected } = useWebSocket(socketBaseUrl('/ws/jobs'), {
    onMessage: (message) => {
      if (message.type !== 'job_update' || (jobId && stringField(message.payload, 'jobId') !== jobId)) return;
      const status = message.payload.status;
      setJobStatus(isRecord(status) ? status : null);
      const progress = message.payload.progress;
      setJobProgress(typeof progress === 'number' ? progress : 0);
    },
  });
  return { isConnected, jobStatus, jobProgress };
}

export function useMetricsUpdates(platform?: string) {
  const [metrics, setMetrics] = useState<JsonRecord[]>([]);
  const { isConnected } = useWebSocket(socketBaseUrl('/ws/metrics'), {
    onMessage: (message) => {
      if (message.type !== 'metrics_update' || !isRecord(message.payload.metrics)) return;
      const metric = message.payload.metrics;
      const metricId = stringField(metric, 'id');
      const metricPlatform = stringField(metric, 'platform');
      if (!metricId || (platform && metricPlatform !== platform)) return;
      setMetrics((current) => {
        const existing = current.some((item) => stringField(item, 'id') === metricId);
        return existing ? current.map((item) => stringField(item, 'id') === metricId ? metric : item) : [metric, ...current.slice(0, 99)];
      });
    },
  });
  return { isConnected, metrics };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<JsonRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isConnected } = useWebSocket(socketBaseUrl('/ws/notifications'), {
    onMessage: (message) => {
      if (message.type !== 'notification') return;
      setNotifications((current) => [message.payload, ...current.slice(0, 49)]);
      setUnreadCount((current) => current + 1);
    },
  });

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) => current.map((notification) => stringField(notification, 'id') === id ? { ...notification, read: true } : notification));
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
  }, []);

  return { isConnected, notifications, unreadCount, markAsRead, markAllAsRead };
}

export function useCampaignUpdates(campaignId?: string) {
  const [campaign, setCampaign] = useState<JsonRecord | null>(null);
  const [posts, setPosts] = useState<JsonRecord[]>([]);
  const { isConnected } = useWebSocket(socketBaseUrl('/ws/campaigns'), {
    onMessage: (message) => {
      if (campaignId && stringField(message.payload, 'campaignId') !== campaignId) return;
      if (message.type === 'campaign_update') {
        setCampaign(isRecord(message.payload.campaign) ? message.payload.campaign : null);
      }
      if (message.type === 'post_update' && isRecord(message.payload.post)) {
        const post = message.payload.post;
        const postId = stringField(post, 'id');
        if (!postId) return;
        setPosts((current) => {
          const existing = current.some((item) => stringField(item, 'id') === postId);
          return existing ? current.map((item) => stringField(item, 'id') === postId ? post : item) : [post, ...current];
        });
      }
    },
  });
  return { isConnected, campaign, posts };
}
