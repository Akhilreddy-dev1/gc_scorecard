import { useRef, useState } from "react";
import type { ChatBroadcast, ChatEventType } from "../hooks/useChatWebSocket";

type ChatRoomProps = {
  messages: ChatBroadcast[];
  connectionState: string;
  serverError: string;
  onSend: (event: {
    type: ChatEventType;
    content?: string;
    media_url?: string;
  }) => boolean;
};

export function ChatRoom({ messages, connectionState, serverError, onSend }: ChatRoomProps) {
  const [text, setText] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendText = () => {
    const content = text.trim();
    if (!content) return;
    if (onSend({ type: "text", content })) setText("");
    else setUploadError("Chat is reconnecting. Try sending again in a moment.");
  };

  const uploadMedia = (file?: File) => {
    if (!file) return;
    setUploadError("");
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUploadError("Choose an image or video file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Files must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const sent = onSend({
        type: "media",
        content: file.name,
        media_url: String(reader.result),
      });
      if (!sent) setUploadError("Chat is reconnecting. Try uploading again in a moment.");
    };
    reader.onerror = () => setUploadError("The file could not be read.");
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section className="glass-panel placeholder-panel" aria-labelledby="chat-room-title">
      <p className="eyebrow">ROOM / GENERAL</p>
      <div className="section-heading">
        <div>
          <h2 id="chat-room-title">Group chat</h2>
          <p className="muted">{connectionState}</p>
        </div>
        <span className={`status-dot status-${connectionState}`} aria-label={`Connection ${connectionState}`} />
      </div>
      <div className="message-list" aria-live="polite">
        {messages.length === 0 && <p className="muted empty-state">Start the conversation.</p>}
        {messages.map((message, index) => (
          <article className="chat-bubble" key={`${message.user_id}-${index}`}>
            <div className="bubble-meta">
              <strong>{message.user_id.slice(0, 8)}</strong>
              {message.points_awarded ? <span>+{message.points_awarded} pts</span> : null}
            </div>
            {message.media_url?.startsWith("data:image/") ? (
              <img className="shared-media" src={message.media_url} alt={message.content ?? "Shared image"} />
            ) : message.media_url?.startsWith("data:video/") ? (
              <video className="shared-media" src={message.media_url} controls aria-label={message.content ?? "Shared video"} />
            ) : message.type === "reel_share" && (message.media_url ?? message.content) ? (
              <iframe
                className="reel-player"
                src={message.media_url ?? message.content}
                title={`Reel shared by ${message.user_id.slice(0, 8)}`}
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <p>{message.content ?? message.media_url ?? message.type}</p>
            )}
          </article>
        ))}
      </div>
      {serverError && <p className="error-message" role="alert">{serverError}</p>}
      <form className="composer" onSubmit={(event) => { event.preventDefault(); sendText(); }}>
        <label className="sr-only" htmlFor="message-input">Message</label>
        <input
          id="message-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a message…"
        />
        <button type="submit" disabled={connectionState !== "open"}>Send</button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/*,video/*"
          onChange={(event) => uploadMedia(event.target.files?.[0])}
        />
        <button className="ghost-button" type="button" disabled={connectionState !== "open"} onClick={() => fileInputRef.current?.click()}>
          Media
        </button>
      </form>
      {uploadError && <p className="error-message" role="alert">{uploadError}</p>}
      <p className="muted media-note">Images and videos up to 2 MB are shared with the room.</p>
    </section>
  );
}
