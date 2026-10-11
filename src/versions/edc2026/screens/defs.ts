// The open area for the four player captures, tiled 2x2 at 960x352 each: the
// full width between the header and the background art's chat bar (y 875).
export const GAMEPLAY_AREA = { x: 0, y: 171, width: 1920, height: 704 };

export const TOP_HEIGHT = GAMEPLAY_AREA.y;
export const GAMEPLAY_HEIGHT = GAMEPLAY_AREA.height;
export const BOTTOM_HEIGHT = 1080 - TOP_HEIGHT - GAMEPLAY_HEIGHT;
