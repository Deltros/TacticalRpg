import type { MapData } from '../MapData';

// Abreviaturas para legibilidad del mapa
const G = 'GRASS';
const F = 'FOREST';
const M = 'MOUNTAIN';
const W = 'WATER';

/**
 * Mapa de prueba para el prototipo.
 * 12 columnas x 9 filas.
 *
 * Leyenda visual:
 *  G = Pradera (verde, costo 1)
 *  F = Bosque  (verde oscuro, costo 2)
 *  M = Montaña (gris, costo 3, infranqueable para infantería básica)
 *  W = Agua    (azul, infranqueable)
 */
export const testMap: MapData = {
  name: 'Campo de prueba',
  cols: 12,
  rows: 9,
  grid: [
    // col: 0  1  2  3  4  5  6  7  8  9  10 11
    [G, G, G, G, G, F, F, G, G, M, M, G], // row 0
    [G, G, G, F, G, F, G, G, G, G, M, G], // row 1
    [G, G, F, F, G, G, G, W, W, G, G, G], // row 2
    [G, G, F, G, G, G, G, W, G, G, G, G], // row 3
    [G, G, G, G, G, G, G, G, G, F, F, G], // row 4
    [M, G, G, G, G, F, G, G, G, F, G, G], // row 5
    [M, M, G, G, F, F, G, G, G, G, G, G], // row 6
    [G, M, G, G, G, F, G, G, W, W, G, G], // row 7
    [G, G, G, G, G, G, G, G, W, G, G, G], // row 8
  ],
  unitPlacements: [
    { type: 'astarion', col: 2, row: 4, faction: 'player' },
    { type: 'rogue',    col: 3, row: 5, faction: 'player' },
    { type: 'knight',   col: 4, row: 6, faction: 'player' },
    { type: 'soldier',  col: 9, row: 2, faction: 'enemy'  },
    { type: 'soldier',  col: 10, row: 5, faction: 'enemy' },
  ],
};
