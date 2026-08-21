'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface WebSocketMessage {
  type: string;
  payload: Record<string, any>;
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

interface SessionData {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { data: session } = useSession() as { data: SessionData | null };
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnect = true,
    reconnectInterval = 3000,
  } = options;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = session?.accessToken || '';
    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();

        if (reconnect && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(reconnectInterval * Math.pow(1.5, reconnectAttempts.current - 1), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        onError?.(error);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      onError?.(err as any);
    }
  }, [url, session?.accessToken, onMessage, onConnect, onDisconnect, onError, reconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    connect,
    disconnect,
  };
}

// Specialized hooks for different real-time features
export function useJobUpdates(jobId?: string) {
  const [jobStatus, setJobStatus] = useState<Record<string, any> | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);

  const { isConnected, lastMessage } = useWebSocket(
    `${(typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_WS_URL__ : '') || 'ws://localhost:3003'}/ws/jobs`,
    {
      onMessage: (message) => {
        if (message.type === 'job_update' && (!jobId || message.payload.jobId === jobId)) {
          setJobStatus(message.payload.status);
          setJobProgress(message.payload.progress || 0);
        }
      },
    }
  );

  return { isConnected, jobStatus, jobProgress };
}

export function useMetricsUpdates(platform?: string) {
  const [metrics, setMetrics] = useState<Record<string, any>[]>([]);

  const { isConnected, lastMessage } = useWebSocket(
    `${(typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_WS_URL__ : '') || 'ws://localhost:3003'}/ws/metrics`,
    {
      onMessage: (message) => {
        if (message.type === 'metrics_update') {
          const newMetrics = message.payload.metrics;
          if (!platform || newMetrics.platform === platform) {
            setMetrics((prev: Record<string, any>[]) => {
              const exists = prev.find((m: Record<string, any>) => m.id === newMetrics.id);
              if (exists) {
                return prev.map((m: Record<string, any>) => m.id === newMetrics.id ? newMetrics : m);
              }
              return [newMetrics, ...prev.slice(0, 99)];
            });
          }
        }
      },
    }
  );

  return { isConnected, metrics };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Record<string, any>[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { isConnected, lastMessage } = useWebSocket(
    `${(typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_WS_URL__ : '') || 'ws://localhost:3003'}/ws/notifications`,
    {
      onMessage: (message) => {
        if (message.type === 'notification') {
          setNotifications((prev: Record<string, any>[]) => [message.payload, ...prev.slice(0, 49)]);
          setUnreadCount((prev: number) => prev + 1);
        }
      },
    }
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev: Record<string, any>[]) => prev.map((n: Record<string, any>) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((prev: number) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev: Record<string, any>[]) => prev.map((n: Record<string, any>) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { isConnected, notifications, unreadCount, markAsRead, markAllAsRead };
}

export function useCampaignUpdates(campaignId?: string) {
  const [campaign, setCampaign] = useState<Record<string, any> | null>(null);
  const [posts, setPosts] = useState<Record<string, any>[]>([]);

  const { isConnected, lastMessage } = useWebSocket(
    `${(typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_WS_URL__ : '') || 'ws://localhost:3003'}/ws/campaigns`,
    {
      onMessage: (message) => {
        if (message.type === 'campaign_update' && (!campaignId || message.payload.campaignId === campaignId)) {
          setCampaign(message.payload.campaign);
        }
        if (message.type === 'post_update' && (!campaignId || message.payload.campaignId === campaignId)) {
          setPosts((prev: Record<string, any>[]) => {
            const exists = prev.find((p: Record<string, any>) => p.id === message.payload.post.id);
            if (exists) {
              return prev.map((p: Record<string, any>) => p.id === message.payload.post.id ? message.payload.post : p);
            }
            return [message.payload.post, ...prev];
          });
        }
      },
    }
  );

  return { isConnected, campaign, posts };
}
