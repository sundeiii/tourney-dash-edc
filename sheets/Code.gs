/**
 * Centaurea tournament signup sync
 * -----------------------------------
 * Pulls signups for an event from api.centaurea.ee and writes clean rows
 * into a "Signups Data" tab. Build IMAGE()/text formulas in your styled
 * Players tab that reference this tab so a re-sync never touches your
 * hand-formatted cells.
 *
 * Setup:
 *   1. Extensions > Apps Script, paste this whole file in as Code.gs, Save.
 *   2. Reload the spreadsheet. A "Tournament Tools" menu appears.
 *   3. Tournament Tools > Set API Credentials:
 *        - Event ID: the UUID from .../events/<event_id>/signups
 *        - Session cookie: DevTools > Network > any api.centaurea.ee
 *          request > Headers > Request Cookies > value of "centaurea_session"
 *        - cf_clearance (optional): same place, value of "cf_clearance".
 *          Note: this is tied to your browser's IP/fingerprint and may
 *          simply not work when replayed from Google's servers. If sync
 *          fails with a 401/403, that's almost certainly why.
 *   4. Tournament Tools > Sync Signups. A player's rank is saved the first
 *      time a sync sees them and kept on every re-sync after that; clear a
 *      rank cell to fetch that player's rank again.
 *   5. Tournament Tools > Populate Players Tab — duplicates the team-block
 *      template on the "Players" tab (if you have more teams than built
 *      blocks) and drops in formulas that pull from Signups Data, so the
 *      Players tab stays hands-off and just reflects whatever's synced.
 *   6. Tournament Tools > Sync Mappool / Sync Qualifiers Schedule /
 *      Sync Schedule — see the "Mappool, Qualifiers Schedule and Schedule
 *      sync" section further down.
 */

const SIGNUPS_SHEET_NAME = 'Signups Data';
const API_BASE = 'https://api.centaurea.ee/api/v1';

const HEADERS = [
  'Team ID', 'Team Name', 'Screening Status',
  'Captain Username', 'Captain Discord', 'Captain Country', 'Captain Country Code', 'Captain Avatar URL', 'Captain Osu ID', 'Captain Global Rank',
  'Player 2 Username', 'Player 2 Discord', 'Player 2 Country', 'Player 2 Country Code', 'Player 2 Avatar URL', 'Player 2 Osu ID', 'Player 2 Global Rank',
  'Last Synced'
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tournament Tools')
    .addItem('Set API Credentials', 'setCredentials')
    .addItem('Sync Signups', 'syncSignups')
    .addItem('Populate Players Tab', 'populatePlayersTab')
    .addSeparator()
    .addItem('Sync Mappool', 'syncMappool')
    .addItem('Sync Qualifiers Schedule', 'syncQualifiersSchedule')
    .addItem('Sync Schedule', 'syncSchedule')
    .addItem('Turn Schedule Auto-Sync On/Off', 'toggleScheduleAutoSync')
    .addSeparator()
    .addItem('Set osu! API Credentials (optional)', 'setOsuCredentials')
    .addToUi();
}

function setCredentials() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const eventIdResp = ui.prompt(
    'Event ID',
    'Paste the event UUID (from .../events/<event_id>/signups):',
    ui.ButtonSet.OK_CANCEL
  );
  if (eventIdResp.getSelectedButton() !== ui.Button.OK) return;
  const eventId = eventIdResp.getResponseText().trim();
  if (eventId) props.setProperty('EVENT_ID', eventId);

  const cookieResp = ui.prompt(
    'Session Cookie',
    'DevTools > Network > any api.centaurea.ee request > Headers > Request Cookies.\nPaste the value of "centaurea_session":',
    ui.ButtonSet.OK_CANCEL
  );
  if (cookieResp.getSelectedButton() !== ui.Button.OK) return;
  const cookie = cookieResp.getResponseText().trim();
  if (cookie) props.setProperty('SESSION_COOKIE', cookie);

  const cfResp = ui.prompt(
    'Cloudflare Clearance (optional)',
    'Paste the value of "cf_clearance" if present, or leave blank and click OK:',
    ui.ButtonSet.OK_CANCEL
  );
  if (cfResp.getSelectedButton() === ui.Button.OK) {
    const cf = cfResp.getResponseText().trim();
    if (cf) props.setProperty('CF_CLEARANCE', cf);
    else props.deleteProperty('CF_CLEARANCE');
  }

  ui.alert('Saved. Run "Sync Signups" to test the connection.');
}

function getCookieHeader_() {
  const props = PropertiesService.getScriptProperties();
  const sessionCookie = props.getProperty('SESSION_COOKIE');
  const cfClearance = props.getProperty('CF_CLEARANCE');
  if (!sessionCookie) {
    throw new Error('No session cookie saved. Run "Tournament Tools > Set API Credentials" first.');
  }
  let cookieHeader = `centaurea_session=${sessionCookie}`;
  if (cfClearance) cookieHeader += `; cf_clearance=${cfClearance}`;
  return cookieHeader;
}

