import { store } from '../main.js';
import { embed, assignSlugsAndHashes, fetchCsvPreferWithStatus, describeCsvSource, parseSummandsByPlayer, SHOW_LIST_POINTS } from '../util.js';
import { fetchEditors } from '../content.js';
import Spinner from '../components/Spinner.js';
import Sidebar from '../components/List/Sidebar.js';

const csvPath = '/data/pianoDL - piano achievement list (30).csv';
const remoteCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=702241830&single=true&output=csv';
const statsCsvPath = '/data/achievement_leaderboard (1).csv';
const remoteStatsCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=1658804691&single=true&output=csv';

function normalizeAchievementTitle(title = '') {
    return title
        .trim()
        .toLowerCase()
        .replace(/\s*\+\s*\d{1,3}(?:\s*-\s*\d{1,3})?%?/g, '')
        .replace(/\s+\d{1,3}(?:\s*-\s*\d{1,3})?%?$/i, '')
        .trim();
}

function getPercentLabel(title = '') {
    const value = title.trim();
    const compoundMatch = value.match(/(\d{1,3}%\s*\+\s*\d{1,3}\s*(?:-|–)\s*\d{1,3}%?)/i);
    if (compoundMatch) {
        return compoundMatch[1].replace(/\s+/g, ' ').trim();
    }

    const rangeMatch = value.match(/(\d{1,3}\s*(?:-|–)\s*\d{1,3}%?)/i);
    if (rangeMatch) {
        const range = rangeMatch[1].replace(/\s+/g, '');
        return range.endsWith('%') ? range : `${range}%`;
    }

    const singleMatch = value.match(/(\d{1,3}%)$/i);
    if (singleMatch) {
        return singleMatch[1];
    }

    return '100%';
}

function isPastRank(rank = '', extra = '') {
    const normalized = String(rank || '').trim().toUpperCase();
    const normalizedExtra = String(extra || '').trim().toUpperCase();
    return (
        normalized === 'PAST' ||
        normalized === 'OLD' ||
        normalized.startsWith('OLD') ||
        normalized.startsWith('PAST') ||
        normalizedExtra === 'OLD' ||
        normalizedExtra === 'PAST'
    );
}

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

