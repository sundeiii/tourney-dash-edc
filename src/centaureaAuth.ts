export const CENTAUREA_API = "https://api.centaurea.ee/api/v1";

// the only things read as staff: qualifier scores and mappools before
// they're public. Nothing else gets the cookie or goes through the relay,
// so neither can be used to read anything else as the host
export const CENTAUREA_AUTHED_PATH =
  /^(stages\/[\w-]+\/qualifier-scores|mappools\/[\w-]+\/full)$/;
