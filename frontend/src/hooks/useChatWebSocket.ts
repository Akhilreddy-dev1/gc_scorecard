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
  points_awarded?: number;
  total_points?: number;
  live_scores?: LiveScore[];
};

type ConnectionState = "connecting" | "open" | "closed" | "error";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";
const websocketBaseUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

export function useChatWebSocket(groupId: string, userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatBroadcast[]>([]);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [serverError, setServerError] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed");

  useEffect(() => {
    if (!groupId || !userId) return;

    let active = true;
    const socket = new WebSocket(`${websocketBaseUrl}/ws/groups/${groupId}`);
    socketRef.current = socket;
    setConnectionState("connecting");

    fetch(`${apiBaseUrl}/api/groups/${groupId}/scores`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load scores");
        return response.json() as Promise<LiveScore[]>;
      })
      .then((initialScores) => {
        if (active) setScores(initialScores);
      })
      .catch(() => {
        if (active) setScores([]);
      });

    socket.onopen = () => setConnectionState("open");
    socket.onerror = () => setConnectionState("error");
    socket.onclose = () => setConnectionState("closed");
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as ChatBroadcast & { error?: string };
      if (event.error) {
        setServerError(event.error);
        return;
      }
      setServerError("");
      setMessages((current) => [...current, event]);
      if (event.live_scores) setScores(event.live_scores);
    };

    return () => {
      active = false;
      socket.close();
      socketRef.current = null;
    };
  }, [groupId, userId]);

  const sendEvent = useCallback(
    (event: Omit<ChatEvent, "user_id">) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
      socketRef.current.send(JSON.stringify({ ...event, user_id: userId }));
      return true;
    },
    [userId],
  );

  return { messages, scores, serverError, connectionState, sendEvent };
}