export default {
    components: { Spinner, Sidebar },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list.length > 0">
                    <tr v-for="(achievement, i) in list" :key="achievement.slug || achievement.rank">
                        <td class="rank">
                            <p class="type-label-lg">#{{ achievement.rank }}</p>
                        </td>
                        <td class="level" :class="{ active: selected === i }">
                            <button @click="selectLevel(i)">
                                <img
                                    v-if="achievement.difficulty"
                                    class="difficulty-icon"
                                    :src="'/assets/difficulty-icons/' + achievement.difficulty + '.png'"
                                    :alt="achievement.difficulty"
                                />
                                <div class="level-info">
                                    <span class="type-label-lg">{{ achievement.name }}</span>
                                    <p class="type-label-sm">{{ achievement.player }}</p>
                                </div>
                            </button>
                        </td>
                    </tr>
                </table>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>No achievement rows were loaded.</p>
                </div>
            </div>
            <div class="level-container" v-if="entry">
                <div class="level">
                    <h1>{{ entry.name }}</h1>
                    <div class="level-authors">
                        <div class="type-title-sm">Player</div>
                        <p class="type-body"><span>{{ entry.player || 'Unknown' }}</span></p>

                        <div class="type-title-sm">Date</div>
                        <p class="type-body"><span>{{ entry.date || 'Unknown' }}</span></p>

                        <template v-if="showListPoints">
                            <div class="type-title-sm">List Points</div>
                            <p class="type-body"><span>{{ entry.listPoints ?? 'Unavailable' }}</span></p>
                        </template>
                    </div>
                    <iframe v-if="video" class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <div v-else-if="entry.video" class="video-placeholder" role="status">
                        <img v-if="isDiscordVideo" src="/assets/discord.svg" alt="" />
                        <div>
                            <p class="video-placeholder__title">{{ isDiscordVideo ? 'VIDEO HOSTED ON DISCORD' : 'VIDEO PREVIEW UNAVAILABLE' }}</p>
                            <p>{{ isDiscordVideo ? 'This run’s video is hosted in the pianoDL Discord server.' : 'This video can’t be previewed here.' }}</p>
                        </div>
                    </div>
                    <p class="video-caption type-label-sm">
                        <a
                            v-if="entry.video"
                            :href="entry.video"
                            target="_blank"
                            rel="noreferrer noopener"
                        >Video link</a>
                        <span v-if="entry.video"> • </span>
                        <button class="link-btn" @click="copyShareLink" :title="copied ? 'Copied URL!' : 'Copy direct link to this achievement'">
                            {{ copied ? '✓ Copied link!' : 'Copy share link' }}
                        </button>
                    </p>
                    <div class="victors-section" v-if="relatedEntries.length > 0">
                        <h2 class="type-title-lg">Past Runs</h2>
                        <table class="records">
                            <tr v-for="related in relatedEntries" :key="related.id">
                                <td class="percent">
                                    <p>{{ related.percent }}</p>
                                </td>
                                <td class="user">
                                    <a v-if="related.video" :href="related.video" target="_blank" class="type-label-lg">{{ related.player || 'Unknown' }}</a>
                                    <p v-else class="type-label-lg">{{ related.player || 'Unknown' }}</p>
                                </td>
                                <td class="date">
                                    <p>{{ related.date || 'Unknown' }}</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            <Sidebar :editors="editors" :data-status="dataStatus">
                <p class="error" v-for="error of errors" :key="error">{{ error }}</p>
            </Sidebar>
        </main>
    `,
    data: () => ({
        loading: true,
        list: [],
        allEntries: [],
        selected: 0,
        editors: [],
        errors: [],
        copied: false,
        dataStatus: null,
        showListPoints: SHOW_LIST_POINTS,
        store,
    }),
    watch: {
        '$route.params.level'(newLevel) {
            if (newLevel) {
                this.selectByParam(newLevel);
            }
        },
    },
    methods: {
        selectLevel(index) {
            this.selected = index;
            const entry = this.list[index];
            if (entry && entry.slug) {
                if (this.$route.params.level !== entry.slug) {
                    this.$router.replace({ path: `/achievement-list/${entry.slug}` }).catch(() => {});
                }
            }
        },
        selectByParam(param) {
            if (!param || !this.list || this.list.length === 0) return;
            const query = String(param).trim().toLowerCase();

            // 1. Exact slug match
            let foundIndex = this.list.findIndex((item) => item.slug && item.slug.toLowerCase() === query);

            // 2. Hash match
            if (foundIndex === -1) {
                foundIndex = this.list.findIndex((item) => item.hash && item.hash.toLowerCase() === query);
            }

            // 3. Base slug match
            if (foundIndex === -1) {
                foundIndex = this.list.findIndex((item) => item.baseSlug && item.baseSlug.toLowerCase() === query);
            }

            // 4. Rank number fallback
            if (foundIndex === -1 && /^\d+$/.test(query)) {
                const rankNum = parseInt(query, 10);
                foundIndex = this.list.findIndex((item) => item.rank === rankNum || item.displayRank === rankNum);
            }

            if (foundIndex !== -1) {
                this.selected = foundIndex;
            }
        },
        async copyShareLink() {
            try {
                const entry = this.list[this.selected];
                let shareUrl = window.location.href;
                if (entry && entry.slug) {
                    shareUrl = `${window.location.origin}/achievement-list/${encodeURIComponent(entry.slug)}`;
                }
                await navigator.clipboard.writeText(shareUrl);
                this.copied = true;
                setTimeout(() => {
                    this.copied = false;
                }, 2000);
            } catch (err) {
                console.warn('Failed to copy link:', err);
            }
        },
    },
    computed: {
        entry() {
            return this.list[this.selected];
        },
        video() {
            if (!this.entry || !this.entry.video) {
                return '';
            }
            return embed(this.entry.video);
        },
        isDiscordVideo() {
            if (!this.entry || !this.entry.video) return false;
            try {
                const url = new URL(this.entry.video);
                return ['discord.com', 'www.discord.com'].includes(url.hostname.toLowerCase())
                    && url.pathname.startsWith('/channels/');
            } catch {
                return false;
            }
        },
        roleIconMap() {
            return {
                owner: 'crown',
                admin: 'user-gear',
                helper: 'user-shield',
                dev: 'code',
                trial: 'user-lock',
            };
        },
        relatedEntries() {
            if (!this.entry) {
                return [];
            }

            const currentName = normalizeAchievementTitle(this.entry.name);
            const currentPlayer = (this.entry.player || '').trim().toLowerCase();

            return this.allEntries
                .filter((item) => {
                    if (!item.name || item.id === this.entry.id) {
                        return false;
                    }

                    const itemName = normalizeAchievementTitle(item.name);
                    const itemPlayer = (item.player || '').trim().toLowerCase();
                    const isPastEntry = item.isOld || isPastRank(item.rank, item.tag);

                    return (
                        itemName === currentName &&
                        itemPlayer === currentPlayer &&
                        isPastEntry
                    );
                })
                .sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    return dateA - dateB;
                });
        },
    },
    async mounted() {
        try {
            const [editors, editorError] = await Promise.all([
                fetchEditors(),
                null,
            ]);
            this.editors = editors || [];

            const [csvResult, statsResult] = await Promise.all([
                fetchCsvPreferWithStatus(remoteCsv, csvPath),
                SHOW_LIST_POINTS
                    ? fetchCsvPreferWithStatus(remoteStatsCsv, statsCsvPath)
                    : Promise.resolve(null),
            ]);
            let text = csvResult.text;
            let rows = parseCsv(text);
            const summandsByPlayer = statsResult
                ? parseSummandsByPlayer(parseCsv(statsResult.text))
                : new Map();

            // If the remote sheet doesn't look like the achievement list, fall back to the local CSV
            const headerRow = (rows[0] || []).join(' ').toLowerCase();
            if (!headerRow.includes('name') && !headerRow.includes('#') && !headerRow.includes('player video') && !headerRow.includes('player')) {
                try {
                    const localResp = await fetch(csvPath, { cache: 'no-store' });
                    if (localResp && localResp.ok) {
                        text = await localResp.text();
                        rows = parseCsv(text);
                        csvResult = { source: 'local', checkedAt: new Date().toISOString() };
                    } else {
                        csvResult = { source: 'unverified' };
                        console.warn('AchievementList: remote CSV header mismatch and local fetch failed', localResp && localResp.status);
                    }
                } catch (err) {
                    csvResult = { source: 'unverified' };
                    console.warn('AchievementList: local fetch failed', err && err.message);
                }
            }
            const achievementIndexesByPlayer = new Map();

            const [header, ...dataRows] = rows;
            const headers = header.map((col) => col.trim());

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

            const parsedEntries = dataRows
                .map((row, index) => {
                    const values = headers.reduce((acc, key, colIndex) => {
                        acc[key] = row[colIndex] ? row[colIndex].trim() : '';
                        return acc;
                    }, {});

                    const rawRank = getColVal(values, row, ['#', 'rank', 'x', 'id'], 0);
                    const tagValue = getColVal(values, row, ['column 1', 'tag', 'old', 'type', ''], 4);
                    const isOld = isPastRank(rawRank, tagValue);
                    const name = getColVal(values, row, ['name'], 1);
                    const notes = getColVal(values, row, ['notes'], 2);
                    const player = getColVal(values, row, ['player', 'user'], 3);
                    const playerKey = player.trim().toLowerCase();
                    const achievementIndex = isOld ? null : (achievementIndexesByPlayer.get(playerKey) || 0);
                    if (!isOld) achievementIndexesByPlayer.set(playerKey, achievementIndex + 1);
                    const date = getColVal(values, row, ['date'], 5);
                    const video = getColVal(values, row, ['player video', 'video', 'link'], 6);
                    const difficulty = getColVal(values, row, ['difficulty'], 7);
                    const percent = getPercentLabel(name);

                    return {
                        id: index,
                        rank: isOld ? 'OLD' : (rawRank || String(index + 1)),
                        rawRank,
                        tag: tagValue,
                        isOld,
                        name,
                        notes,
                        player,
                        listPoints: achievementIndex === null ? null : (summandsByPlayer.get(playerKey)?.[achievementIndex] ?? null),
                        date,
                        video,
                        difficulty,
                        percent,
                    };
                })
                .filter((achievement) => achievement.name.trim() !== '');

            this.allEntries = parsedEntries;
            const validList = parsedEntries
                .filter((achievement) => !achievement.isOld && !isPastRank(achievement.rank, achievement.tag))
                .map((achievement, index) => ({
                    ...achievement,
                    displayRank: index + 1,
                    rank: index + 1,
                }));

            this.list = assignSlugsAndHashes(validList);
            this.dataStatus = !SHOW_LIST_POINTS
                ? describeCsvSource([csvResult])
                : !summandsByPlayer.size
                ? { state: 'warning', message: 'Per-achievement list points are unavailable.' }
                : this.list.some((achievement) => achievement.listPoints === null)
                    ? { state: 'warning', message: 'List points are missing for some achievements.' }
                    : describeCsvSource([csvResult, statsResult]);

            if (this.$route.params.level) {
                this.selectByParam(this.$route.params.level);
            }

            if (editorError) {
                this.errors.push(editorError);
            }
        } catch (error) {
            console.error('Failed to load achievement list:', error);
            this.errors.push('Failed to load achievement list. Retry in a few minutes or notify list staff.');
        } finally {
            this.loading = false;
        }
    },
};
