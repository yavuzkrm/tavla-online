import React, { useState } from 'react';
import { useAppStore } from '../store';

export function WaitingScreen() {
  const { roomId } = useAppStore();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="screen waiting-screen">
      <h2>Rakip bekleniyor…</h2>
      <p>Bu kodu rakibinle paylaş:</p>
      <button className="room-code" onClick={copy}>
        {roomId}
      </button>
      {copied && <div className="copied-hint">Kopyalandı!</div>}
      <div className="spinner" />
    </div>
  );
}
