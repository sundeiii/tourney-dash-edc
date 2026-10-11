// Centaurea events the EDC overlay can show, picked on the dashboard
export const EDC_EVENTS = [
  { id: "1564f3e6-2d2b-45d6-8990-a9e0b2a75588", label: "EDC 2026" },
  // finished, with public qualifier results and a played-out bracket, so
  // every screen has real data to test against
  { id: "dc2c0566-49e0-4089-9443-ac2b1c52f3bb", label: "TipiLAN 2026 (test)" },
] as const;

export const EDC_EVENT_ID = EDC_EVENTS[0].id;