function apiGet_(path) {
  const url = `${API_BASE}${path}`;
  const resp = UrlFetchApp.fetch(url, {
    headers: { Cookie: getCookieHeader_() },
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error(
      `Auth failed (HTTP ${code}) on ${path}. Your session cookie may have expired, or ` +
      `Cloudflare blocked the request from Apps Script. Re-run "Set API Credentials" with a fresh cookie.`
    );
  }
  if (code !== 200) {
    throw new Error(`Request to ${path} failed with HTTP ${code}: ${resp.getContentText().slice(0, 200)}`);
  }
  return JSON.parse(resp.getContentText());
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function fetchPlayerDetails_(uuid, cache) {
  if (cache[uuid]) return cache[uuid];

  const accountData = apiGet_(`/accounts/${uuid}/profile`);
  const user = accountData.user;

  let country = '', countryCode = '', globalRank = '';
  try {
    const userData = apiGet_(`/users/${user.osu_user_id}`);
    country = userData.country || '';
    countryCode = userData.country_code || '';
    globalRank = (userData.statistics && userData.statistics.global_rank) || '';
  } catch (e) {
    // osu profile lookup failing shouldn't kill the whole row
  }

  const details = {
    username: user.username || '',
    discord: user.discord || '',
    country: country,
    countryCode: countryCode,
    avatarUrl: user.avatar_url || '',
    osuId: user.osu_user_id || '',
    globalRank: globalRank
  };
  cache[uuid] = details;
  return details;
}

/**
 * Ranks are frozen at the sync that first sees a player: re-syncing keeps
 * the rank already in Signups Data, by osu! id, instead of today's rank.
 * Clear a rank cell to have the next sync fetch that player's rank again.
 */
function readFrozenRanks_(sheet) {
  const ranks = {};
  if (sheet.getLastRow() < 2) return ranks;

  const width = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, width).getValues()[0];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  [['Captain Osu ID', 'Captain Global Rank'], ['Player 2 Osu ID', 'Player 2 Global Rank']].forEach(cols => {
    const idCol = header.indexOf(cols[0]);
    const rankCol = header.indexOf(cols[1]);
    if (idCol === -1 || rankCol === -1) return;
    rows.forEach(r => {
      if (r[idCol] !== '' && r[rankCol] !== '') ranks[String(r[idCol])] = r[rankCol];
    });
  });
  return ranks;
}

function keepFrozenRank_(details, frozenRanks) {
  const frozen = frozenRanks[String(details.osuId)];
  return frozen === undefined ? details : Object.assign({}, details, { globalRank: frozen });
}

function syncSignups() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const eventId = props.getProperty('EVENT_ID');
  if (!eventId) {
    ui.alert('No event ID saved. Run "Tournament Tools > Set API Credentials" first.');
    return;
  }

  let signups;
  try {
    signups = apiGet_(`/events/${eventId}/signups`);
  } catch (e) {
    ui.alert('Sync failed: ' + e.message);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, SIGNUPS_SHEET_NAME);
  const frozenRanks = readFrozenRanks_(sheet);
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');

  const profileCache = {};
  const rows = [];
  let failures = 0;

  signups.forEach(entrant => {
    if (entrant.kind !== 'team' || !entrant.team_id) {
      return; // solo entrants aren't handled yet — extend here if the event allows them
    }
    try {
      const teamData = apiGet_(`/teams/${entrant.team_id}`);
      const members = teamData.members || [];
      const captain = members.find(m => m.is_captain) || members[0] || {};
      const playerTwo = members.find(m => m.user_id !== captain.user_id) || {};

      const captainDetails = captain.user_id ? keepFrozenRank_(fetchPlayerDetails_(captain.user_id, profileCache), frozenRanks) : {};
      const playerTwoDetails = playerTwo.user_id ? keepFrozenRank_(fetchPlayerDetails_(playerTwo.user_id, profileCache), frozenRanks) : {};

      rows.push([
        entrant.team_id,
        teamData.team.name,
        entrant.screening_status,
        captainDetails.username || '', captainDetails.discord || '', captainDetails.country || '', captainDetails.countryCode || '', captainDetails.avatarUrl || '', captainDetails.osuId || '', captainDetails.globalRank || '',
        playerTwoDetails.username || '', playerTwoDetails.discord || '', playerTwoDetails.country || '', playerTwoDetails.countryCode || '', playerTwoDetails.avatarUrl || '', playerTwoDetails.osuId || '', playerTwoDetails.globalRank || '',
        new Date()
      ]);
    } catch (e) {
      failures++;
      rows.push([entrant.team_id, entrant.name, entrant.screening_status, 'ERROR: ' + e.message]);
    }
    Utilities.sleep(150); // be polite to the API
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(
      rows.map(r => {
        while (r.length < HEADERS.length) r.push('');
        return r;
      })
    );
  }

  sheet.autoResizeColumns(1, HEADERS.length);

  const msg = `Synced ${rows.length} teams${failures ? `, ${failures} failed (see ERROR rows)` : ''}.`;
  ui.alert(msg);
}

/**
 * Players tab layout (matches the "[EDC] Draft Sheet" template):
 * Each team occupies an 8-row block (6 rows of content + 2 spacer rows).
 * Block i (1-based) starts at row R = PLAYERS_BLOCK_START + (i-1) * PLAYERS_BLOCK_HEIGHT.
 * Only PLAYERS_TEMPLATE_BLOCKS blocks are pre-built with formatting/merges;
 * populatePlayersTab() duplicates block 1's formatting for any teams beyond that.
 */
const PLAYERS_SHEET_NAME = 'Players';
const PLAYERS_BLOCK_START = 14;
const PLAYERS_BLOCK_HEIGHT = 8;
const PLAYERS_TEMPLATE_BLOCKS = 4;
const PLAYERS_LAST_COL = 69; // column BQ, the right edge of the template

// Tracks how many team blocks have actually been built below the template,
// so re-running populatePlayersTab() never re-inserts rows it already added.
const PLAYERS_BLOCKS_BUILT_PROP = 'PLAYERS_BLOCKS_BUILT';

function ensureTeamBlocks_(sheet, teamCount) {
  const props = PropertiesService.getScriptProperties();
  const builtBlocks = parseInt(props.getProperty(PLAYERS_BLOCKS_BUILT_PROP) || String(PLAYERS_TEMPLATE_BLOCKS), 10);
  if (teamCount <= builtBlocks) return;

  const blocksToAdd = teamCount - builtBlocks;
  const rowsToAdd = blocksToAdd * PLAYERS_BLOCK_HEIGHT;
  // Everything from this row down (the checkered footer, and anything below it)
  // needs to shift down to make room — never paste over it.
  const footerStartRow = PLAYERS_BLOCK_START + builtBlocks * PLAYERS_BLOCK_HEIGHT;
  sheet.insertRowsBefore(footerStartRow, rowsToAdd);

  const templateRange = sheet.getRange(PLAYERS_BLOCK_START, 1, PLAYERS_BLOCK_HEIGHT, PLAYERS_LAST_COL);
  for (let i = builtBlocks + 1; i <= teamCount; i++) {
    const targetStartRow = PLAYERS_BLOCK_START + (i - 1) * PLAYERS_BLOCK_HEIGHT;
    const targetRange = sheet.getRange(targetStartRow, 1, PLAYERS_BLOCK_HEIGHT, PLAYERS_LAST_COL);
    templateRange.copyTo(targetRange);
  }

  props.setProperty(PLAYERS_BLOCKS_BUILT_PROP, String(teamCount));
}

function populatePlayersTab() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SIGNUPS_SHEET_NAME);
  if (!dataSheet || dataSheet.getLastRow() < 2) {
    ui.alert('No signup data found. Run "Sync Signups" first.');
    return;
  }
  const playersSheet = ss.getSheetByName(PLAYERS_SHEET_NAME);
  if (!playersSheet) {
    ui.alert(`Couldn't find a "${PLAYERS_SHEET_NAME}" tab.`);
    return;
  }

  const teamCount = dataSheet.getLastRow() - 1; // minus header row
  ensureTeamBlocks_(playersSheet, teamCount);

  for (let i = 1; i <= teamCount; i++) {
    const dataRow = i + 1;
    const r = PLAYERS_BLOCK_START + (i - 1) * PLAYERS_BLOCK_HEIGHT;

    playersSheet.getRange(`F${r}`).setFormula(`='${SIGNUPS_SHEET_NAME}'!B${dataRow}`);

    playersSheet.getRange(`AA${r + 1}`).setFormula(`=IMAGE('${SIGNUPS_SHEET_NAME}'!H${dataRow})`);
    playersSheet.getRange(`AG${r + 1}`).setFormula(
      `=IMAGE("https://flagcdn.com/w80/"&LOWER('${SIGNUPS_SHEET_NAME}'!G${dataRow})&".png")`
    );
    playersSheet.getRange(`AI${r + 1}`).setFormula(`='${SIGNUPS_SHEET_NAME}'!D${dataRow}`);
    playersSheet.getRange(`AG${r + 4}`).setFormula(
      `=IF('${SIGNUPS_SHEET_NAME}'!E${dataRow}="","","@"&'${SIGNUPS_SHEET_NAME}'!E${dataRow})`
    );
    playersSheet.getRange(`AO${r + 4}`).setFormula(`="#"&TEXT('${SIGNUPS_SHEET_NAME}'!J${dataRow},"#,##0")`);

    playersSheet.getRange(`AV${r + 1}`).setFormula(`=IMAGE('${SIGNUPS_SHEET_NAME}'!O${dataRow})`);
    playersSheet.getRange(`BB${r + 1}`).setFormula(
      `=IMAGE("https://flagcdn.com/w80/"&LOWER('${SIGNUPS_SHEET_NAME}'!N${dataRow})&".png")`
    );
    playersSheet.getRange(`BD${r + 1}`).setFormula(`='${SIGNUPS_SHEET_NAME}'!K${dataRow}`);
    playersSheet.getRange(`BB${r + 4}`).setFormula(
      `=IF('${SIGNUPS_SHEET_NAME}'!L${dataRow}="","","@"&'${SIGNUPS_SHEET_NAME}'!L${dataRow})`
    );
    playersSheet.getRange(`BJ${r + 4}`).setFormula(`="#"&TEXT('${SIGNUPS_SHEET_NAME}'!Q${dataRow},"#,##0")`);
  }

  ui.alert(`Populated ${teamCount} team blocks on the Players tab.`);
}

