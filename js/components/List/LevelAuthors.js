export default {
    props: {
        author: {
            type: String,
            required: true,
        },
        creators: {
            type: Array,
            required: true,
        },
        player: {
            type: String,
            required: true,
        },
        date: {
            type: String,
            required: true,
        },
    },
    template: `
        <div class="level-authors">
            <template v-if="selfVerified">
                <div class="type-title-sm">Creator & Verifier</div>
                <p class="type-body">
                    <span>{{ author }}</span>
                </p>
            </template>
            <template v-else-if="creators.length === 0">    
                <div class="type-title-sm">Creator</div>
                <p class="type-body">
                    <span>{{ author }}</span>
                </p>
                <div class="type-title-sm">Verifier</div>
                <p class="type-body">
                    <span>{{ verifier }}</span>
                </p>
            </template>
            <template v-else>
                <div class="type-title-sm">Player</div>
                <p class="type-body">
                    <span>{{ player }}</span>
                </p>
                <div class="type-title-sm">Date</div>
                <p class="type-body">
                    <span>{{ date }}</span>
                </p>
            </template>
        </div>
    `,

    computed: {
        selfVerified() {
            return this.author === this.player && this.creators.length === 0;
        },
    },
};
