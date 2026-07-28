import { GridPosition, Faction } from '../utils/types';
import { Unit, UnitConfig } from './Unit';
import { createStats } from './UnitStats';
import { resolveUnitDefinition } from './UnitDefinitions';

/**
 * Fábrica de unidades.
 * Crea una Unit a partir de un typeKey, resolviendo su definición
 * (arquetipo + overrides de personaje) desde UnitDefinitions.
 *
 * Agregar un tipo de unidad nuevo no requiere tocar esta clase:
 * solo una entrada nueva en UnitDefinitions.ts.
 */
export class UnitFactory {
  create(typeKey: string, pos: GridPosition, faction: Faction): Unit {
    const def = resolveUnitDefinition(typeKey);
    const stats = createStats(def.stats);
    const config: UnitConfig = {
      typeKey: def.typeKey,
      label: def.label,
      actionKeys: def.actionKeys,
      spriteKey: def.spriteKey,
    };
    return new Unit(faction, config, stats, pos);
  }
}
