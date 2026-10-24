import { store } from '../main.js';
import { assignSlugsAndHashes, describeCsvSource, embed } from '../util.js';
import { fetchEditors } from '../content.js';
import Spinner from '../components/Spinner.js';
import Sidebar from '../components/List/Sidebar.js';

const remoteCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=2044464703&single=true&output=csv';

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(field.trim());
            field = '';
        } else if (character === '\n') {
            row.push(field.trim());
            rows.push(row);
            row = [];
            field = '';
        } else if (character !== '\r') {
            field += character;
        }
    }
    row.push(field.trim());
    if (row.length > 1 || row[0]) rows.push(row);
    return rows;
}

function isPastEntry(rank = '', tag = '') {
    const normalizedRank = String(rank).toUpperCase().trim();
    const normalizedTag = String(tag).toUpperCase().trim();
    return normalizedRank.startsWith('OLD')
        || normalizedRank.startsWith('PAST')
        || normalizedTag === 'OLD'
        || normalizedTag === 'PAST';
}

export default {
    components: { Spinner, Sidebar },
    template: `
        <main v-if="loading"><Spinner></Spinner></main>
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list.length > 0">
                    <tr v-for="(entry, index) in list" :key="entry.slug || entry.rank">
                        <td class="rank"><p class="type-label-lg">#{{ entry.rank }}</p></td>
                        <td class="level" :class="{ active: selected === index }">
                            <button @click="selectLevel(index)">
                                <img v-if="entry.difficulty" class="difficulty-icon" :src="'/assets/difficulty-icons/' + entry.difficulty + '.png'" :alt="entry.difficulty" />
                                <div class="level-info">
                                    <span class="type-label-lg">{{ entry.name }}</span>
                                    <p class="bonus-instrument-name type-label-sm">{{ entry.instrument || 'Unknown instrument' }}</p>
                                    <p class="bonus-instrument-player type-label-sm">{{ entry.player }}</p>
                                </div>
                            </button>
                        </td>
                    </tr>
                </table>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;"><p>No bonus instrument entries were loaded.</p></div>
            </div>
            <div class="level-container" v-if="entry">
                <div class="level">
                    <h1>{{ entry.name }}</h1>
                    <div class="level-authors">
                        <div class="type-title-sm">Player</div><p class="type-body"><span>{{ entry.player || 'Unknown' }}</span></p>
                        <div class="type-title-sm">Instrument</div><p class="type-body"><span>{{ entry.instrument || 'Unknown' }}</span></p>
                        <div class="type-title-sm">Date</div><p class="type-body"><span>{{ entry.date || 'Unknown' }}</span></p>
                    </div>
                    <iframe v-if="video" class="video" :src="video" frameborder="0"></iframe>
                    <p class="video-caption type-label-sm">
                        <a v-if="entry.video" :href="entry.video" target="_blank" rel="noreferrer noopener">Video link</a>
                        <span v-if="entry.video"> • </span>
                        <button class="link-btn" @click="copyShareLink">{{ copied ? '✓ Copied link!' : 'Copy share link' }}</button>
                    </p>
                </div>
            </div>
            <Sidebar :editors="editors" :data-status="dataStatus"><p class="error" v-for="error of errors" :key="error">{{ error }}</p></Sidebar>
        </main>
    `,
    data: () => ({
        loading: true,
        list: [],
        selected: 0,
        editors: [],
        errors: [],
        copied: false,
        dataStatus: null,
        store,
    }),
    watch: {
        '$route.params.entry'(slug) {
            this.selectByParam(slug);
        },
    },
    methods: {
        selectLevel(index) {
            this.selected = index;
            const entry = this.list[index];
            if (entry?.slug && this.$route.params.entry !== entry.slug) {
                this.$router.replace({ path: `/bonus-instrument-list/${entry.slug}` }).catch(() => {});
            }
        },
        selectByParam(param) {
            const query = String(param || '').trim().toLowerCase();
            if (!query || !this.list.length) return;
            let index = this.list.findIndex((item) => item.slug?.toLowerCase() === query);
            if (index === -1) index = this.list.findIndex((item) => item.hash?.toLowerCase() === query);
            if (index !== -1) this.selected = index;
        },
        async copyShareLink() {
            const entry = this.list[this.selected];
            if (!entry?.slug) return;
            try {
                await navigator.clipboard.writeText(`${window.location.origin}/bonus-instrument-list/${encodeURIComponent(entry.slug)}`);
                this.copied = true;
                setTimeout(() => { this.copied = false; }, 2000);
            } catch (err) {
                console.warn('Failed to copy bonus list link:', err);
            }
        },
    },
    computed: {
        entry() {
            return this.list[this.selected] || null;
        },
        video() {
            return this.entry?.video ? embed(this.entry.video) : '';
        },
    },
    async mounted() {
        try {
            const [editors, csvResponse] = await Promise.all([
                fetchEditors(),
                fetch(remoteCsv, { cache: 'no-store' }),
            ]);
            this.editors = editors || [];
            if (!csvResponse.ok) throw new Error(`Bonus instrument CSV returned ${csvResponse.status}`);

            const rows = parseCsv(await csvResponse.text());
            const headers = (rows[0] || []).map((header) => header.trim().toLowerCase());
            const getValue = (row, name, fallbackIndex) => {
                const index = headers.indexOf(name);
                return (row[index === -1 ? fallbackIndex : index] || '').trim();
            };

            const entries = rows.slice(1).map((row, index) => {
                const rawRank = getValue(row, '#', 0);
                const tag = getValue(row, 'column 1', 4);
                return {
                    id: index,
                    rank: rawRank,
                    rawRank,
                    tag,
                    isOld: isPastEntry(rawRank, tag),
                    name: getValue(row, 'name', 1),
                    instrument: getValue(row, 'instrument', 2),
                    player: getValue(row, 'player', 3),
                    date: getValue(row, 'date', 5),
                    video: getValue(row, 'player video', 6),
                    difficulty: getValue(row, 'difficulty', 7),
                };
            }).filter((entry) => entry.name);

            let rank = 0;
            const activeEntries = entries
                .filter((entry) => !entry.isOld)
                .map((entry) => ({ ...entry, rank: ++rank }));
            this.list = assignSlugsAndHashes(activeEntries);
            this.dataStatus = describeCsvSource([{
                source: 'published',
                checkedAt: new Date().toISOString(),
            }]);

            if (this.$route.params.entry) this.selectByParam(this.$route.params.entry);
        } catch (error) {
            console.error('Failed to load bonus instrument list:', error);
            this.errors.push('Failed to load the bonus instrument list. Please try again later.');
            this.dataStatus = { state: 'warning', message: 'The published data could not be loaded.' };
        } finally {
            this.loading = false;
        }
    },
};