/* ======================================================================
 * Mappool, Qualifiers Schedule and Schedule sync
 * ----------------------------------------------------------------------
 * Tournament Tools > Sync Mappool / Sync Qualifiers Schedule / Sync Schedule
 * rebuild those tabs from Centaurea: one styled section per pool, day or
 * bracket week, newest bracket week first like the template.
 *
 * The first sync of a tab saves a hidden copy of it, "⚙ <tab> template".
 * Every section is built from that copy's first section (title, column
 * headers, rows, gap) plus its footer, so don't delete it; to restyle a
 * synced tab, unhide and edit the copy instead.
 *
 * - Mappool only reads released pools, and without your session, so an
 *   unreleased pool can never end up on the sheet (hidden tabs still come
 *   along when someone downloads the sheet).
 * - Schedule fills referees, streams and commentators from Centaurea's match
 *   staff when your session cookie works; otherwise, or when Centaurea has
 *   nobody for a match, it keeps whatever was typed into those columns.
 * - Times are shown in SCHEDULE_TIMEZONE.
 * - Centaurea only keeps nomod star ratings. HR/DT/EZ/HT stats are worked
 *   out here; for modded star ratings too, set osu! API credentials.
 * ==================================================================== */

// the timezone schedule dates and times are shown in
const SCHEDULE_TIMEZONE = 'UTC';

