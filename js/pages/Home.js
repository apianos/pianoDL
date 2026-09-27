import { fetchEditors } from '../content.js';
import { assignSlugsAndHashes, embed, fetchCsvPrefer, slugify } from '../util.js';
import { store } from '../main.js';

const changelogPath = '/data/changelog.csv';
const achievementPath = '/data/pianoDL - piano achievement list (30).csv';
const publishedSheet = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=844974805&single=true&output=csv';
const achievementSheet = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=702241830&single=true&output=csv';
const mentionsSheet = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=500846361&single=true&output=csv';

const roleIconMap = {
    owner: 'crown',
    admin: 'user-gear',
    helper: 'user-shield',
    dev: 'code',
    trial: 'user-lock',
};

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let insideQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (insideQuotes) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    insideQuotes = false;
                }
            } else {
                field += char;
            }
        } else if (char === '"') {
            insideQuotes = true;
        } else if (char === ',') {
            row.push(field.trim());
            field = '';
        } else if (char === '\n') {
            row.push(field.trim());
            rows.push(row);
            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    row.push(field.trim());
    if (row.length > 1 || row[0] !== '') {
        rows.push(row);
    }
    if (rows[0] && rows[0][0]) {
        rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    }
    return rows;
}

function rowsToObjects(text) {
    const [header = [], ...rows] = parseCsv(text);
    const keys = header.map((value) => value.trim().toLowerCase().replace(/\?/g, ''));
    return rows.map((row) => keys.reduce((item, key, index) => {
        item[key] = row[index] || '';
        return item;
    }, {}));
}

