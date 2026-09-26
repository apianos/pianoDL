// ==========================================
// CONFIGURATION
// ==========================================
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1535295757459132506/4UMPeAWxLMEYJcoyfyDYmtP8Y210CL2KyGbnYW3vIOlBbxHNqM5pnUd4sGrcETNUNnlU';
const SHEET_NAME = 'piano achievement list'; // Main achievement list tab
const CHANGELOG_SHEET_NAME = 'changelog';    // Dedicated website changelog tab

/**
 * Initializes/resets the saved snapshot to match the current sheet.
 * Run this ONCE when you first set up the script!
 */
function setup() {
  const currentState = getCurrentState();
  PropertiesService.getScriptProperties().setProperty('DEMONLIST_SNAPSHOT', JSON.stringify(currentState));
  SpreadsheetApp.getUi().alert('Demonlist snapshot initialized successfully!');
}

/**
 * Custom Menu added to Google Sheets UI for manual checks.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Demonlist Webhook')
    .addItem('Check for Changes & Send Notifications', 'checkForChanges')
    .addItem('Reset Baseline Snapshot', 'setup')
    .addToUi();
}

/**
 * Helper to determine achievement type: NEW_RUN, NEW_VERIFICATION, or NEW_VICTOR
 */
function determineAchievementType(newItem, oldState) {
  const name = newItem.name.trim();

  // Check if level name contains a progress percentage (e.g., "38%", "67-100%")
  const isPercentageRun = /[\d]+(-[\d]+)?%/.test(name);
  if (isPercentageRun) {
    return "NEW_RUN";
  }

  // Extract base level name by stripping any trailing progress markers
  const baseLevelName = name.replace(/\s*[\d]+(-[\d]+)?%/, "").trim().toLowerCase();

  // Check if this base level existed previously in the old snapshot
  const existsInOldState = oldState.some(item => {
    const oldBaseName = item.name.replace(/\s*[\d]+(-[\d]+)?%/, "").trim().toLowerCase();
    return oldBaseName === baseLevelName;
  });

  return existsInOldState ? "NEW_VICTOR" : "NEW_VERIFICATION";
}

/**
 * Main function that compares current state against snapshot,
 * logs changes to the sheet's 'changelog' tab, and sends Discord webhooks.
 */
