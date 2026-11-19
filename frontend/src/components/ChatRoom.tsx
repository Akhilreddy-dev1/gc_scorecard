import { useEffect, useRef, useState } from "react";
import type { ChatBroadcast, ChatEventType } from "../hooks/useChatWebSocket";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const MORE_REACTIONS = [
  "🔥", "😍", "🥰", "😭", "💀", "🙌", "👏", "💯",
  "🎉", "✨", "🤩", "😎", "🥳", "🤯", "🥺", "🙏",
  "🤝", "💪", "👀", "💅", "🫡", "🫶", "😈", "🤡",
  "🫠", "🤭", "🫣", "😤", "💔", "❤️‍🔥", "💕", "👑",
  "⭐", "⚡", "🍿", "🍕", "☕", "🏆", "👻", "💩",
];

type ChatRoomProps = {
  messages: ChatBroadcast[];
  connectionState: string;
  serverError: string;
  onSend: (event: {
    type: ChatEventType;
    content?: string;
    message_id?: string;
    media_url?: string;
  }) => boolean;
  typingNames: string[];
  isOwner: boolean;
  onTyping: (typing: boolean) => void;
  onClearHistory: () => Promise<boolean>;
};

function savedChatTheme() {
  try { return localStorage.getItem("gc-scorecard-chat-theme") ?? "onyx"; }
  catch { return "onyx"; }
}

