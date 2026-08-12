import { store } from '../main.js';
import Spinner from '../components/Spinner.js';
import Sidebar from '../components/List/Sidebar.js';
import { fetchEditors } from '../content.js';
import { fetchCsvPrefer } from '../util.js';

const statsCsvPath = '/data/achievement_leaderboard (1).csv';
const achievementCsvPath = '/data/pianoDL - piano achievement list (30).csv';
const remoteAchievementCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=702241830&single=true&output=csv';
const remoteStatsCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=1658804691&single=true&output=csv';

function parseCsv(text, delimiter = ',') {
    const rows = [];
    let row = [];
    let field = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (insideQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    insideQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            insideQuotes = true;
            continue;
        }

        if (char === delimiter) {
            row.push(field.trim());
            field = '';
            continue;
        }

        if (char === '\r') {
            continue;
        }

        if (char === '\n') {
            row.push(field.trim());
            rows.push(row);
            row = [];
            field = '';
            continue;
        }

        field += char;
    }

    row.push(field.trim());
    if (row.length > 1 || row[0] !== '') {
        rows.push(row);
    }

    return rows;
}

function normalizePlayerName(value = '') {
    return (value || '').trim().toLowerCase();
}

function containsPercentLabel(value = '') {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return false;
    }

    return /(\d{1,3}%|\d{1,3}\s*(?:-|–)\s*\d{1,3}%?|\d{1,3}%\s*\+\s*\d{1,3}\s*(?:-|–)\s*\d{1,3}%?)/i.test(trimmed);
}

function sortByDate(a, b) {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateA - dateB;
}

function isOldEntry(entry = {}) {
    return String(entry.rank || '').trim().toUpperCase() === 'OLD';
}

