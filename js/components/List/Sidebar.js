import { store } from '../../main.js';

const roleIconMap = {
    owner: 'crown',
    admin: 'user-gear',
    helper: 'user-shield',
    dev: 'code',
    trial: 'user-lock',
};

export default {
    props: {
        editors: {
            type: Array,
            default: () => [],
        },
        dataStatus: {
            type: Object,
            default: null,
        },
    },
    template: `
        <div class="meta-container">
            <div class="meta">
                <p v-if="dataStatus" class="data-status" :class="'data-status--' + dataStatus.state" role="status">
                    {{ dataStatus.message }}
                </p>
                <div class="og">
                    <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                </div>
                <h3><a href="https://docs.google.com/document/d/1VoSdEWYx8fAlsZCJaWGdE8O2gifMP04XTL-TRyf76iU/edit?usp=sharing" target="_blank">Rules and Information</a></h3>
                <h3><a href="https://docs.google.com/spreadsheets/d/1G690o1gyEmQR8HmtauwUkV9Z-qbg2C22v9Z7FlRpXYk/edit" target="_blank">Spreadsheet</a></h3>
                <template v-if="editors && editors.length > 0">
                    <h3>List Editors</h3>
                    <ol class="editors">
                        <li v-for="editor in editors" :key="editor.name">
                            <img :src="'/assets/' + roleIconMap[editor.role] + (store.dark ? '-dark' : '') + '.svg'" :alt="editor.role" />
                            <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                            <p v-else>{{ editor.name }}</p>
                        </li>
                    </ol>
                </template>
                <iframe
                    src="https://discord.com/widget?id=1513904060632137879&theme=dark"
                    width="350"
                    height="500"
                    allowtransparency="true"
                    frameborder="0"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                ></iframe>
            </div>
        </div>
    `,
    data: () => ({
        roleIconMap,
        store,
    }),
};
