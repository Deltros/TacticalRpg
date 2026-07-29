import type { MapData } from '../MapData';

// Abreviaturas para legibilidad del mapa
const G = 'GRASS';
const F = 'FOREST';
const M = 'MOUNTAIN';
const W = 'WATER';

const COLS = 40;
const ROWS = 30;

/**
 * Bloque original del prototipo (12x9), con las unidades. Se ubica cerca del
 * centro del mapa (no en una esquina) para poder scrollear hacia los 4 lados,
 * no solo hacia abajo/derecha.
 */
const ORIGINAL_BLOCK: readonly (readonly string[])[] = [
  [G, G, G, G, G, F, F, G, G, M, M, G],
  [G, G, G, F, G, F, G, G, G, G, M, G],
  [G, G, F, F, G, G, G, W, W, G, G, G],
  [G, G, F, G, G, G, G, W, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, F, F, G],
  [M, G, G, G, G, F, G, G, G, F, G, G],
  [M, M, G, G, F, F, G, G, G, G, G, G],
  [G, M, G, G, G, F, G, G, W, W, G, G],
  [G, G, G, G, G, G, G, G, W, G, G, G],
];

const BLOCK_COL = 14;
const BLOCK_ROW = 10;

/** Pinta un rectángulo de terreno sobre la grilla (mutación in-place) */
function paintRect(grid: string[][], terrain: string, col: number, row: number, w: number, h: number): void {
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (grid[r]?.[c] !== undefined) grid[r][c] = terrain;
    }
  }
}

/** Pega el bloque original en la grilla, en (BLOCK_COL, BLOCK_ROW) */
function stampOriginalBlock(grid: string[][]): void {
  for (let r = 0; r < ORIGINAL_BLOCK.length; r++) {
    for (let c = 0; c < ORIGINAL_BLOCK[r].length; c++) {
      grid[BLOCK_ROW + r][BLOCK_COL + c] = ORIGINAL_BLOCK[r][c];
    }
  }
}

/**
 * Arma el mapa grande: pradera de base y accidentes geográficos repartidos
 * por los 4 lados del bloque original (arriba, abajo, izquierda y derecha).
 * El bloque se pega AL FINAL, así ninguna decoración puede pisar las
 * unidades iniciales aunque sus rectángulos se solapen con esa zona.
 */
function buildTerrain(): string[][] {
  const grid: string[][] = Array.from({ length: ROWS }, () => Array<string>(COLS).fill(G));

  // Cordilleras
  paintRect(grid, M, 4, 3, 4, 3);    // arriba-izquierda
  paintRect(grid, M, 30, 2, 4, 3);   // arriba-derecha
  paintRect(grid, M, 2, 22, 3, 4);   // abajo-izquierda
  paintRect(grid, M, 34, 24, 3, 4);  // abajo-derecha

  // Bosques dispersos
  paintRect(grid, F, 1, 8, 3, 3);    // izquierda
  paintRect(grid, F, 8, 15, 3, 3);   // izquierda
  paintRect(grid, F, 20, 1, 4, 2);   // arriba
  paintRect(grid, F, 30, 14, 3, 4);  // derecha
  paintRect(grid, F, 36, 10, 3, 3);  // derecha
  paintRect(grid, F, 16, 23, 4, 3);  // abajo
  paintRect(grid, F, 22, 26, 4, 3);  // abajo

  // Lago
  paintRect(grid, W, 4, 17, 4, 3);   // izquierda

  // Río vertical a la derecha del bloque, con un vado (paso despejado)
  paintRect(grid, W, 33, 0, 1, 13);
  paintRect(grid, W, 33, 16, 1, 14);

  stampOriginalBlock(grid);

  return grid;
}

/**
 * Mapa de prueba para el prototipo.
 * 40 columnas x 30 filas — bastante más grande que el viewport visible
 * (12x9), para poder probar el scroll de cámara hacia cualquier borde.
 *
 * Leyenda visual:
 *  G = Pradera (verde, costo 1)
 *  F = Bosque  (verde oscuro, infranqueable)
 *  M = Montaña (gris, infranqueable)
 *  W = Agua    (azul, infranqueable)
 */
export const testMap: MapData = {
  name: 'Campo de prueba',
  cols: COLS,
  rows: ROWS,
  grid: buildTerrain(),
  unitPlacements: [
    { type: 'astarion', col: BLOCK_COL + 2,  row: BLOCK_ROW + 4, faction: 'player' },
    { type: 'rogue',    col: BLOCK_COL + 3,  row: BLOCK_ROW + 5, faction: 'player' },
    { type: 'knight',   col: BLOCK_COL + 4,  row: BLOCK_ROW + 6, faction: 'player' },
    { type: 'soldier',  col: BLOCK_COL + 9,  row: BLOCK_ROW + 2, faction: 'enemy'  },
    { type: 'soldier',  col: BLOCK_COL + 10, row: BLOCK_ROW + 5, faction: 'enemy' },
  ],
};
