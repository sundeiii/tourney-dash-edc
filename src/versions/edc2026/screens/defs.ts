// The open area for the four player captures, tiled 2x2 at 960x352 each: the
// full width between the header and the background art's chat bar (y 875).
export const GAMEPLAY_AREA = { x: 0, y: 171, width: 1920, height: 704 };

// the mappool reveal's osu! capture runs full screen (1920x1080) under the
// overlay; everything above the showcase background's white info bar is see-
// through, so the bar covers only the bottom of the game
export const SHOWCASE_AREA = { x: 0, y: 0, width: 1920, height: 973 };

export const TOP_HEIGHT = GAMEPLAY_AREA.y;
export const GAMEPLAY_HEIGHT = GAMEPLAY_AREA.height;
export const BOTTOM_HEIGHT = 1080 - TOP_HEIGHT - GAMEPLAY_HEIGHT;