// Where each tab's sections are, in the template's rows. A section is
// headRows of title, gap and column headers, then data rows, then tailRows
// of gap; the footer is copied after the last section.
const SECTION_LAYOUTS = {
  'Mappool': {
    titleRow: 10,
    headRows: 4,
    header: ['D', 'BANNER'],
    templateRows: 10,
    tailRows: 2,
    footer: [52, 57]
  },
  'Qualifiers Schedule': {
    titleRow: 12,
    headRows: 6,
    header: ['D', 'ID'],
    templateRows: 10,
    tailRows: 1,
    footer: [63, 68]
  },
  'Schedule': {
    titleRow: 12,
    headRows: 6,
    header: ['D', 'ID'],
    templateRows: 10,
    tailRows: 1,
    footer: [72, 77]
  }
};

// the Schedule template's first three rows are styled for these
const ROW_STYLE = { UPPER: 0, LOWER: 1, POTENTIAL: 2 };

// Pool slots whose map on Centaurea isn't the one being played, like a
// tourney edit of a ranked map: "<pool name> <slot>" -> the osu! beatmap to
// show instead. Its name, banner and stats come from its osu! page; any
// other field given here (od, ar, cs, bpm, star_rating, length_seconds,
// difficulty...) is forced over what osu! says.
const SLOT_OVERRIDES = {
  'qualifiers NM1': { beatmapId: 5934198, od: 10 }
};

// lazer room ids are still in the millions, stable match ids passed 100 million
const LAZER_ROOM_ID_LIMIT = 50000000;

function syncMappool() { runSync_('Mappool', syncMappool_); }
function syncQualifiersSchedule() { runSync_('Qualifiers Schedule', syncQualifiersSchedule_); }
function syncSchedule() { runSync_('Schedule', syncSchedule_); }

function runSync_(label, sync) {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    ui.alert('Another sync is still running. Try again in a minute.');
    return;
  }
  try {
    ui.alert(sync());
  } catch (e) {
    ui.alert(`${label} sync failed: ${e.message}`);
  } finally {
    lock.releaseLock();
  }
}

