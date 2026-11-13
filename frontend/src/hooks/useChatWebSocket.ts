import { useCallback, useEffect, useRef, useState } from "react";
import { apiBaseUrl, backendIsConfigured, websocketBaseUrl } from "../config/api";

export type ChatEventType = "text" | "reaction" | "media" | "reel_share" | "typing_start" | "typing_stop";
export type ChatEvent = { type: ChatEventType; user_id: string; content?: string; message_id?: string; media_url?: string };
export type LiveScore = { user_id: string; username: string; points: number };
export type ChatBroadcast = ChatEvent & { username?: string; sent_at?: string; points_awarded?: number; total_points?: number; live_scores?: LiveScore[] };
type ConnectionState = "connecting" | "open" | "closed" | "error";

export function useChatWebSocket(groupId: string, userId: string, token = "") {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatBroadcast[]>([]);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [serverError, setServerError] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed");
  const [typingNames, setTypingNames] = useState<string[]>([]);

  useEffect(() => {
    if (!groupId || !userId) return;
    let active = true;
    let retryTimer: number | undefined;
    let retryCount = 0;

    if (!backendIsConfigured) {
      setConnectionState("error");
      setServerError("Backend is not connected. Set VITE_API_URL and VITE_WS_URL in the frontend deployment, then redeploy.");
      return () => { active = false; };
    }

    const connect = () => {
      if (!active) return;
      setConnectionState("connecting");
      const socket = new WebSocket(`${websocketBaseUrl}/ws/groups/${groupId}?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryCount = 0;
        setConnectionState("open");
        setServerError("");
      };
      socket.onerror = () => {
        setConnectionState("error");
        setServerError("Live chat could not connect. Check the backend deployment, VITE_API_URL, VITE_WS_URL, and WebSocket support.");
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
          if (event.type === "typing_start" || event.type === "typing_stop") {
            setTypingNames((current) => event.type === "typing_start" ? [...new Set([...current, event.username ?? "A member"])] : current.filter((n) => n !== event.username));
            return;
          }
          setMessages((current) => [...current, event]);
          if (event.live_scores) setScores(event.live_scores);
        } catch {
          setServerError("The server sent an unreadable live chat update.");
        }
      };
    };

    fetch(`${apiBaseUrl}/api/groups/${groupId}/scores`, { headers: { Authorization: `Bearer ${token}` } })
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
  }, [groupId, userId, token]);

  const sendEvent = useCallback((event: Omit<ChatEvent, "user_id">) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(JSON.stringify({ ...event, user_id: userId }));
    return true;
  }, [userId]);

  const sendTyping = useCallback((typing: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: typing ? "typing_start" : "typing_stop", user_id: userId }));
  }, [userId]);

  return { messages, scores, serverError, connectionState, sendEvent, sendTyping, typingNames };
}
