import { store } from '../main.js';
import { embed, assignSlugsAndHashes } from '../util.js';
import { fetchEditors } from '../content.js';
import { fetchCsvPrefer } from '../util.js';
import Spinner from '../components/Spinner.js';
import Sidebar from '../components/List/Sidebar.js';

const csvPath = '/data/pianoDL - piano achievement list (30).csv';
const remoteCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=702241830&single=true&output=csv';

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

export default {
    components: { Spinner, Sidebar },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list.length > 0">
                    <tr v-for="(entry, i) in list" :key="entry.slug || entry.rank">
                        <td class="rank">
                            <p class="type-label-lg">#{{ entry.rank }}</p>
                        </td>
                        <td class="level" :class="{ active: selected === i }">
                            <button @click="selectLevel(i)">
                                <img
                                    v-if="entry.difficulty"
                                    class="difficulty-icon"
                                    :src="'/assets/difficulty-icons/' + entry.difficulty + '.png'"
                                    :alt="entry.difficulty"
                                />
                                <div class="level-info">
                                    <span class="type-label-lg">{{ entry.name }}</span>
                                    <p class="type-label-sm">{{ entry.player }}</p>
                                </div>
                            </button>
                        </td>
                    </tr>
                </table>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>No verified entries were loaded.</p>
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

                        <div class="type-title-sm">Achievement Rank</div>
                        <p class="type-body"><span>{{ entry.achievementRank != null ? '#' + entry.achievementRank : 'Unknown' }}</span></p>
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
                        <button class="link-btn" @click="copyShareLink" :title="copied ? 'Copied URL!' : 'Copy direct link to this level'">
                            {{ copied ? '✓ Copied link!' : 'Copy share link' }}
                        </button>
                    </p>
                    <div class="victors-section" v-if="relatedEntries.length > 0">
                        <h2 class="type-title-lg">Records</h2>
                        <table class="records">
                            <tr v-for="related in relatedEntries" :key="related.id">
                                <td class="percent">
                                    <p>{{ related.percent }}%</p>
                                </td>
                                <td class="user">
                                    <a v-if="related.video" :href="related.video" target="_blank" class="type-label-lg">{{ related.player || 'Unknown' }}</a>
                                    <p v-else class="type-label-lg">{{ related.player || 'Unknown' }}</p>
                                </td>
                                <td class="achievement-rank">
                                    <p>#{{ related.achievementRank ?? '—' }}</p>
                                </td>
                                <td class="date">
                                    <p>{{ related.date || 'Unknown' }}</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            <Sidebar :editors="editors">
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
                const basePath = this.$route.path.startsWith('/experimental-verified-list')
                    ? '/experimental-verified-list'
                    : '/verified-list';
                if (this.$route.params.level !== entry.slug) {
                    this.$router.replace({ path: `${basePath}/${entry.slug}` }).catch(() => {});
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
                foundIndex = this.list.findIndex((item) => item.rank === rankNum);
            }

            if (foundIndex !== -1) {
                this.selected = foundIndex;
            }
        },
        async copyShareLink() {
            try {
                const entry = this.list[this.selected];
                const basePath = this.$route.path.startsWith('/experimental-verified-list')
                    ? '/experimental-verified-list'
                    : '/verified-list';
                let shareUrl = window.location.href;
                if (entry && entry.slug) {
                    shareUrl = `${window.location.origin}${basePath}/${encodeURIComponent(entry.slug)}`;
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

            const currentName = (this.entry.name || '').trim().toLowerCase();
            return this.allEntries
                .filter((item) => {
                    if (!item.name || item.id === this.entry.id) {
                        return false;
                    }
                    return (item.name || '').trim().toLowerCase() === currentName;
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
            const [editors] = await Promise.all([fetchEditors()]);
            this.editors = editors || [];

            let text = await fetchCsvPrefer(remoteCsv, csvPath);
            let rows = parseCsv(text);

            // Validate remote CSV looks like the achievement list; if not, fall back to local copy
            const headerRow = (rows[0] || []).join(' ').toLowerCase();
            if (!headerRow.includes('name') && !headerRow.includes('#') && !headerRow.includes('player video') && !headerRow.includes('player')) {
                try {
                    const localResp = await fetch(csvPath);
                    if (localResp && localResp.ok) {
                        text = await localResp.text();
                        rows = parseCsv(text);
                    } else {
                        console.warn('VerifiedCsvList: remote CSV header mismatch and local fetch failed', localResp && localResp.status);
                    }
                } catch (err) {
                    console.warn('VerifiedCsvList: local fetch failed', err && err.message);
                }
            }

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
                    const date = getColVal(values, row, ['date'], 5);
                    const video = getColVal(values, row, ['player video', 'video', 'link'], 6);
                    const difficulty = getColVal(values, row, ['difficulty'], 7);
                    const verifierValue = getColVal(values, row, ['verifier', 'verifier?'], 8);

                    const percentMatch = name.match(/(\d{1,3})(?:\s*-\s*\d{1,3})?%/);
                    const percent = percentMatch ? Number(percentMatch[1]) : 100;
                    const achievementRank = !isOld && rawRank && /^\d+$/.test(rawRank) ? Number(rawRank) : null;

                    return {
                        id: index,
                        name,
                        notes,
                        player,
                        date,
                        video,
                        difficulty,
                        verifier: verifierValue,
                        percent,
                        achievementRank,
                        isOld,
                    };
                })
                .filter((entry) => entry.name.trim() !== '');

            this.allEntries = parsedEntries;
            const validList = parsedEntries
                .filter((entry) => !entry.isOld && entry.verifier.toLowerCase() === 'y')
                .map((entry, index) => ({
                    ...entry,
                    rank: index + 1,
                }));

            this.list = assignSlugsAndHashes(validList);

            if (this.$route.params.level) {
                this.selectByParam(this.$route.params.level);
            }
        } catch (error) {
            console.error('Failed to load verified CSV list:', error);
            this.errors.push('Failed to load verified list. Retry in a few minutes or notify list staff.');
        } finally {
            this.loading = false;
        }
    },
};