function checkForChanges() {
  const propService = PropertiesService.getScriptProperties();
  const rawSnapshot = propService.getProperty('DEMONLIST_SNAPSHOT');
  
  if (!rawSnapshot) {
    SpreadsheetApp.getUi().alert('No baseline snapshot found! Please run "Reset Baseline Snapshot" first.');
    return;
  }

  const oldState = JSON.parse(rawSnapshot);
  const newState = getCurrentState();

  const oldMap = new Map(oldState.map(item => [item.id, item]));
  const newMap = new Map(newState.map(item => [item.id, item]));

  const added = [];
  const removed = [];
  const markedOld = [];

  // Detect New, Removed, and Status -> OLD
  for (const newItem of newState) {
    if (!oldMap.has(newItem.id)) {
      added.push(newItem);
    } else {
      const oldItem = oldMap.get(newItem.id);
      if (oldItem.status !== 'OLD' && newItem.status === 'OLD') {
        markedOld.push(newItem);
      }
    }
  }

  for (const oldItem of oldState) {
    if (!newMap.has(oldItem.id)) {
      removed.push(oldItem);
    }
  }

  // Detect Rank Reordering using Longest Common Subsequence (LCS)
  const oldActiveList = oldState.filter(i => i.status !== 'OLD' && !removed.some(r => r.id === i.id) && !markedOld.some(m => m.id === i.id));
  const newActiveList = newState.filter(i => i.status !== 'OLD' && !added.some(a => a.id === i.id));

  const lcs = getLCS(oldActiveList.map(i => i.id), newActiveList.map(i => i.id));
  const lcsSet = new Set(lcs);

  const moved = newActiveList.filter(item => !lcsSet.has(item.id)).map(newItem => {
    const oldItem = oldMap.get(newItem.id);
    return {
      item: newItem,
      oldRank: oldItem ? oldItem.rank : 'N/A',
      newRank: newItem.rank
    };
  });

  let updatesCount = 0;
  const now = new Date().toISOString();

  // 1. Process Added Entries (NEW_VERIFICATION, NEW_VICTOR, NEW_RUN)
  added.forEach(item => {
    const placementText = item.status === 'OLD' ? 'OLD' : `#${item.rank}`;
    const achievementType = determineAchievementType(item, oldState);

    let embedTitle = "";
    let embedColor = 3066993; // Default Green

    if (achievementType === "NEW_VERIFICATION") {
      embedTitle = "🏆 New Verification!";
      embedColor = 10181046; // Purple
    } else if (achievementType === "NEW_VICTOR") {
      embedTitle = "🎉 New Victor!";
      embedColor = 3066993;  // Green
    } else {
      embedTitle = "📈 New Run Added!";
      embedColor = 3447003;  // Blue
    }

    // Log to Sheet Changelog
    appendToChangelogSheet([now, achievementType, item.player, item.name, placementText, item.difficulty || "N/A", item.video || ""]);

    // Send Discord Notification
    sendDiscordEmbed({
      title: embedTitle,
      color: embedColor,
      fields: [
        { name: "Player", value: item.player, inline: true },
        { name: "Level / Run", value: item.name, inline: true },
        { name: "Placement", value: placementText, inline: true },
        { name: "Difficulty", value: item.difficulty || "N/A", inline: true },
        { name: "Video", value: item.video ? `[Watch Run](${item.video})` : "No link", inline: false }
      ]
    });
    updatesCount++;
  });

  // 2. Process Marked OLD
  markedOld.forEach(item => {
    // Log to Sheet Changelog
    appendToChangelogSheet([now, "SUPERSEDED", item.player, item.name, "OLD", item.difficulty || "N/A", item.video || ""]);

    // Send Discord Notification
    sendDiscordEmbed({
      title: "📦 Achievement Marked as OLD",
      color: 15105570, // Orange
      fields: [
        { name: "Player", value: item.player, inline: true },
        { name: "Level / Run", value: item.name, inline: true },
        { name: "Note", value: "Superseded by a better run!", inline: false }
      ]
    });
    updatesCount++;
  });

  // 3. Process Moved / Reordered
  moved.forEach(m => {
    const direction = Number(m.newRank) < Number(m.oldRank) ? "⬆️ Moved Up" : "⬇️ Moved Down";
    const rankChange = `#${m.oldRank} ➔ #${m.newRank}`;

    // Log to Sheet Changelog
    appendToChangelogSheet([now, "RANK_CHANGE", m.item.player, m.item.name, rankChange, m.item.difficulty || "N/A", m.item.video || ""]);

    // Send Discord Notification
    sendDiscordEmbed({
      title: `${direction} on the List!`,
      color: 15844367, // Gold
      fields: [
        { name: "Player", value: m.item.player, inline: true },
        { name: "Level / Run", value: m.item.name, inline: true },
        { name: "Rank Change", value: `#${m.oldRank} ➔ **#${m.newRank}**`, inline: true }
      ]
    });
    updatesCount++;
  });

  // 4. Process Removed
  removed.forEach(item => {
    // Log to Sheet Changelog
    appendToChangelogSheet([now, "REMOVED", item.player, item.name, "Removed", item.difficulty || "N/A", item.video || ""]);

    // Send Discord Notification
    sendDiscordEmbed({
      title: "🗑️ Achievement Removed",
      color: 15158332, // Red
      fields: [
        { name: "Player", value: item.player, inline: true },
        { name: "Level / Run", value: item.name, inline: true }
      ]
    });
    updatesCount++;
  });

  // Save new state if updates occurred
  if (updatesCount > 0) {
    propService.setProperty('DEMONLIST_SNAPSHOT', JSON.stringify(newState));
  }
}

/**
 * Appends a record to the dedicated 'changelog' tab.
 * Creates the sheet and header row if it doesn't exist yet.
 */
function appendToChangelogSheet(rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let changelogSheet = ss.getSheetByName(CHANGELOG_SHEET_NAME);

  if (!changelogSheet) {
    changelogSheet = ss.insertSheet(CHANGELOG_SHEET_NAME);
    changelogSheet.appendRow(["Timestamp", "Type", "Player", "Level/Run", "Details/Rank", "Difficulty", "Video"]);
  }

  changelogSheet.appendRow(rowData);
}

/**
 * Helper to extract raw data from the sheet.
 */
function getCurrentState() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const state = [];

  // Skip header row (row index 0)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rank = row[0];        // Column A (#)
    const name = row[1];        // Column B (Name)
    const player = row[3];      // Column D (Player)
    const status = (row[4] || "").toString().trim().toUpperCase(); // Column E (Status / OLD)
    const video = row[6];       // Column G (Player Video)
    const difficulty = row[7];  // Column H (Difficulty)

    if (!name || !player) continue;

    // Unique ID combining player, name, and video link
    const id = `${player.toString().trim()}|${name.toString().trim()}|${(video || "").toString().trim()}`.toLowerCase();

    state.push({
      id: id,
      rank: rank,
      name: name,
      player: player,
      status: status,
      video: video,
      difficulty: difficulty
    });
  }

  return state;
}

/**
 * Longest Common Subsequence (LCS) implementation.
 */
function getLCS(seq1, seq2) {
  const m = seq1.length;
  const n = seq2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (seq1[i] === seq2[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lcs = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (seq1[i - 1] === seq2[j - 1]) {
      lcs.push(seq1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs.reverse();
}

/**
 * Helper to post messages to Discord Webhook.
 */
function sendDiscordEmbed(embed) {
  const payload = {
    embeds: [embed]
  };

  UrlFetchApp.fetch(DISCORD_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}