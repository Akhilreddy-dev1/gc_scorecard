import { useCallback, useEffect, useRef, useState } from "react";

export type ChatEventType = "text" | "reaction" | "media" | "reel_share";

export type ChatEvent = {
  type: ChatEventType;
  user_id: string;
  content?: string;
  message_id?: string;
  media_url?: string;
};

export type LiveScore = {
  user_id: string;
  username: string;
  points: number;
};

export type ChatBroadcast = ChatEvent & {
  error?: string;
  points_awarded?: number;
  total_points?: number;
  live_scores?: LiveScore[];
};

type ConnectionState = "connecting" | "open" | "closed" | "error";

const websocketBaseUrl =
  import.meta.env.VITE_WS_URL ??
  (import.meta.env.DEV ? "ws://localhost:8000" : "");

export function useChatWebSocket(groupId: string, userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatBroadcast[]>([]);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    if (!websocketBaseUrl) {
      setConnectionState("error");
      return;
    }

    const socket = new WebSocket(`${websocketBaseUrl}/ws/groups/${groupId}`);
    socketRef.current = socket;
    setConnectionState("connecting");

    socket.onopen = () => setConnectionState("open");
    socket.onerror = () => setConnectionState("error");
    socket.onclose = () => setConnectionState("closed");
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as ChatBroadcast;
      if (event.error) return;
      setMessages((current) => [...current, event]);
      if (event.live_scores) setScores(event.live_scores);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [groupId]);

  const sendEvent = useCallback(
    (event: Omit<ChatEvent, "user_id">) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
      socketRef.current.send(JSON.stringify({ ...event, user_id: userId }));
      return true;
    },
    [userId],
  );

  return { messages, scores, connectionState, sendEvent };
}
