import React, { useState } from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';

export function ChatBox({ onClose }: { onClose: () => void }) {
  const { chat, roomId, playerId } = useAppStore();
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    socket.emit('send_chat', { roomId, playerId, text: text.trim() });
    setText('');
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <span>Sohbet</span>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="chat-messages">
        {chat.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg-${m.color}`}>
            <b>{m.name}:</b> {m.text}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          className="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Mesaj yaz…"
        />
        <button className="btn btn-primary" onClick={send}>
          Gönder
        </button>
      </div>
    </div>
  );
}
