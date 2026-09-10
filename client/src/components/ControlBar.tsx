import React, { useState } from 'react';
import { socket } from '../socket';
import { useAppStore } from '../store';
import { ChatBox } from './ChatBox';

const EMOJIS = ['😀', '😂', '😮', '😡', '👍', '🎲'];

export function ControlBar() {
  const { roomId, playerId } = useAppStore();
  const [soundOn, setSoundOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const sendEmoji = (emoji: string) => {
    socket.emit('send_emoji', { roomId, playerId, emoji });
    setShowEmoji(false);
  };

  return (
    <>
      {showChat && <ChatBox onClose={() => setShowChat(false)} />}
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
        <button className="control-btn" onClick={() => setSoundOn((v) => !v)}>
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button className="control-btn" onClick={() => setMicOn((v) => !v)}>
          {micOn ? '🎤' : '🔈'}
        </button>
        <button className="control-btn" onClick={() => setShowEmoji((v) => !v)}>
          😀
        </button>
        <button className="control-btn" onClick={() => setShowChat((v) => !v)}>
          💬
        </button>
      </div>
    </>
  );
}