function dedupeEntries(entries = []) {
    const seen = new Set();
    return entries.filter((entry) => {
        const key = `${(entry.name || '').trim().toLowerCase()}|${entry.date || ''}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export default {
    components: { Spinner, Sidebar },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list page-list--stats">
            <div class="list-container">
                <div class="level stats-sidebar">
                    <h1>Stats Viewer</h1>
                    <p class="type-body stats-intro">Players ranked by achievement completions. Point calculation by ferrari216</p>
                    <table class="records stats-list-table" v-if="entries.length > 0">
                        <tr>
                            <th class="rank"><p class="type-title-sm">Rank</p></th>
                            <th class="user"><p class="type-title-sm">Player</p></th>
                            <th class="percent"><p class="type-title-sm">Points</p></th>
                        </tr>
                        <tr v-for="entry in entries" :key="entry.username + entry.rank">
                            <td class="percent">
                                <p>#{{ entry.rank }}</p>
                            </td>
                            <td class="user">
                                <button class="stats-player-button" @click="selectedPlayerName = entry.username">
                                    <span class="type-label-md">{{ entry.username || 'Unknown' }}</span>
                                </button>
                            </td>
                            <td class="percent">
                                <p>{{ entry.points || '0' }}</p>
                            </td>
                        </tr>
                    </table>
                    <p v-else>No leaderboard data was loaded.</p>
                </div>
            </div>
            <div class="level-container">
                <div class="level" v-if="selectedPlayer">
                    <h1>{{ selectedPlayer.username || 'Unknown' }}</h1>
                    <div class="level-authors">
                        <div class="type-title-sm">Stats Rank</div>
                        <p class="type-body"><span>#{{ selectedPlayer.rank || 'Unknown' }}</span></p>

                        <div class="type-title-sm">Points</div>
                        <p class="type-body"><span>{{ selectedPlayer.points || '0' }}</span></p>
                    </div>
                    <div class="stats-detail-sections" v-if="selectedPlayer.details">
                        <div class="stats-detail-section">
                            <h3 class="type-title-sm">Levels Completed</h3>
                            <ul v-if="selectedPlayer.details.completedLevels.length > 0" class="stats-detail-list">
                                <li v-for="item in selectedPlayer.details.completedLevels" :key="item.name + item.date" class="stats-detail-item">
                                    <div class="stats-detail-copy">
                                        <a
                                            v-if="item.video"
                                            class="stats-detail-link"
                                            :href="item.video"
                                            target="_blank"
                                            rel="noreferrer noopener"
                                        >
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.rank }}</span>
                                        </a>
                                        <div v-else class="stats-detail-link stats-detail-link--text">
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.rank }}</span>
                                        </div>
                                    </div>
                                    <p class="type-label-sm stats-detail-date" v-if="item.date">{{ item.date }}</p>
                                </li>
                            </ul>
                            <p v-else>No completed levels listed.</p>
                        </div>
                        <div class="stats-detail-section">
                            <h3 class="type-title-sm">Levels Verified</h3>
                            <ul v-if="selectedPlayer.details.verifiedLevels.length > 0" class="stats-detail-list">
                                <li v-for="item in selectedPlayer.details.verifiedLevels" :key="item.name + item.date" class="stats-detail-item">
                                    <div class="stats-detail-copy">
                                        <a
                                            v-if="item.video"
                                            class="stats-detail-link"
                                            :href="item.video"
                                            target="_blank"
                                            rel="noreferrer noopener"
                                        >
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.verified ? item.verifiedRank || item.rank : item.rank }}</span>
                                        </a>
                                        <div v-else class="stats-detail-link stats-detail-link--text">
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.verified ? item.verifiedRank || item.rank : item.rank }}</span>
                                        </div>
                                    </div>
                                    <p class="type-label-sm stats-detail-date" v-if="item.date">{{ item.date }}</p>
                                </li>
                            </ul>
                            <p v-else>No verified levels listed.</p>
                        </div>
                        <div class="stats-detail-section">
                            <h3 class="type-title-sm">Runs</h3>
                            <ul v-if="selectedPlayer.details.runs.length > 0" class="stats-detail-list">
                                <li v-for="item in selectedPlayer.details.runs" :key="item.name + item.date" class="stats-detail-item">
                                    <div class="stats-detail-copy">
                                        <a
                                            v-if="item.video"
                                            class="stats-detail-link"
                                            :href="item.video"
                                            target="_blank"
                                            rel="noreferrer noopener"
                                        >
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.rank }}</span>
                                        </a>
                                        <div v-else class="stats-detail-link stats-detail-link--text">
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.rank }}</span>
                                        </div>
                                    </div>
                                    <p class="type-label-sm stats-detail-date" v-if="item.date">{{ item.date }}</p>
                                </li>
                            </ul>
                            <p v-else>No runs listed.</p>
                        </div>
                    </div>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>Select a player from the list to view their stats.</p>
                </div>
            </div>
            <Sidebar :editors="editors">
                <p class="error" v-for="error of errors" :key="error">{{ error }}</p>
            </Sidebar>
        </main>
    `,
    data: () => ({
        loading: true,
        entries: [],
        selectedPlayerName: '',
        editors: [],
        errors: [],
        store,
    }),
    computed: {
        selectedPlayer() {
            return this.entries.find((entry) => entry.username === this.selectedPlayerName) || this.entries[0] || null;
        },
    },
    async mounted() {
        try {
            const [editors] = await Promise.all([fetchEditors()]);
            this.editors = editors || [];

            // Load leaderboard CSV: prefer remote published sheet, fallback to local copy
            const statsTextPromise = fetchCsvPrefer(remoteStatsCsv, statsCsvPath);
            // Try remote published Google Sheets CSV for achievements, fall back to local file
            const achievementTextPromise = fetchCsvPrefer(remoteAchievementCsv, achievementCsvPath);

            const [statsText, achievementText] = await Promise.all([statsTextPromise, achievementTextPromise]);

            const statsRows = parseCsv(statsText);
            let achievementRows = parseCsv(achievementText);

            // Validate achievement CSV header looks like the achievement list (not the leaderboard)
            const achievementHeader = (achievementRows[0] || []).join(' ').toLowerCase();
            if (!achievementHeader.includes('name') && !achievementHeader.includes('#') && !achievementHeader.includes('player video')) {
                // remote CSV likely pointed to the leaderboard; fallback to local copy
                try {
                    const localResp = await fetch(achievementCsvPath);
                    if (localResp && localResp.ok) {
                        const localText = await localResp.text();
                        achievementRows = parseCsv(localText);
                    } else {
                        console.warn('StatsViewer: achievement CSV header mismatch and local fetch failed', localResp && localResp.status);
                    }
                } catch (err) {
                    console.warn('StatsViewer: local achievement fetch failed', err && err.message);
                }
            }

            const leaderboardEntries = statsRows.slice(1)
                .map((row) => {
                    const [rankValue, username, pointsValue] = row;
                    const rank = Number((rankValue || '').toString().replace(/[, ]+/g, '')) || 0;
                    const points = Number((pointsValue || '').toString().replace(/[, ]+/g, '')) || 0;

                    return {
                        rank: rank,
                        username: (username || '').trim(),
                        points: points,
                        details: null,
                    };
                })
                .filter((entry) => entry.username !== '')
                .sort((a, b) => a.rank - b.rank);

            const verifiedListRanks = new Map();
            let verifiedRankIndex = 0;
            achievementRows.slice(1).forEach((row) => {
                const [, name, , , , , , , verifierValue] = row;
                if ((verifierValue || '').trim().toLowerCase() === 'y') {
                    verifiedRankIndex += 1;
                    verifiedListRanks.set(normalizePlayerName(name), verifiedRankIndex);
                }
            });

            const playerProfiles = new Map();
            achievementRows.slice(1).forEach((row, index) => {
                const [rankValue, name, notes, playerName, , date, video, difficulty, verifierValue] = row;
                const normalizedName = normalizePlayerName(playerName);
                const isLevelCompletion = !containsPercentLabel(name);
                const isVerified = (verifierValue || '').trim().toLowerCase() === 'y';

                if (!playerProfiles.has(normalizedName)) {
                    playerProfiles.set(normalizedName, {
                        username: playerName || 'Unknown',
                        completedLevels: [],
                        verifiedLevels: [],
                        runs: [],
                    });
                }

                const profile = playerProfiles.get(normalizedName);
                const entry = {
                    id: index,
                    rank: rankValue || '',
                    name: name || '',
                    notes,
                    player: playerName || '',
                    date,
                    video,
                    difficulty,
                    verified: isVerified,
                    achievementRank: rankValue || '',
                    verifiedRank: null,
                };

                if (isOldEntry(entry)) {
                    return;
                }

                if (isLevelCompletion) {
                    profile.completedLevels.push(entry);
                    if (isVerified) {
                        const verifiedName = normalizePlayerName(name);
                        profile.verifiedLevels.push({
                            ...entry,
                            verifiedRank: verifiedListRanks.get(verifiedName) || null,
                        });
                    }
                } else {
                    profile.runs.push(entry);
                }
            });

            this.entries = leaderboardEntries.map((entry) => {
                const normalizedName = normalizePlayerName(entry.username);
                const details = playerProfiles.get(normalizedName);
                return {
                    ...entry,
                    details: details ? {
                        ...details,
                        completedLevels: dedupeEntries(details.completedLevels).sort(sortByDate),
                        verifiedLevels: dedupeEntries(details.verifiedLevels).sort(sortByDate),
                        runs: dedupeEntries(details.runs).sort(sortByDate),
                    } : {
                        username: entry.username,
                        completedLevels: [],
                        verifiedLevels: [],
                        runs: [],
                    },
                };
            });

            if (this.entries.length > 0) {
                this.selectedPlayerName = this.entries[0].username;
            }
        } catch (error) {
            console.error('Failed to load stats viewer:', error);
            this.errors.push('Failed to load stats viewer. Retry in a few minutes or notify list staff.');
        } finally {
            this.loading = false;
        }
    },
};
