'use client';

import { useEffect, useState } from 'react';

type Face = 'looped' | 'sans';

function readFace(): Face {
  if (typeof window === 'undefined') return 'looped';
  return window.localStorage.getItem('ct-thai-face') === 'sans' ? 'sans' : 'looped';
}

function applyFace(face: Face) {
  document.documentElement.dataset.thai = face;
  window.localStorage.setItem('ct-thai-face', face);
}

export function ThaiFaceToggle() {
  const [face, setFace] = useState<Face>('looped');

  useEffect(() => {
    const next = readFace();
    applyFace(next);
    setFace(next);
  }, []);

  function pick(next: Face) {
    applyFace(next);
    setFace(next);
  }

  return (
    <div className="thai-face" role="group" aria-label="ทดสอบตัวพิมพ์ไทย">
      <button type="button" data-on={face === 'looped'} onClick={() => pick('looped')}>
        Looped มีห่วง
      </button>
      <button type="button" data-on={face === 'sans'} onClick={() => pick('sans')}>
        Sans ไร้ห่วง
      </button>
    </div>
  );
}
