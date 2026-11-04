import { useCallback, useEffect, useRef, useState } from "react";

export type ChatEventType = "text" | "reaction" | "media" | "reel_share";
export type ChatEvent = { type: ChatEventType; user_id: string; content?: string; message_id?: string; media_url?: string };
export type LiveScore = { user_id: string; username: string; points: number };
export type ChatBroadcast = ChatEvent & { points_awarded?: number; total_points?: number; live_scores?: LiveScore[] };
type ConnectionState = "connecting" | "open" | "closed" | "error";

const apiBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://gc-scorecard-api.onrender.com" : "")).replace(/\/$/, "");
const websocketBaseUrl = import.meta.env.VITE_WS_URL || (apiBaseUrl
  ? apiBaseUrl.replace(/^http/, "ws")
  : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);

export function useChatWebSocket(groupId: string, userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatBroadcast[]>([]);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [serverError, setServerError] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed");

  useEffect(() => {
    if (!groupId || !userId) return;
    let active = true;
    let retryTimer: number | undefined;
    let retryCount = 0;

    const connect = () => {
      if (!active) return;
      setConnectionState("connecting");
      const socket = new WebSocket(`${websocketBaseUrl}/ws/groups/${groupId}`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryCount = 0;
        setConnectionState("open");
        setServerError("");
      };
      socket.onerror = () => {
        setConnectionState("error");
        setServerError("Live chat could not connect. Check the backend deployment and VITE_WS_URL.");
      };
      socket.onclose = () => {
        if (!active) return;
        setConnectionState("closed");
        retryCount += 1;
        const delay = Math.min(1000 * 2 ** (retryCount - 1), 15000);
        retryTimer = window.setTimeout(connect, delay);
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as ChatBroadcast & { error?: string };
          if (event.error) { setServerError(event.error); return; }
          setServerError("");
          setMessages((current) => [...current, event]);
          if (event.live_scores) setScores(event.live_scores);
        } catch {
          setServerError("The server sent an unreadable live chat update.");
        }
      };
    };

    fetch(`${apiBaseUrl}/api/groups/${groupId}/scores`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load scores");
        return response.json() as Promise<LiveScore[]>;
      })
      .then((initialScores) => { if (active) setScores(initialScores); })
      .catch(() => { if (active) setScores([]); });

    connect();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [groupId, userId]);

  const sendEvent = useCallback((event: Omit<ChatEvent, "user_id">) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(JSON.stringify({ ...event, user_id: userId }));
    return true;
  }, [userId]);

  return { messages, scores, serverError, connectionState, sendEvent };
}
