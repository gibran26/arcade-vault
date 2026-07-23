'use client';

import { useEffect, useRef, type PointerEvent, type ReactElement } from 'react';
import type {
  ActionButtonMapping,
  TouchControlsSchema,
} from '@/app/game-engines/registry';

interface TouchControlsProps {
  schema: TouchControlsSchema;
  paused: boolean;
  onTogglePause: () => void;
  onFinish: () => void;
  onExit: () => void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

const JOYSTICK_ARROW: Record<Direction, string> = {
  up: 'M12 4 L19 15 L5 15 Z',
  down: 'M12 20 L5 9 L19 9 Z',
  left: 'M4 12 L15 5 L15 19 Z',
  right: 'M20 12 L9 19 L9 5 Z',
};

const ACTION_ICONS: Record<ActionButtonMapping['icon'], ReactElement> = {
  shoot: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3 L19 18 L12 14.5 L5 18 Z" fill="currentColor" />
    </svg>
  ),
  rotate: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 5 A7 7 0 1 1 5.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M4 4 L5.5 9 L10 7.5 Z" fill="currentColor" />
    </svg>
  ),
  drop: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 21 L5 6 L12 9.5 L19 6 Z" fill="currentColor" />
    </svg>
  ),
  thrust: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3 L18 20 L12 16 L6 20 Z" fill="currentColor" />
    </svg>
  ),
};

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const ACTION_SLOTS = ['buttonA', 'buttonB'] as const;

function dispatchKey(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

export default function TouchControls({
  schema,
  paused,
  onTogglePause,
  onFinish,
  onExit,
}: TouchControlsProps) {
  const activeCodes = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    return () => {
      activeCodes.current.forEach((code) => dispatchKey('keyup', code));
      activeCodes.current.clear();
    };
  }, []);

  const releasePointer = (pointerId: number) => {
    const code = activeCodes.current.get(pointerId);
    if (!code) return;
    activeCodes.current.delete(pointerId);
    dispatchKey('keyup', code);
  };

  const handlePress =
    (code: string | undefined) => (e: PointerEvent<HTMLButtonElement>) => {
      if (!code) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      activeCodes.current.set(e.pointerId, code);
      dispatchKey('keydown', code);
    };

  const handleRelease = (e: PointerEvent<HTMLButtonElement>) => {
    releasePointer(e.pointerId);
  };

  return (
    <div className="touch-controls">
      <div className="touch-controls-main">
        <div className="touch-joystick" role="group" aria-label="Direccional">
          <div className="touch-joystick-base">
            {DIRECTIONS.map((dir) => {
              const code = schema.joystick[dir];
              return (
                <button
                  key={dir}
                  type="button"
                  className={`touch-joystick-zone touch-joystick-${dir}`}
                  disabled={!code}
                  aria-label={dir}
                  style={{ touchAction: 'none' }}
                  onPointerDown={handlePress(code)}
                  onPointerUp={handleRelease}
                  onPointerLeave={handleRelease}
                  onPointerCancel={handleRelease}
                >
                  {code && (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path d={JOYSTICK_ARROW[dir]} fill="currentColor" />
                    </svg>
                  )}
                </button>
              );
            })}
            <div className="touch-joystick-knob" aria-hidden="true" />
          </div>
        </div>

        <div className="touch-actions">
          {ACTION_SLOTS.map((slot) => {
            const mapping = schema[slot];
            return (
              <button
                key={slot}
                type="button"
                className="touch-action-btn"
                disabled={!mapping}
                aria-label={mapping?.label ?? 'Sin función'}
                style={{ touchAction: 'none' }}
                onPointerDown={handlePress(mapping?.code)}
                onPointerUp={handleRelease}
                onPointerLeave={handleRelease}
                onPointerCancel={handleRelease}
              >
                {mapping && ACTION_ICONS[mapping.icon]}
                <span>{mapping?.label ?? '—'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="touch-utility">
        <button
          type="button"
          className="btn yellow touch-utility-btn"
          onClick={onTogglePause}
        >
          {paused ? 'REANUDAR' : 'PAUSA'}
        </button>
        <button
          type="button"
          className="btn magenta touch-utility-btn"
          onClick={onFinish}
        >
          FIN
        </button>
        <button
          type="button"
          className="btn ghost touch-utility-btn"
          onClick={onExit}
        >
          REGRESAR
        </button>
      </div>
    </div>
  );
}