function parseMentionLinks(text) {
    return parseCsv(text)
        .map((row) => String(row[0] || '').trim())
        .filter((value) => /^https?:\/\//i.test(value));
}

function getYoutubeStartSeconds(video) {
    let url;
    try {
        url = new URL(video);
    } catch {
        return 0;
    }

    const timestamp = url.searchParams.get('t') || url.searchParams.get('start') || '';
    if (/^\d+$/.test(timestamp)) {
        return Number(timestamp);
    }

    const parts = timestamp.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
    if (!parts || !parts[0]) return 0;
    return (Number(parts[1] || 0) * 3600) + (Number(parts[2] || 0) * 60) + Number(parts[3] || 0);
}

function getMentionEmbed(video) {
    const source = embed(video);
    if (!source) return '';
    if (!video.includes('youtube.com') && !video.includes('youtu.be')) {
        return source;
    }

    const start = getYoutubeStartSeconds(video);
    return start > 0 ? `${source}?start=${start}` : source;
}

function isPastRank(value = '') {
    return /^(?:old|past)(?:\b|\s)/i.test(String(value).trim());
}

function parseAchievements(text) {
    const entries = rowsToObjects(text)
        .map((row) => ({
            name: row.name || '',
            player: row.player || row.user || '',
            video: row['player video'] || row.video || row.link || '',
            date: row.date || '',
            rank: row['#'] || row.rank || '',
            tag: row['column 1'] || row.tag || row.old || row.type || '',
        }))
        .filter((entry) => entry.name && !isPastRank(entry.rank) && !isPastRank(entry.tag));

    return assignSlugsAndHashes(entries);
}

function movementType(details) {
    const ranks = String(details || '').match(/\d+/g) || [];
    if (ranks.length < 2) {
        return 'updated';
    }
    return Number(ranks[1]) < Number(ranks[0]) ? 'moved-up' : 'moved-down';
}

function badgeFor(item) {
    const type = String(item.type || '').trim().toUpperCase();
    if (type === 'RANK_CHANGE') {
        const movement = movementType(item.details);
        return {
            label: movement === 'moved-up' ? 'MOVED UP' : movement === 'moved-down' ? 'MOVED DOWN' : 'RANK UPDATED',
            className: movement,
        };
    }
    const badges = {
        NEW_VERIFICATION: ['NEW VERIFICATION', 'verification'],
        NEW_VICTOR: ['NEW VICTOR', 'victor'],
        NEW_RUN: ['NEW RUN', 'run'],
        SUPERSEDED: ['SUPERSEDED', 'superseded'],
        REMOVED: ['REMOVED', 'removed'],
    };
    const [label, className] = badges[type] || [type.replace(/_/g, ' ') || 'LIST UPDATE', 'other'];
    return { label, className };
}

export default {
    template: `
        <main class="page-home" :class="{ dark: store.dark }">
            <section class="home-hero">
                <div class="home-hero__grid" aria-hidden="true"></div>
                <div class="home-hero__inner">
                    <div class="home-hero__copy">
                        <h1>The Piano Demonlist</h1>
                        <p class="home-hero__description">The community-ranked demonlist of Geometry Dash achievements done while playing the song on piano. </p>
                    </div>
                    <nav class="home-hero__actions" aria-label="Explore the lists">
                        <router-link class="home-action home-action--outline" to="/verified-list">
                            <span>View verified list</span><span aria-hidden="true">&#8594;</span>
                        </router-link>
                        <router-link class="home-action home-action--primary" to="/achievement-list">
                            <span>View hardest achievement list</span><span aria-hidden="true">&#8594;</span>
                        </router-link>
                        <router-link class="home-action home-action--outline" to="/stats-viewer">
                            <span>View stats leaderboard</span><span aria-hidden="true">&#8594;</span>
                        </router-link>
                        <a class="home-action home-action--discord" href="https://discord.gg/vmAZNat2Wf" target="_blank" rel="noreferrer noopener">
                            <img src="/assets/discord.svg" alt="" /> Join Discord
                        </a>
                    </nav>
                </div>
                <div class="home-hero__keys" aria-hidden="true">
                    <span v-for="key in 14" :key="key"></span>
                </div>
            </section>

            <div class="home-content">
                <section class="home-grid" aria-label="Latest updates and community">
                    <div class="home-changelog">
                        <div class="home-section-heading">
                            <div>
                                <p class="home-kicker"></p>
                                <h2>CHANGELOG</h2>
                            </div>
                            <span class="home-update-count">{{ changelog.length }} updates</span>
                        </div>
                        <div class="home-changelog__rows" aria-live="polite">
                            <article v-for="(item, index) in visibleChanges" :key="item.timestamp + item.type + item.level + item.player + index" class="home-change">
                                <time class="home-change__date" :datetime="item.timestamp">{{ formatDate(item.timestamp) }}</time>
                                <div class="home-change__content">
                                    <div class="home-change__heading">
                                        <span class="home-change__badge" :class="'home-change__badge--' + badgeFor(item).className">{{ badgeFor(item).label }}</span>
                                        <span class="home-change__rank" v-if="item.details">{{ formatDetails(item) }}</span>
                                    </div>
                                    <router-link class="home-change__level" :to="'/achievement-list/' + getEntrySlug(item)">{{ item.level || 'Unknown achievement' }}</router-link>
                                    <p class="home-change__note">
                                        <span v-if="item.player">{{ item.player }}</span>
                                        <span v-if="item.player && item.difficulty">&nbsp; / &nbsp;</span>
                                        <span v-if="item.difficulty">{{ formatDifficulty(item.difficulty) }}</span>
                                    </p>
                                </div>
                            </article>
                            <p v-if="loading" class="home-feed-message">Loading the latest list activity...</p>
                            <p v-else-if="visibleChanges.length === 0" class="home-feed-message">No changelog updates are available right now.</p>
                        </div>
                    </div>

                    <aside class="home-sidebar">
                        <section class="home-community">
                            <p class="home-kicker"></p>
                            <h2>OUR COMMUNITY</h2>
                            <p class="home-community__intro">Records are set, reviewed, and celebrated by players across the community</p>
                            <iframe
                                class="home-discord-widget"
                                src="https://discord.com/widget?id=1513904060632137879&theme=dark"
                                title="pianoDL Discord community"
                                allowtransparency="true"
                                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                            ></iframe>
                            <a class="home-community__aredl" href="https://aredl.net/profile/clan/0b991f3d-c16f-4342-8feb-7545ef90e15b" target="_blank" rel="noreferrer noopener">
                                <span><img src="https://aredl.net/assets/logo.webp" alt="AREDL" /><strong>CLAN</strong></span>
                                <span aria-hidden="true">&#8599;</span>
                            </a>
                        </section>

                        <section class="home-info">
                            <div class="home-section-heading home-section-heading--small">
                                <div>
                                    <p class="home-kicker"></p>
                                    <h2>LIST STAFF</h2>
                                </div>
                            </div>
                            <ul class="home-staff-list">
                                <li v-for="editor in editors" :key="editor.name">
                                    <img :src="'/assets/' + roleIconMap[editor.role] + (store.dark ? '-dark' : '') + '.svg'" :alt="editor.role" />
                                    <a v-if="editor.link" :href="editor.link" target="_blank" rel="noreferrer noopener">{{ editor.name }}</a>
                                    <span v-else>{{ editor.name }}</span>
                                    <small>{{ editor.role }}</small>
                                </li>
                            </ul>
                            <div class="home-info__links">
                                <a href="https://docs.google.com/document/d/1VoSdEWYx8fAlsZCJaWGdE8O2gifMP04XTL-TRyf76iU/edit?usp=sharing" target="_blank" rel="noreferrer noopener">RULES AND INFORMATION <span aria-hidden="true">&#8599;</span></a>
                                <a href="https://docs.google.com/spreadsheets/d/1G690o1gyEmQR8HmtauwUkV9Z-qbg2C22v9Z7FlRpXYk/edit" target="_blank" rel="noreferrer noopener">OPEN THE SPREADSHEET <span aria-hidden="true">&#8599;</span></a>
                            </div>
                        </section>
                    </aside>
                </section>

                <section v-if="mentions.length > 0" class="home-mentions" aria-label="pianoDL mentions">
                    <div class="home-section-heading">
                        <div>
                            <p class="home-kicker"></p>
                            <h2>IN THE WILD</h2>
                        </div>
                        <span class="home-update-count">{{ mentionIndex + 1 }} / {{ mentions.length }}</span>
                    </div>
                    <div class="home-mentions__carousel">
                        <button class="home-mentions__control" type="button" aria-label="Previous mention" @click="previousMention">&#8592;</button>
                        <div class="home-mentions__frame">
                            <iframe
                                v-if="featuredEmbed"
                                class="home-mentions__video"
                                :src="featuredEmbed"
                                :title="'pianoDL mention ' + (mentionIndex + 1)"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowfullscreen
                            ></iframe>
                            <a v-else class="home-mentions__unsupported" :href="featuredMention" target="_blank" rel="noreferrer noopener">
                                Open this mention <span aria-hidden="true">&#8599;</span>
                            </a>
                        </div>
                        <button class="home-mentions__control" type="button" aria-label="Next mention" @click="nextMention">&#8594;</button>
                    </div>
                    <a class="home-mentions__source" :href="featuredMention" target="_blank" rel="noreferrer noopener">Open video <span aria-hidden="true">&#8599;</span></a>
                </section>
                <section class="home-stats" aria-label="pianoDL community statistics">
                    <div class="home-stat">
                        <span class="home-stat__value">{{ rankedCount.toLocaleString() }}</span>
                        <span class="home-stat__label">ranked piano records</span>
                    </div>
                    <div class="home-stat">
                        <span class="home-stat__value">{{ playerCount.toLocaleString() }}</span>
                        <span class="home-stat__label">players on the list</span>
                    </div>
                    <div class="home-stat">
                        <span class="home-stat__value">10</span>
                        <span class="home-stat__label">community editors</span>
                    </div>
                </section>
            </div>
        </main>
    `,
    data: () => ({
        store,
        roleIconMap,
        editors: [],
        changelog: [],
        achievements: [],
        mentions: [],
        mentionIndex: 0,
        loading: true,
    }),
    computed: {
        visibleChanges() {
            return this.changelog;
        },
        rankedCount() {
            return this.achievements.length;
        },
        playerCount() {
            return new Set(this.achievements.map((entry) => entry.player.trim().toLowerCase()).filter(Boolean)).size;
        },
        featuredMention() {
            return this.mentions[this.mentionIndex] || '';
        },
        featuredEmbed() {
            return this.featuredMention ? getMentionEmbed(this.featuredMention) : '';
        },
    },
    methods: {
        badgeFor,
        formatDate(value) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return 'DATE UNKNOWN';
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
                timeZone: 'UTC',
            }).toUpperCase();
        },
        formatDetails(item) {
            const details = String(item.details || '').trim();
            const ranks = details.match(/\d+/g) || [];
            if (String(item.type || '').toUpperCase() === 'RANK_CHANGE' && ranks.length >= 2) {
                return `#${ranks[0]} to #${ranks[1]}`;
            }
            return details;
        },
        formatDifficulty(value) {
            return String(value || '').replace(/-/g, ' ');
        },
        getEntrySlug(item) {
            const level = String(item.level || '').trim().toLowerCase();
            const player = String(item.player || '').trim().toLowerCase();
            const match = this.achievements.find((entry) => entry.name.trim().toLowerCase() === level && entry.player.trim().toLowerCase() === player)
                || this.achievements.find((entry) => entry.name.trim().toLowerCase() === level);
            return match ? match.slug : slugify(item.level || '');
        },
        previousMention() {
            if (this.mentions.length === 0) return;
            this.mentionIndex = (this.mentionIndex - 1 + this.mentions.length) % this.mentions.length;
        },
        nextMention() {
            if (this.mentions.length === 0) return;
            this.mentionIndex = (this.mentionIndex + 1) % this.mentions.length;
        },
    },
    async mounted() {
        const [editorsResult, changelogResult, achievementsResult, mentionsResult] = await Promise.allSettled([
            fetchEditors(),
            fetchCsvPrefer(publishedSheet, changelogPath),
            fetchCsvPrefer(achievementSheet, achievementPath),
            fetchCsvPrefer(mentionsSheet, mentionsSheet),
        ]);

        if (editorsResult.status === 'fulfilled') {
            this.editors = editorsResult.value || [];
        }
        if (changelogResult.status === 'fulfilled') {
            this.changelog = rowsToObjects(changelogResult.value)
                .map((row) => ({
                    timestamp: row.timestamp || '',
                    type: row.type || '',
                    player: row.player || '',
                    level: row['level/run'] || row.level || '',
                    details: row['details/rank'] || row.details || '',
                    difficulty: row.difficulty || '',
                }))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else {
            console.warn('Home: changelog could not be loaded', changelogResult.reason);
        }
        if (achievementsResult.status === 'fulfilled') {
            this.achievements = parseAchievements(achievementsResult.value);
        } else {
            console.warn('Home: achievement data could not be loaded', achievementsResult.reason);
        }
        if (mentionsResult.status === 'fulfilled') {
            this.mentions = parseMentionLinks(mentionsResult.value);
        } else {
            console.warn('Home: video mentions could not be loaded', mentionsResult.reason);
        }
        this.loading = false;
    },
};