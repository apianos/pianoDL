import { store } from '../main.js';
import Spinner from '../components/Spinner.js';
import Sidebar from '../components/List/Sidebar.js';
import { fetchEditors } from '../content.js';
import { fetchCsvPrefer, slugify, assignSlugsAndHashes } from '../util.js';

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
    const rank = String(entry.rank || '').trim().toUpperCase();
    const tag = String(entry.tag || '').trim().toUpperCase();
    return (
        rank === 'OLD' ||
        rank === 'PAST' ||
        rank.startsWith('OLD') ||
        rank.startsWith('PAST') ||
        tag === 'OLD' ||
        tag === 'PAST'
    );
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
                                <button class="stats-player-button" @click="selectPlayer(entry)">
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
                                        <router-link
                                            v-if="item.slug"
                                            class="stats-detail-link"
                                            :to="'/achievement-list/' + item.slug"
                                        >
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.rank }}</span>
                                        </router-link>
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
                                        <router-link
                                            v-if="item.verifiedSlug || item.slug"
                                            class="stats-detail-link"
                                            :to="'/verified-list/' + (item.verifiedSlug || item.slug)"
                                        >
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.verifiedRank || item.rank">#{{ item.verifiedRank || item.rank }}</span>
                                        </router-link>
                                        <div v-else class="stats-detail-link stats-detail-link--text">
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.verifiedRank || item.rank">#{{ item.verifiedRank || item.rank }}</span>
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
                                        <router-link
                                            v-if="item.slug"
                                            class="stats-detail-link"
                                            :to="'/achievement-list/' + item.slug"
                                        >
                                            <span class="type-label-md">{{ item.name || 'Unknown' }}</span>
                                            <span class="stats-detail-rank" v-if="item.rank">#{{ item.rank }}</span>
                                        </router-link>
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
        selectedPlayerSlug: '',
        editors: [],
        errors: [],
        store,
    }),
    watch: {
        '$route.params.player'(playerSlug) {
            if (!this.entries.length) return;
            if (!this.selectPlayerByParam(playerSlug)) {
                this.selectPlayer(this.entries[0]);
            }
        },
    },
    methods: {
        selectPlayer(entry) {
            if (!entry) return;
            this.selectedPlayerSlug = entry.slug;
            if (this.$route.params.player !== entry.slug) {
                this.$router.replace({ path: `/stats-viewer/${entry.slug}` }).catch(() => {});
            }
        },
        selectPlayerByParam(param) {
            if (!param) return false;
            const query = String(param).trim().toLowerCase();
            const entry = this.entries.find((item) => item.slug.toLowerCase() === query)
                || this.entries.find((item) => String(item.rank) === query);
            if (!entry) return false;
            this.selectPlayer(entry);
            return true;
        },
    },
    computed: {
        selectedPlayer() {
            return this.entries.find((entry) => entry.slug === this.selectedPlayerSlug) || this.entries[0] || null;
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

            const [header, ...dataRows] = achievementRows;
            const headers = (header || []).map((col) => col.trim());

            const getColVal = (values, row, possibleKeys, defaultIndex) => {
                for (const k of possibleKeys) {
                    const foundKey = Object.keys(values).find(
                        (key) => key.trim().toLowerCase().replace(/\?/g, '') === k.toLowerCase().replace(/\?/g, '')
                    );
                    if (foundKey && values[foundKey] !== undefined && values[foundKey] !== '') {
                        return values[foundKey];
                    }
                }
                if (defaultIndex !== undefined && row[defaultIndex] !== undefined) {
                    return row[defaultIndex].trim();
                }
                return '';
            };

            const parsedAchievementEntries = dataRows
                .map((row, index) => {
                    const values = headers.reduce((acc, key, colIndex) => {
                        acc[key] = row[colIndex] ? row[colIndex].trim() : '';
                        return acc;
                    }, {});

                    const rawRank = getColVal(values, row, ['#', 'rank', 'x', 'id'], 0);
                    const tagValue = getColVal(values, row, ['column 1', 'tag', 'old', 'type', ''], 4);
                    const isOld = isOldEntry({ rank: rawRank, tag: tagValue });
                    const name = getColVal(values, row, ['name'], 1);
                    const notes = getColVal(values, row, ['notes'], 2);
                    const player = getColVal(values, row, ['player', 'user'], 3);
                    const date = getColVal(values, row, ['date'], 5);
                    const video = getColVal(values, row, ['player video', 'video', 'link'], 6);
                    const difficulty = getColVal(values, row, ['difficulty'], 7);
                    const verifierValue = getColVal(values, row, ['verifier', 'verifier?'], 8);

                    return {
                        id: index,
                        rawRank,
                        tag: tagValue,
                        isOld,
                        name,
                        notes,
                        player,
                        date,
                        video,
                        difficulty,
                        verifier: verifierValue,
                    };
                })
                .filter((entry) => entry.name.trim() !== '');

            // Assign slugs to active achievement list
            const validAchievementList = parsedAchievementEntries
                .filter((achievement) => !achievement.isOld)
                .map((achievement, index) => ({
                    ...achievement,
                    displayRank: index + 1,
                    rank: index + 1,
                }));
            assignSlugsAndHashes(validAchievementList);

            // Assign slugs to active verified list
            const validVerifiedList = parsedAchievementEntries
                .filter((entry) => !entry.isOld && (entry.verifier || '').toLowerCase() === 'y')
                .map((entry, index) => ({
                    ...entry,
                    rank: index + 1,
                }));
            assignSlugsAndHashes(validVerifiedList);

            const achievementMap = new Map();
            validAchievementList.forEach((a) => achievementMap.set(a.id, a));

            const verifiedMap = new Map();
            validVerifiedList.forEach((v) => verifiedMap.set(v.id, v));

            const verifiedByNameMap = new Map();
            validVerifiedList.forEach((v) => {
                const norm = normalizePlayerName(v.name);
                if (!verifiedByNameMap.has(norm)) {
                    verifiedByNameMap.set(norm, v);
                }
            });

            const playerProfiles = new Map();
            parsedAchievementEntries.forEach((entry) => {
                if (entry.isOld) return;

                const normalizedName = normalizePlayerName(entry.player);
                const isLevelCompletion = !containsPercentLabel(entry.name);
                const isVerified = (entry.verifier || '').trim().toLowerCase() === 'y';

                if (!playerProfiles.has(normalizedName)) {
                    playerProfiles.set(normalizedName, {
                        username: entry.player || 'Unknown',
                        completedLevels: [],
                        verifiedLevels: [],
                        runs: [],
                    });
                }

                const profile = playerProfiles.get(normalizedName);
                const ach = achievementMap.get(entry.id);
                const ver = verifiedMap.get(entry.id) || verifiedByNameMap.get(normalizePlayerName(entry.name));

                const item = {
                    id: entry.id,
                    name: entry.name,
                    player: entry.player,
                    date: entry.date,
                    video: entry.video,
                    rank: ach ? ach.rank : null,
                    slug: ach ? ach.slug : slugify(entry.name),
                    verifiedRank: ver ? ver.rank : null,
                    verifiedSlug: ver ? ver.slug : (isVerified ? slugify(entry.name) : null),
                    verified: isVerified,
                };

                if (isLevelCompletion) {
                    profile.completedLevels.push(item);
                    if (isVerified) {
                        profile.verifiedLevels.push(item);
                    }
                } else {
                    profile.runs.push(item);
                }
            });

            this.entries = leaderboardEntries.map((entry) => {
                const normalizedName = normalizePlayerName(entry.username);
                const details = playerProfiles.get(normalizedName);
                return {
                    ...entry,
                    slug: slugify(entry.username) || 'player',
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
                if (!this.selectPlayerByParam(this.$route.params.player)) {
                    this.selectPlayer(this.entries[0]);
                }
            }
        } catch (error) {
            console.error('Failed to load stats viewer:', error);
            this.errors.push('Failed to load stats viewer. Retry in a few minutes or notify list staff.');
        } finally {
            this.loading = false;
        }
    },
};
