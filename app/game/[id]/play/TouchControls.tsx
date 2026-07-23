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

// Fracción del radio del joystick que hay que recorrer antes de
// registrar una dirección, para evitar disparos por micro-temblores.
const DEAD_ZONE_RATIO = 0.35;

function dispatchKey(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

function directionsFromVector(
  dx: number,
  dy: number,
  radius: number,
  schema: TouchControlsSchema,
): Direction[] {
  const deadZone = radius * DEAD_ZONE_RATIO;
  if (schema.directions === 8) {
    const dirs: Direction[] = [];
    if (dx > deadZone) dirs.push('right');
    if (dx < -deadZone) dirs.push('left');
    if (dy > deadZone) dirs.push('down');
    if (dy < -deadZone) dirs.push('up');
    return dirs;
  }
  const distance = Math.hypot(dx, dy);
  if (distance < deadZone) return [];
  return [
    Math.abs(dx) >= Math.abs(dy)
      ? dx > 0
        ? 'right'
        : 'left'
      : dy > 0
        ? 'down'
        : 'up',
  ];
}

export default function TouchControls({
  schema,
  paused,
  onTogglePause,
  onFinish,
  onExit,
}: TouchControlsProps) {
  const activeCodes = useRef<Map<number, string>>(new Map());
  const joystickPointerId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickCodes = useRef<Set<string>>(new Set());
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const codes = activeCodes.current;
    const jCodes = joystickCodes.current;
    return () => {
      codes.forEach((code) => dispatchKey('keyup', code));
      codes.clear();
      jCodes.forEach((code) => dispatchKey('keyup', code));
      jCodes.clear();
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
      activeCodes.current.set(e.pointerId, code);
      dispatchKey('keydown', code);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Algunos entornos no reconocen el pointerId como activo; el
        // fallback de pointerup/pointerleave/pointercancel sigue liberando la tecla.
      }
    };

  const handleRelease = (e: PointerEvent<HTMLButtonElement>) => {
    releasePointer(e.pointerId);
  };

  const setKnobOffset = (x: number, y: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  const updateJoystickDirections = (dx: number, dy: number, radius: number) => {
    const dirs = directionsFromVector(dx, dy, radius, schema);
    const codes = new Set(
      dirs.map((d) => schema.joystick[d]).filter((c): c is string => !!c),
    );
    joystickCodes.current.forEach((code) => {
      if (!codes.has(code)) dispatchKey('keyup', code);
    });
    codes.forEach((code) => {
      if (!joystickCodes.current.has(code)) dispatchKey('keydown', code);
    });
    joystickCodes.current = codes;
  };

  const releaseJoystick = () => {
    joystickCodes.current.forEach((code) => dispatchKey('keyup', code));
    joystickCodes.current.clear();
    joystickPointerId.current = null;
    setKnobOffset(0, 0);
  };

  const handleJoystickDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    joystickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    joystickPointerId.current = e.pointerId;
    try {
      base.setPointerCapture(e.pointerId);
    } catch {
      // Igual que en los botones: el fallback de pointerup/cancel libera el stick.
    }
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: PointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    const base = baseRef.current;
    if (!base) return;
    const radius = base.clientWidth / 2;
    const knobRadius = (knobRef.current?.offsetWidth ?? radius) / 2;
    const maxTravel = Math.max(radius - knobRadius, 1);
    const dx = e.clientX - joystickCenter.current.x;
    const dy = e.clientY - joystickCenter.current.y;
    const distance = Math.hypot(dx, dy);
    const clampedScale = distance > maxTravel ? maxTravel / distance : 1;
    setKnobOffset(dx * clampedScale, dy * clampedScale);
    updateJoystickDirections(dx, dy, radius);
  };

  const handleJoystickUp = (e: PointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== e.pointerId) return;
    releaseJoystick();
  };

  const activeActions = ACTION_SLOTS.filter((slot) => schema[slot]);

  return (
    <div className="touch-controls">
      <div
        className={`touch-controls-main${activeActions.length === 0 ? ' touch-controls-main-solo' : ''}`}
      >
        <div
          ref={baseRef}
          className="touch-joystick-base"
          role="group"
          aria-label="Direccional"
          style={{ touchAction: 'none' }}
          onPointerDown={handleJoystickDown}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickUp}
          onPointerLeave={handleJoystickUp}
          onPointerCancel={handleJoystickUp}
        >
          {DIRECTIONS.map(
            (dir) =>
              schema.joystick[dir] && (
                <svg
                  key={dir}
                  className={`touch-joystick-hint touch-joystick-hint-${dir}`}
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path d={JOYSTICK_ARROW[dir]} fill="currentColor" />
                </svg>
              ),
          )}
          <div
            ref={knobRef}
            className="touch-joystick-knob"
            aria-hidden="true"
          />
        </div>

        {activeActions.length > 0 && (
          <div className="touch-actions">
            {activeActions.map((slot) => {
              const mapping = schema[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  className="touch-action-btn"
                  aria-label={mapping?.label}
                  style={{ touchAction: 'none' }}
                  onPointerDown={handlePress(mapping?.code)}
                  onPointerUp={handleRelease}
                  onPointerLeave={handleRelease}
                  onPointerCancel={handleRelease}
                >
                  {mapping && ACTION_ICONS[mapping.icon]}
                  <span>{mapping?.label}</span>
                </button>
              );
            })}
          </div>
        )}
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
