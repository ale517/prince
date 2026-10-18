export const TILE_SIZE = 32;
export const SCREEN_TILES_W = 10;
export const SCREEN_TILES_H = 3;

/** Fall damage by rows fallen (spec 02). Index = rows; 4+ rows is lethal. */
export const FALL_DAMAGE_BY_ROWS = [0, 0, 1, 2] as const;
export const LETHAL_FALL_ROWS = 4;
