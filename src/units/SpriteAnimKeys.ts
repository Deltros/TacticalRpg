/**
 * Convención de nombres compartida entre PreloadScene (que carga texturas y
 * arma animaciones) y UnitView (que las reproduce). Vive en un solo lugar
 * para que ambos lados no puedan desincronizarse.
 */

export function frameTextureKey(spriteKey: string, index: number): string {
  return `${spriteKey}_idle_${index}`;
}

export function idleAnimKey(spriteKey: string): string {
  return `${spriteKey}_idle`;
}
