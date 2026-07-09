import { store } from '../main.js';
import { embed } from '../util.js';
import { fetchEditors } from '../content.js';
import Spinner from '../components/Spinner.js';

const csvPath = '/data/pianoDL - piano achievement list (8).csv';

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
    components: { Spinner },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list.length > 0">
                    <tr v-for="(entry, i) in list" :key="entry.rank">
                        <td class="rank">
                            <p class="type-label-lg">#{{ entry.rank }}</p>
                        </td>
                        <td class="level" :class="{ active: selected === i }">
                            <button @click="selected = i">
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
                    </div>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
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
                                <td class="date">
                                    <p>{{ related.date || 'Unknown' }}</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <h3><a href="https://docs.google.com/spreadsheets/d/1G690o1gyEmQR8HmtauwUkV9Z-qbg2C22v9Z7FlRpXYk/edit" target="_blank">Full List (including runs)</a></h3>
                    <h3>List Editors</h3>
                    <ol class="editors">
                        <li v-for="editor in editors" :key="editor.name">
                            <img :src="'/assets/' + roleIconMap[editor.role] + (store.dark ? '-dark' : '') + '.svg'" :alt="editor.role" />
                            <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                            <p v-else>{{ editor.name }}</p>
                        </li>
                    </ol>
                    <h3>Submission Requirements</h3>
                    <p>Achieved the record without using hacks (however, FPS bypass is allowed, up to 360fps)</p>
                    <p>Have either source audio or clicks/taps in the video. Edited audio only does not count</p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        loading: true,
        list: [],
        allEntries: [],
        selected: 0,
        editors: [],
        errors: [],
        store,
    }),
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

            const response = await fetch(csvPath);
            const text = await response.text();
            const rows = parseCsv(text);
            const [header, ...dataRows] = rows;
            const headers = header.map((col) => col.trim());

            const parsedEntries = dataRows
                .map((row, index) => {
                    const values = headers.reduce((acc, key, colIndex) => {
                        acc[key] = row[colIndex] ? row[colIndex].trim() : '';
                        return acc;
                    }, {});

                    const verifierKey = Object.keys(values).find((key) => {
                        const normalized = key.toLowerCase().replace(/\?/g, '');
                        return normalized === 'verifier';
                    });
                    const verifierValue = verifierKey ? values[verifierKey] : '';
                    const percentMatch = (values['Name'] || '').match(/(\d{1,3})(?:\s*-\s*\d{1,3})?%/);
                    const percent = percentMatch ? Number(percentMatch[1]) : 100;

                    return {
                        id: index,
                        name: values['Name'] || '',
                        notes: values['Notes'] || '',
                        player: values['Player'] || '',
                        date: values['Date'] || '',
                        video: values['Player Video'] || '',
                        difficulty: values['Difficulty'] || '',
                        verifier: verifierValue,
                        percent,
                    };
                })
                .filter((entry) => entry.name.trim() !== '');

            this.allEntries = parsedEntries;
            this.list = parsedEntries
                .filter((entry) => entry.verifier.toLowerCase() === 'y')
                .map((entry, index) => ({
                    ...entry,
                    rank: index + 1,
                }));
        } catch (error) {
            console.error('Failed to load verified CSV list:', error);
            this.errors.push('Failed to load verified list. Retry in a few minutes or notify list staff.');
        } finally {
            this.loading = false;
        }
    },
};
