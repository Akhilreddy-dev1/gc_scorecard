import { useRef, useState } from "react";
import type {
  ChatBroadcast,
  ChatEventType,
} from "../hooks/useChatWebSocket";

type ChatRoomProps = {
  messages: ChatBroadcast[];
  connectionState: string;
  onSend: (event: {
    type: ChatEventType;
    content?: string;
    media_url?: string;
  }) => boolean;
};

export function ChatRoom({ messages, connectionState, onSend }: ChatRoomProps) {
  const [text, setText] = useState("");
  const [reelUrl, setReelUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendText = () => {
    const content = text.trim();
    if (!content || !onSend({ type: "text", content })) return;
    setText("");
  };

  const shareReel = () => {
    const url = reelUrl.trim();
    if (!url || !onSend({ type: "reel_share", content: url, media_url: url })) {
      return;
    }
    setReelUrl("");
  };

  const uploadMedia = (file?: File) => {
    if (!file) return;
    onSend({ type: "media", content: file.name, media_url: file.name });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section className="glass-panel placeholder-panel" aria-labelledby="chat-room-title">
      <p className="eyebrow">ROOM / GENERAL</p>
      <div className="section-heading">
        <div>
          <h2 id="chat-room-title">ChatRoom</h2>
          <p className="muted">{connectionState}</p>
        </div>
        <span className="status-dot" aria-label={`Connection ${connectionState}`} />
      </div>
      <div className="message-list" aria-live="polite">
        {messages.length === 0 && (
          <p className="muted empty-state">Start the conversation.</p>
        )}
        {messages.map((message, index) => (
          <article className="chat-bubble" key={`${message.user_id}-${index}`}>
            <div className="bubble-meta">
              <strong>{message.user_id.slice(0, 8)}</strong>
              {message.points_awarded ? (
                <span>+{message.points_awarded} pts</span>
              ) : null}
            </div>
            <p>{message.content ?? message.media_url ?? message.type}</p>
          </article>
        ))}
      </div>
      <div className="composer">
        <label className="sr-only" htmlFor="message-input">Message</label>
        <input
          id="message-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendText();
          }}
          placeholder="Write a message..."
        />
        <button type="button" onClick={sendText}>Send</button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/*,video/*"
          onChange={(event) => uploadMedia(event.target.files?.[0])}
        />
        <button
          className="ghost-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Media
        </button>
      </div>
      <div className="reel-composer">
        <label className="sr-only" htmlFor="reel-input">Reel URL</label>
        <input
          id="reel-input"
          value={reelUrl}
          onChange={(event) => setReelUrl(event.target.value)}
          placeholder="Paste a reel URL..."
          type="url"
        />
        <button className="ghost-button" type="button" onClick={shareReel}>
          Share Reel
        </button>
      </div>
    </section>
  );
}
