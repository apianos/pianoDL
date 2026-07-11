import { store } from '../main.js';
import { embed } from '../util.js';
import { fetchEditors } from '../content.js';
import Spinner from '../components/Spinner.js';

const csvPath = '/data/pianoDL - piano achievement list (11).csv';

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
                    <tr v-for="(achievement, i) in list" :key="achievement.rank">
                        <td class="rank">
                            <p class="type-label-lg">#{{ achievement.rank }}</p>
                        </td>
                        <td class="level" :class="{ active: selected === i }">
                            <button @click="selected = i">
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
                    </div>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <p class="video-caption type-label-sm">
                        <a
                            v-if="entry.video"
                            :href="entry.video"
                            target="_blank"
                            rel="noreferrer noopener"
                        >Video link</a>
                    </p>
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
                    <p>
                        Achieved the record without using hacks (however, FPS bypass is allowed, up to 360fps)
                    </p>
                    <p>
                        Have either source audio or clicks/taps in the video. Edited audio only does not count
                    </p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        loading: true,
        list: [],
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
    },
    async mounted() {
        try {
            const [editors, editorError] = await Promise.all([
                fetchEditors(),
                null,
            ]);
            this.editors = editors || [];

            const response = await fetch(csvPath);
            const text = await response.text();
            const rows = parseCsv(text);
            const [header, ...dataRows] = rows;
            const headers = header.map((col) => col.trim());

            this.list = dataRows
                .map((row, index) => {
                    const values = headers.reduce((acc, key, colIndex) => {
                        acc[key] = row[colIndex] ? row[colIndex].trim() : '';
                        return acc;
                    }, {});

                    return {
                        rank: values['#'] || index + 1,
                        name: values['Name'] || '',
                        notes: values['Notes'] || '',
                        player: values['Player'] || '',
                        date: values['Date'] || '',
                        video: values['Player Video'] || '',
                        difficulty: values['Difficulty'] || '',
                    };
                })
                .filter((achievement) => achievement.name.trim() !== '');

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
