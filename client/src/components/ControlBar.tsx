import React, { useState } from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';
import { ChatBox } from './ChatBox';

const EMOJIS = ['😀', '😂', '😮', '😡', '👍', '🎲'];

export function ControlBar() {
  const { roomId, playerId, chatOpen, setChatOpen, unreadChatCount } = useAppStore();
  const [showEmoji, setShowEmoji] = useState(false);

  const sendEmoji = (emoji: string) => {
    socket.emit('send_emoji', { roomId, playerId, emoji });
    setShowEmoji(false);
  };

  return (
    <>
      {chatOpen && <ChatBox onClose={() => setChatOpen(false)} />}
      {showEmoji && (
        <div className="emoji-picker">
          {EMOJIS.map((e) => (
            <button key={e} className="emoji-option" onClick={() => sendEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="control-bar">
        <button className="control-btn" aria-label="Emoji gönder" onClick={() => setShowEmoji((v) => !v)}>
          😀
        </button>
        <button className="control-btn control-btn-chat" aria-label="Sohbet" onClick={() => setChatOpen(!chatOpen)}>
          💬
          {!chatOpen && unreadChatCount > 0 && (
            <span className="unread-badge">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>
          )}
        </button>
      </div>
    </>
  );
}