// run by the time-driven trigger: no UI here, so results and errors go to
// the Apps Script "Executions" log
function autoSyncSchedules() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return;
  try {
    [syncQualifiersSchedule_, syncSchedule_].forEach(sync => {
      try {
        console.log(sync());
      } catch (e) {
        console.error(e);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function toggleScheduleAutoSync() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'autoSyncSchedules');
  if (triggers.length) {
    triggers.forEach(t => ScriptApp.deleteTrigger(t));
    ui.alert('Schedule auto-sync is off.');
    return;
  }
  ScriptApp.newTrigger('autoSyncSchedules').timeBased().everyMinutes(30).create();
  ui.alert('Schedule auto-sync is on: Qualifiers Schedule and Schedule refresh every 30 minutes.');
}

function syncMappool_() {
  const sections = mappoolSections_(requireEventId_());
  if (!sections.length) {
    return 'No mappools are released on Centaurea yet, so the Mappool tab was left as it is.';
  }
  rebuildSections_('Mappool', sections);
  return `Synced ${sections.length} mappool${sections.length === 1 ? '' : 's'}.`;
}

function syncQualifiersSchedule_() {
  const sections = qualifierScheduleSections_(requireEventId_());
  if (!sections.length) {
    return 'Centaurea has no qualifier lobbies yet, so the Qualifiers Schedule tab was left as it is.';
  }
  rebuildSections_('Qualifiers Schedule', sections);
  const lobbies = sections.reduce((n, s) => n + s.rows.length, 0);
  return `Synced ${lobbies} qualifier lobbies.`;
}

function syncSchedule_() {
  const eventId = requireEventId_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedule');
  const staff = matchStaff_(eventId);
  const sections = scheduleSections_(eventId, staff.byMatch, readTypedStaff_(sheet));
  if (!sections.length) {
    return 'No bracket matches have teams or times yet, so the Schedule tab was left as it is.';
  }
  rebuildSections_('Schedule', sections);
  const matches = sections.reduce((n, s) => n + s.rows.length, 0);
  return `Synced ${matches} matches.` + (staff.error
    ? `\n\nStaff couldn't be read from Centaurea (${staff.error}), so the referee, stream and commentator columns kept what was typed in.`
    : '');
}

function requireEventId_() {
  const eventId = PropertiesService.getScriptProperties().getProperty('EVENT_ID');
  if (!eventId) {
    throw new Error('No event ID saved. Run "Tournament Tools > Set API Credentials" first.');
  }
  return eventId;
}

// for public data: sends no session, so it only ever sees what everyone can
function publicGet_(path) {
  const resp = UrlFetchApp.fetch(`${API_BASE}${path}`, { muteHttpExceptions: true });
  const code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error(`Request to ${path} failed with HTTP ${code}: ${resp.getContentText().slice(0, 200)}`);
  }
  return JSON.parse(resp.getContentText());
}

// entrant id -> team name (or player name for solo entrants)
function entrantNames_(eventId) {
  const view = publicGet_(`/events/${eventId}/view`);
  const teamNames = {};
  (view.teams || []).forEach(t => { teamNames[t.id] = t.name; });
  const names = {};
  (view.roster || []).forEach(r => {
    names[r.entrant_id] = (r.team_id && teamNames[r.team_id]) || r.name;
  });
  return names;
}

// Centaurea user id -> username
function usernames_(userIds) {
  const ids = userIds.filter((id, i) => id && userIds.indexOf(id) === i);
  const names = {};
  for (let i = 0; i < ids.length; i += 50) {
    publicGet_(`/accounts/batch?ids=${ids.slice(i, i + 50).join(',')}`)
      .forEach(u => { names[u.id] = u.username; });
  }
  return names;
}

function dateLabel_(date) {
  // "Fri (Sept 3)", as the template writes it
  return Utilities.formatDate(date, SCHEDULE_TIMEZONE, 'EEE (MMM d)').replace('(Sep ', '(Sept ');
}

// the template's TIME cells hold a fraction of a day, formatted h:mm
function timeOfDay_(date) {
  const parts = Utilities.formatDate(date, SCHEDULE_TIMEZONE, 'H:m').split(':');
  return (Number(parts[0]) * 60 + Number(parts[1])) / 1440;
}

function mpLink_(mpId) {
  if (!mpId) return '';
  const url = Number(mpId) < LAZER_ROOM_ID_LIMIT
    ? `https://osu.ppy.sh/multiplayer/rooms/${mpId}`
    : `https://osu.ppy.sh/community/matches/${mpId}`;
  return `=HYPERLINK("${url}", ${Number(mpId)})`;
}

function columnNumber_(letters) {
  return letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function round_(value, digits) {
  if (typeof value !== 'number' || !isFinite(value)) return '';
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

/* ---------- Mappool ---------- */

function mappoolSections_(eventId) {
  const seen = {};
  const pools = publicGet_(`/events/${eventId}/mappools/public`)
    // a pool several rounds share is listed once per round
    .filter(p => !seen[p.mappool_id] && (seen[p.mappool_id] = true))
    // newest first, like the template
    .sort((a, b) => String(b.scheduled_at || '').localeCompare(String(a.scheduled_at || '')));

  return pools.map(pool => {
    const name = String(pool.mappool_name || pool.round_name || '');
    return {
      title: name.toUpperCase(),
      rows: pool.slots
        .slice()
        .sort(compareSlots_)
        .map(slot => ({ cells: mappoolCells_(overriddenSlot_(name, slot)) }))
    };
  });
}

// the slot with SLOT_OVERRIDES applied, if it has one
function overriddenSlot_(poolName, slot) {
  const key = `${poolName} ${slot.code}`.toLowerCase();
  const overrideKey = Object.keys(SLOT_OVERRIDES).filter(k => k.toLowerCase() === key)[0];
  if (!overrideKey) return slot;

  const override = Object.assign({}, SLOT_OVERRIDES[overrideKey]);
  const beatmapId = override.beatmapId || slot.beatmap_id;
  delete override.beatmapId;
  return Object.assign({}, slot, {
    beatmap_id: beatmapId,
    snapshot: Object.assign({}, slot.snapshot, osuBeatmap_(beatmapId), override)
  });
}

/**
 * A beatmap's data from its public osu! page, shaped like a Centaurea slot
 * snapshot; works for unranked uploads like tourney edits, no API key needed.
 * Empty if the page can't be read, so Centaurea's data stays.
 */
function osuBeatmap_(beatmapId) {
  const resp = UrlFetchApp.fetch(`https://osu.ppy.sh/beatmaps/${beatmapId}`, { muteHttpExceptions: true });
  const json = resp.getResponseCode() === 200 &&
    resp.getContentText().match(/<script id="json-beatmapset" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
  if (!json) return {};

  const set = JSON.parse(json[1]);
  const map = (set.beatmaps || []).filter(b => b.id === Number(beatmapId))[0];
  if (!map) return {};
  return {
    title: set.title,
    artist: set.artist,
    difficulty: map.version,
    beatmapset_id: set.id,
    star_rating: map.difficulty_rating,
    bpm: map.bpm,
    length_seconds: map.total_length,
    cs: map.cs,
    ar: map.ar,
    od: map.accuracy,
    hp: map.drain
  };
}

// the usual pool order: NM, HD, HR, DT, FM, TB, each by number
const MOD_ORDER = ['NM', 'HD', 'HR', 'DT', 'NC', 'EZ', 'HT', 'FL', 'FM', 'TB'];

function compareSlots_(a, b) {
  const modRank = slot => {
    const i = MOD_ORDER.indexOf(String(slot.game_mod).toUpperCase());
    return i === -1 ? MOD_ORDER.indexOf('TB') - 0.5 : i; // combos like HDHR go just before TB
  };
  const number = slot => Number((String(slot.code).match(/\d+$/) || [0])[0]);
  return modRank(a) - modRank(b) || number(a) - number(b) || a.position - b.position;
}

function mappoolCells_(slot) {
  const s = slot.snapshot || {};
  const mods = modsOf_(slot.game_mod);
  const stats = moddedStats_(s, mods);
  const stars = moddedStarRating_(slot.beatmap_id, mods) || s.star_rating;

  return {
    D: s.beatmapset_id
      ? `=IMAGE("https://assets.ppy.sh/beatmaps/${s.beatmapset_id}/covers/slimcover.jpg", 2)`
      : '',
    J: String(slot.code).toUpperCase(),
    O: mapNameCell_(slot.beatmap_id, `${s.artist} - ${s.title} [${s.difficulty}]`),
    AR: typeof stars === 'number' ? `✶ ${stars.toFixed(2)}` : '',
    AV: round_(stats.bpm, 0),
    // seconds / 1440 shows as m:ss in the template's h:mm format
    AZ: typeof stats.length === 'number' && isFinite(stats.length)
      ? Math.round(stats.length) / 1440
      : '',
    BD: round_(stats.cs, 2),
    BH: round_(stats.ar, 2),
    BL: round_(stats.od, 2),
    BP: slot.beatmap_id || ''
  };
}

// the map's name, linking to its osu! page; a HYPERLINK formula keeps the
// cell's own font and colour, unlike a pasted link
function mapNameCell_(beatmapId, name) {
  const text = name.replace(/"/g, '""');
  return beatmapId ? `=HYPERLINK("https://osu.ppy.sh/b/${beatmapId}", "${text}")` : name;
}

// "NM" -> ["NM"], "HDHR" -> ["HD", "HR"]
function modsOf_(gameMod) {
  return String(gameMod || '').toUpperCase().match(/[A-Z]{2}/g) || [];
}

function moddedStats_(s, mods) {
  const has = m => mods.indexOf(m) !== -1;
  let cs = s.cs, ar = s.ar, od = s.od;
  if (has('HR')) {
    cs = Math.min(cs * 1.3, 10);
    ar = Math.min(ar * 1.4, 10);
    od = Math.min(od * 1.4, 10);
  }
  if (has('EZ')) {
    cs /= 2;
    ar /= 2;
    od /= 2;
  }

  const rate = has('DT') || has('NC') ? 1.5 : has('HT') ? 0.75 : 1;
  if (rate !== 1) {
    // speed changes shrink the approach time and hit windows, so AR/OD move
    const arMs = (ar < 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5)) / rate;
    ar = arMs > 1200 ? (1800 - arMs) / 120 : 5 + (1200 - arMs) / 150;
    od = (80 - (80 - 6 * od) / rate) / 6;
  }

  return { cs: cs, ar: ar, od: od, bpm: s.bpm * rate, length: s.length_seconds / rate };
}

/* ---------- Qualifiers Schedule ---------- */

function qualifierScheduleSections_(eventId) {
  const lobbies = publicGet_(`/events/${eventId}/qualifier-lobbies`);
  const staff = publicGet_(`/events/${eventId}/qualifier-lobby-staff`);
  const teams = entrantNames_(eventId);
  const users = usernames_(staff.map(s => s.user_id));

  const referees = {};
  staff.filter(s => /ref/i.test(s.role)).forEach(s => {
    (referees[s.lobby_id] = referees[s.lobby_id] || []).push(users[s.user_id] || '?');
  });

  // one section per day, plus extra lobbies (ids like EX1, or X1 as in the
  // template) and any without a time yet
  const sections = [];
  const sectionFor = (key, title) => {
    let section = sections.filter(s => s.key === key)[0];
    if (!section) {
      section = { key: key, title: title, lobbies: [] };
      sections.push(section);
    }
    return section;
  };

  lobbies.forEach(lobby => {
    const id = String(lobby.name).replace(/^lobby\s*/i, '').toUpperCase();
    const date = lobby.scheduled_at ? new Date(lobby.scheduled_at) : null;
    const section = /^E?X/.test(id) || !date
      ? sectionFor('~extra', 'Extra Lobbies')
      : sectionFor(
        Utilities.formatDate(date, SCHEDULE_TIMEZONE, 'yyyy-MM-dd'),
        Utilities.formatDate(date, SCHEDULE_TIMEZONE, 'EEEE')
      );
    section.lobbies.push({ lobby: lobby, id: id, date: date });
  });

  // days in order, extra lobbies last
  sections.sort((a, b) => (a.key === '~extra') - (b.key === '~extra') || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  // two weeks of qualifiers would repeat a weekday, so date those titles
  sections.forEach(s => {
    if (s.key !== '~extra' && sections.filter(o => o.title === s.title).length > 1) {
      s.dated = true;
    }
  });

  return sections.map(section => ({
    title: section.dated
      ? `${section.title} (${dateLabel_(section.lobbies[0].date).replace(/^\w+ \(|\)$/g, '')})`
      : section.title,
    rows: section.lobbies
      .sort((a, b) => (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity) ||
        a.lobby.position - b.lobby.position)
      .map(({ lobby, id, date }) => ({
        cells: {
          D: id,
          H: date ? dateLabel_(date) : '',
          N: date ? timeOfDay_(date) : '',
          R: (referees[lobby.id] || []).join(', '),
          AD: lobby.entrant_ids.map(e => teams[e] || '?').join(' • '),
          BW: mpLink_(lobby.osu_mp_id)
        }
      }))
  }));
}

/* ---------- Schedule ---------- */

/**
 * Centaurea's match staff, grouped by match. Staff assignments aren't
 * public, so this needs the session cookie; when it can't be read the
 * Schedule keeps what was typed in.
 */
function matchStaff_(eventId) {
  let rows;
  try {
    rows = apiGet_(`/events/${eventId}/match-staff`);
  } catch (e) {
    return { byMatch: {}, error: e.message };
  }
  if (!Array.isArray(rows)) {
    return { byMatch: {}, error: 'unexpected response from /match-staff' };
  }

  const users = usernames_(rows.map(r => r.user_id));
  const byMatch = {};
  rows.forEach(r => {
    const staff = byMatch[r.match_id] = byMatch[r.match_id] || { referee: [], streamer: [], commentator: [] };
    const name = r.username || users[r.user_id] || '?';
    const role = String(r.role || '').toLowerCase();
    if (/ref/.test(role)) staff.referee.push(name);
    else if (/stream/.test(role)) staff.streamer.push(name);
    else if (/comm|cast/.test(role)) staff.commentator.push(name);
  });
  return { byMatch: byMatch, error: null };
}

// what's typed into the Schedule's staff columns, by match ID, so a sync
// doesn't wipe it when Centaurea has nobody for that match
function readTypedStaff_(sheet) {
  const typed = {};
  if (!sheet) return typed;

  const top = SECTION_LAYOUTS['Schedule'].titleRow;
  const count = sheet.getLastRow() - top + 1;
  if (count < 1) return typed;

  const column = letters => sheet.getRange(top, columnNumber_(letters), count, 1).getDisplayValues();
  const ids = column('D');
  const referees = column('R');
  const streams = column('BG');
  const commentators = column('BL');
  ids.forEach((id, i) => {
    if (id[0] && id[0] !== 'ID') {
      typed[id[0]] = { referee: referees[i][0], stream: streams[i][0], commentators: commentators[i][0] };
    }
  });
  return typed;
}

function scheduleSections_(eventId, staffByMatch, typedStaff) {
  const bracket = publicGet_(`/events/${eventId}/bracket`);
  const teams = entrantNames_(eventId);
  const sideOrder = { winners: 0, losers: 1, grand_finals: 2 };

  // rounds that share a mappool are played the same week
  const weeks = [];
  bracket.forEach(({ stage, rounds: stageRounds }) => {
    if (stage.format && stage.format.kind === 'qualifier') return;
    stageRounds.forEach(({ round, matches }) => {
      const key = round.mappool_id || round.id;
      let week = weeks.filter(w => w.key === key)[0];
      if (!week) {
        week = { key: key, stagePosition: stage.position, start: Infinity, firstRound: round.position, rounds: [], rows: [] };
        weeks.push(week);
      }
      week.rounds.push(Object.assign({}, round, { matches: matches }));
      // losers rounds often have no window of their own; the week's other rounds date it
      if (round.scheduled_at) week.start = Math.min(week.start, Date.parse(round.scheduled_at));
      week.firstRound = Math.min(week.firstRound, round.position);
    });
  });

  weeks.sort((a, b) =>
    a.stagePosition - b.stagePosition ||
    (a.start - b.start || 0) ||
    a.firstRound - b.firstRound);

  // match IDs number the bracket in play order (by week, upper bracket
  // first), so they stay put between syncs
  let number = 0;
  weeks.forEach((week, weekIndex) => {
    week.order = weekIndex;
    week.rounds.sort((a, b) =>
      (sideOrder[a.bracket_side] || 0) - (sideOrder[b.bracket_side] || 0) || a.position - b.position);
    week.rounds.forEach(round => {
      round.matches
        .slice()
        .sort((a, b) => a.position - b.position)
        .forEach(match => {
          number++;
          // nothing to show for a match nobody is in or has scheduled yet
          if (!match.entrant_a && !match.entrant_b && !match.scheduled_at) return;
          week.rows.push(scheduleRow_(String(number), round, match, teams,
            staffByMatch[match.id], typedStaff[String(number)]));
        });
    });
  });

  return weeks
    .filter(w => w.rows.length)
    // newest week first, like the template
    .sort((a, b) => b.order - a.order)
    .map(week => ({
      title: weekTitle_(week.rounds),
      rows: week.rows
        .sort((a, b) => a.sortTime - b.sortTime || a.number - b.number)
    }));
}

// a week is named after its upper bracket round, e.g. "SEMIFINALS"
function weekTitle_(rounds) {
  const named = rounds.filter(r => r.bracket_side !== 'losers')[0] || rounds[0];
  return String(named.name).toUpperCase();
}

function scheduleRow_(id, round, match, teams, staff, typed) {
  const date = match.scheduled_at ? new Date(match.scheduled_at) : null;
  const decided = match.entrant_a && match.entrant_b;
  staff = staff || { referee: [], streamer: [], commentator: [] };
  typed = typed || {};

  let scoreA = '', scoreB = '';
  if (match.state === 'forfeit') {
    const aWon = match.winner_entrant_id === match.entrant_a;
    scoreA = aWon ? 'W' : 'FF';
    scoreB = aWon ? 'FF' : 'W';
  } else if (match.state === 'completed' || match.state === 'live') {
    scoreA = match.score_a;
    scoreB = match.score_b;
  }

  return {
    number: Number(id),
    sortTime: date ? date.getTime() : Infinity,
    style: !decided ? ROW_STYLE.POTENTIAL
      : round.bracket_side === 'losers' ? ROW_STYLE.LOWER
        : ROW_STYLE.UPPER,
    cells: {
      D: id,
      H: date ? dateLabel_(date) : '',
      N: date ? timeOfDay_(date) : '',
      R: staff.referee.length ? staff.referee.join(', ') : typed.referee || '',
      AD: match.entrant_a ? teams[match.entrant_a] || '?' : 'TBD',
      AP: scoreA,
      AR: scoreB,
      AU: match.entrant_b ? teams[match.entrant_b] || '?' : 'TBD',
      BG: staff.streamer.length ? '✢' : typed.stream || '',
      BL: staff.commentator.length ? staff.commentator.join(', ') : typed.commentators || '',
      BW: mpLink_(match.osu_mp_id)
    }
  };
}

/* ---------- building the sections ---------- */

/**
 * Rebuilds a tab's sections from its hidden template copy. sections is
 * [{ title, rows: [{ style, cells: { D: value, ... } }] }]; style picks
 * which of the template's first data rows a row is styled like.
 */
function rebuildSections_(sheetName, sections) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Couldn't find a "${sheetName}" tab.`);

  const layout = SECTION_LAYOUTS[sheetName];
  const template = templateSheet_(ss, sheet, layout);
  const width = template.getMaxColumns();
  const templateData = layout.titleRow + layout.headRows;
  const templateTail = templateData + layout.templateRows;
  const footerStart = layout.footer[0];
  const footerRows = layout.footer[1] - layout.footer[0] + 1;

  const needed = sections.reduce(
    (n, s) => n + layout.headRows + s.rows.length + layout.tailRows, 0) + footerRows;

  // everything from the first section down gets rebuilt
  sheet.insertRowsAfter(sheet.getMaxRows(), needed);
  sheet.deleteRows(layout.titleRow, sheet.getMaxRows() - layout.titleRow + 1 - needed);
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }

  let row = layout.titleRow;
  sections.forEach(section => {
    copyRows_(template, layout.titleRow, sheet, row, layout.headRows, width);
    sheet.getRange(row, columnNumber_('B')).setValue(section.title);
    row += layout.headRows;

    section.rows.forEach((r, i) => {
      copyRows_(template, templateData + (r.style || 0), sheet, row + i, 1, width);
    });
    // the template rows carry placeholder text
    sheet.getRange(row, 1, section.rows.length, width).clearContent();
    writeCells_(sheet, row, section.rows);
    row += section.rows.length;

    copyRows_(template, templateTail, sheet, row, layout.tailRows, width);
    row += layout.tailRows;
  });
  copyRows_(template, footerStart, sheet, row, footerRows, width);
}

// the tab as it first was, kept hidden so its styles survive every rebuild
function templateSheet_(ss, sheet, layout) {
  const name = `⚙ ${sheet.getName()} template`;
  let template = ss.getSheetByName(name);
  if (template) return template;

  const headerRow = layout.titleRow + layout.headRows - 2;
  const headerCell = `${layout.header[0]}${headerRow}`;
  if (String(sheet.getRange(headerCell).getValue()).trim().toUpperCase() !== layout.header[1]) {
    throw new Error(
      `"${sheet.getName()}" doesn't look like its original layout (no ${layout.header[1]} header in ` +
      `${headerCell}), so it can't be saved as the template. Restore the original tab and sync again.`
    );
  }
  template = sheet.copyTo(ss).setName(name);
  template.hideSheet();
  return template;
}

// copies rows with their values, formats, merges and heights
function copyRows_(from, fromRow, to, toRow, count, width) {
  from.getRange(fromRow, 1, count, width).copyTo(to.getRange(toRow, 1, count, width));
  for (let i = 0; i < count; i++) {
    to.setRowHeight(toRow + i, from.getRowHeight(fromRow + i));
  }
}

// writes each column's values in one go; merged cells take their value in
// their first column, which is the letter used here
function writeCells_(sheet, firstRow, rows) {
  const columns = [];
  rows.forEach(r => Object.keys(r.cells).forEach(c => {
    if (columns.indexOf(c) === -1) columns.push(c);
  }));
  columns.forEach(c => {
    sheet.getRange(firstRow, columnNumber_(c), rows.length, 1)
      .setValues(rows.map(r => [c in r.cells ? r.cells[c] : '']));
  });
}

/* ---------- optional: modded star ratings from the osu! API ---------- */

function setOsuCredentials() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  ui.alert(
    'osu! API credentials',
    'Optional: lets Sync Mappool show star ratings with HR/DT applied.\n\n' +
    'Create an OAuth application at osu.ppy.sh > Settings > OAuth (any callback URL), ' +
    'then paste its Client ID and Client Secret.',
    ui.ButtonSet.OK
  );

  const idResp = ui.prompt('Client ID', 'osu! OAuth Client ID:', ui.ButtonSet.OK_CANCEL);
  if (idResp.getSelectedButton() !== ui.Button.OK) return;
  const secretResp = ui.prompt('Client Secret', 'osu! OAuth Client Secret:', ui.ButtonSet.OK_CANCEL);
  if (secretResp.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('OSU_CLIENT_ID', idResp.getResponseText().trim());
  props.setProperty('OSU_CLIENT_SECRET', secretResp.getResponseText().trim());
  CacheService.getScriptCache().remove('OSU_TOKEN');
  ui.alert('Saved. Sync Mappool will now use modded star ratings.');
}

function osuToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('OSU_TOKEN');
  if (cached) return cached;

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('OSU_CLIENT_ID');
  const clientSecret = props.getProperty('OSU_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const resp = UrlFetchApp.fetch('https://osu.ppy.sh/oauth/token', {
    method: 'post',
    payload: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'public'
    },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error(`osu! API login failed (HTTP ${resp.getResponseCode()}). Check "Set osu! API Credentials".`);
  }
  const body = JSON.parse(resp.getContentText());
  cache.put('OSU_TOKEN', body.access_token, Math.min(body.expires_in - 60, 21600));
  return body.access_token;
}

// null when nothing changes the star rating or no osu! credentials are set
function moddedStarRating_(beatmapId, mods) {
  const relevant = mods.filter(m => ['HR', 'DT', 'NC', 'EZ', 'HT', 'FL'].indexOf(m) !== -1);
  if (!beatmapId || !relevant.length) return null;
  const token = osuToken_();
  if (!token) return null;

  const resp = UrlFetchApp.fetch(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}/attributes`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ mods: relevant, ruleset: 'osu' }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) return null;
  return JSON.parse(resp.getContentText()).attributes.star_rating;
}
