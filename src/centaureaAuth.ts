export const CENTAUREA_API = "https://api.centaurea.ee/api/v1";

// the only things read as staff: qualifier scores and mappools before
// they're public, plus who's staffing each match and players' profiles for
// the Discord match reminder bot. Nothing else gets the cookie or goes
// through the relay, so neither can be used to read anything else as the host
export const CENTAUREA_AUTHED_PATH =
  /^(stages\/[\w-]+\/qualifier-scores|mappools\/[\w-]+\/full|events\/[\w-]+\/match-staff|accounts\/[\w-]+\/profile)$/;

// what the relay hands out without its token, so streamers' overlays need no
// setup: qualifier scores and pools. Anyone who finds the relay can read
// these early. The staff list and profiles can hold other people's details,
// so those still need the token (only the reminder bot has it)
export const CENTAUREA_OPEN_PATH =
  /^(stages\/[\w-]+\/qualifier-scores|mappools\/[\w-]+\/full)$/;
