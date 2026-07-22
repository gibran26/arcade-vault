/**
 * Convención compartida para el selector de skins visuales de los juegos de
 * Arcade Vault. Cada motor en `app/game-engines/<id>/engine.ts` resuelve una
 * paleta a partir de `SkinName` y `GamePlayClient.tsx` persiste la elección
 * del jugador en `localStorage`.
 */

export type SkinName = 'classic' | 'neon' | 'retro';

export const SKIN_ORDER: SkinName[] = ['classic', 'neon', 'retro'];

export const SKIN_LABELS: Record<SkinName, string> = {
  classic: 'Clásico',
  neon: 'Neon',
  retro: 'Retro',
};

function isSkinName(value: string | null): value is SkinName {
  return value !== null && (SKIN_ORDER as string[]).includes(value);
}

export function loadSkin(gameId: string): SkinName {
  if (typeof window === 'undefined') return 'classic';
  const stored = window.localStorage.getItem(`av_skin_${gameId}`);
  return isSkinName(stored) ? stored : 'classic';
}

export function saveSkin(gameId: string, skin: SkinName): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`av_skin_${gameId}`, skin);
}
