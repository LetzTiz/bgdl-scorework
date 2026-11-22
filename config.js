/* ==========================================================================
   Beans GD League – settings
   This is the only file you normally need to edit.
   Used by the standings page (index.html) and the overlay (overlay.html).
   ========================================================================== */
const CONFIG = {
  league: 'Beans GD League',
  season: 'Season 1',

  // The league sheet, shared as "Anyone with the link can view"
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1H9UdxPvqrMS4PJN4SuOL_vHmykWcI0OvF8t0Jd6uZXI/edit?usp=sharing',

  // Tabs in the sheet
  teamsTab:  'Teams',   // # | Team name | Manager / Captain | Logo (which still needs to be imported in this sheet cause Google Sheets is a bitch) | ... 
  rosterTab: 'Roster',  // Team | Slot | Player | Country | Hardest | Price (orbs) | Bought on

  // One schedule tab per division.
  // Columns: No. | Match day | Date | Team A | Team B | Level 1 | Level 2 | Points A | Points B | Winner | Played
  // A match is finished when "Played" is 1. Points filled in while "Played" is still 0 = live.
  divisions: [
    { id: 'gold', name: 'Gold League', tab: 'Schedule Gold',
      zones: [
        { from: 'top',    count: 1, kind: 'prize', label: 'Prize' },
        { from: 'bottom', count: 3, kind: 'down',  label: 'Relegated to Silver League' },
      ] },
    { id: 'silver', name: 'Silver League', tab: 'Schedule Silver',
      zones: [
        { from: 'top', count: 3, kind: 'up', label: 'Promoted to Gold League' },
      ] },
  ],

  // How often the page reloads the sheet
  refreshSeconds: 60,

  // Team logos. Google Sheets does not export pictures placed inside cells. put image files in this folder, named like the team in lower case with dashes:
  //     "Requiem Aeternam" -> logos/requiem-aeternam.png
  logoFolder: 'logos/',
};