export function ChatRoom({ messages, connectionState, serverError, onSend, typingNames, isOwner, onTyping, onClearHistory }: ChatRoomProps) {
  const [text, setText] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openPickerFor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPickerFor(null);
        setShowMoreEmojis(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPickerFor]);

  const sendReaction = (messageId: string | undefined, emoji: string) => {
    if (!messageId) return;
    onSend({ type: "reaction", content: emoji, message_id: messageId });
    setOpenPickerFor(null);
    setShowMoreEmojis(false);
  };

  const sendText = () => {
    const content = text.trim();
    if (!content) return;
    if (onSend({ type: "text", content })) { setText(""); onTyping(false); }
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

  const reactionsByMessage = new Map<string, Map<string, string[]>>();
  for (const item of messages) {
    if (item.type === "reaction" && item.target_message_id && item.content) {
      let emojiMap = reactionsByMessage.get(item.target_message_id);
      if (!emojiMap) {
        emojiMap = new Map();
        reactionsByMessage.set(item.target_message_id, emojiMap);
      }
      const users = emojiMap.get(item.content) ?? [];
      users.push(item.username ?? item.user_id.slice(0, 8));
      emojiMap.set(item.content, users);
    }
  }
  const displayMessages = messages.filter(
    (item) => !(item.type === "reaction" && item.target_message_id),
  );

  return (
    <section className="glass-panel placeholder-panel" aria-labelledby="chat-room-title">
      <fieldset className="theme-options">
        <legend>Chat theme</legend>
        <label><input type="radio" name="chat-theme" value="onyx" defaultChecked={savedChatTheme() === "onyx"} onChange={() => localStorage.setItem("gc-scorecard-chat-theme", "onyx")} /><span>Onyx</span></label>
        <label><input type="radio" name="chat-theme" value="garnet" defaultChecked={savedChatTheme() === "garnet"} onChange={() => localStorage.setItem("gc-scorecard-chat-theme", "garnet")} /><span>Garnet</span></label>
        <label><input type="radio" name="chat-theme" value="pine" defaultChecked={savedChatTheme() === "pine"} onChange={() => localStorage.setItem("gc-scorecard-chat-theme", "pine")} /><span>Pine</span></label>
        <label><input type="radio" name="chat-theme" value="turquoise" defaultChecked={savedChatTheme() === "turquoise"} onChange={() => localStorage.setItem("gc-scorecard-chat-theme", "turquoise")} /><span>Turquoise</span></label>
      </fieldset>
      <div className="section-heading">
        <div>
          <h2 id="chat-room-title">Group chat</h2>
        </div>
        <span className={`status-dot status-${connectionState}`} aria-label={`Connection ${connectionState}`} />
      </div>
      {isOwner && <div className="owner-history-actions"><button className="ghost-button" type="button" onClick={async () => {
        if (!window.confirm("Delete all group chat history for everyone? This cannot be undone.")) return;
        setHistoryError("");
        if (!await onClearHistory()) setHistoryError("Could not delete chat history. Please try again.");
      }}>Delete chat history</button>{historyError && <span className="error-message" role="alert">{historyError}</span>}</div>}
      <div className="message-list" aria-live="polite" onClick={() => { if (openPickerFor) { setOpenPickerFor(null); setShowMoreEmojis(false); } }}>
        {displayMessages.map((message, index) => {
          const msgId = message.message_id;
          const msgReactions = msgId ? reactionsByMessage.get(msgId) : undefined;
          const reactionEntries = msgReactions ? [...msgReactions.entries()] : [];
          const pickerOpen = Boolean(msgId && openPickerFor === msgId);
          return (
            <div className="message-row" key={msgId ?? `${message.user_id}-${index}`}>
              <div className="bubble-wrapper">
                <article
                  className="chat-bubble"
                  onDoubleClick={() => { if (message.type !== "reaction") sendReaction(msgId, "❤️"); }}
                  title={message.type !== "reaction" ? "Double-tap to ❤️" : undefined}
                >
                  <div className="bubble-meta">
                    <strong>{message.username ?? message.user_id.slice(0, 8)}</strong>
                    {isOwner && message.sent_at && <time>{new Date(message.sent_at).toLocaleTimeString()}</time>}
                  </div>
                  {message.media_url?.startsWith("data:image/") ? (
                    <img className="shared-media" src={message.media_url} alt={message.content ?? "Shared image"} />
                  ) : message.media_url?.startsWith("data:video/") ? (
                    <video className="shared-media" src={message.media_url} controls aria-label={message.content ?? "Shared video"} />
                  ) : (
                    <p>{message.content ?? message.media_url ?? message.type}</p>
                  )}
                </article>
                {message.type !== "reaction" && msgId && (
                  <button
                    className={`react-trigger${pickerOpen ? " open" : ""}`}
                    type="button"
                    aria-label="React to message"
                    title="React"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (pickerOpen) {
                        setOpenPickerFor(null);
                        setShowMoreEmojis(false);
                      } else {
                        setOpenPickerFor(msgId);
                        setShowMoreEmojis(false);
                      }
                    }}
                  >
                    ☺
                  </button>
                )}
                {pickerOpen && msgId && (
                  <div className={`ig-reaction-popover${index < 2 ? " below" : ""}`} role="dialog" aria-label="Choose reaction" onClick={(event) => event.stopPropagation()}>
                    <div className="ig-quick-bar">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="ig-emoji-btn"
                          aria-label={`React with ${emoji}`}
                          onClick={() => sendReaction(msgId, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`ig-emoji-btn ig-more-btn${showMoreEmojis ? " active" : ""}`}
                        aria-label="More reactions"
                        title="More emojis"
                        onClick={() => setShowMoreEmojis((open) => !open)}
                      >
                        +
                      </button>
                    </div>
                    {showMoreEmojis && (
                      <div className="ig-more-grid" role="list">
                        {MORE_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="ig-emoji-btn"
                            aria-label={`React with ${emoji}`}
                            onClick={() => sendReaction(msgId, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {reactionEntries.length > 0 && (
                <div className="reaction-pills" aria-label="Message reactions">
                  {reactionEntries.map(([emoji, users]) => (
                    <button
                      key={emoji}
                      type="button"
                      className="reaction-pill"
                      title={users.join(", ")}
                      aria-label={`${emoji} ${users.length} (${users.join(", ")})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        sendReaction(msgId, emoji);
                      }}
                    >
                      <span>{emoji}</span>
                      {users.length > 1 && <span className="reaction-count">{users.length}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {serverError && <p className="error-message" role="alert">{serverError}</p>}
      {isOwner && typingNames.length > 0 && <div className="typing-pill">{typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...</div>}
      <form className="composer" onSubmit={(event) => { event.preventDefault(); sendText(); }}>
        <label className="sr-only" htmlFor="message-input">Message</label>
        <input
          id="message-input"
          value={text}
          onChange={(event) => { setText(event.target.value); onTyping(Boolean(event.target.value)); }}
          placeholder="Write a message…"
        />
        <button className="send-button" type="submit" disabled={connectionState !== "open"} aria-label="Send message" title="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 2.5 14.8 21a1 1 0 0 1-1.9.05l-3.4-7.3-7.3-3.4a1 1 0 0 1 .05-1.9l18.5-6.7a.6.6 0 0 1 .75.75ZM9.5 13.5l4.2 1.95 3.8-10.45L7.05 8.8 9 13l6-5.5-5.5 6Z" /></svg></button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/*,video/*"
          onChange={(event) => uploadMedia(event.target.files?.[0])}
        />
        <button className="media-button" type="button" disabled={connectionState !== "open"} onClick={() => fileInputRef.current?.click()} aria-label="Add photo or video" title="Add photo or video">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </form>
      {uploadError && <p className="error-message" role="alert">{uploadError}</p>}
      <p className="muted media-note">Images and videos up to 2 MB are shared with the room.</p>
    </section>
  );
}
