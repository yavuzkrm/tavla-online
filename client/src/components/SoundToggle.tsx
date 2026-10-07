import React, { useState } from 'react';
import { isSoundEnabled, playClickSound, setSoundEnabled } from '../sound';

export function SoundToggle() {
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const toggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playClickSound();
  };

  return (
    <button className="sound-toggle" onClick={toggle} aria-label={soundOn ? 'Sesi kapat' : 'Sesi aç'} title={soundOn ? 'Sesi kapat' : 'Sesi aç'}>
      {soundOn ? '🔊' : '🔇'}
    </button>
  );
}
