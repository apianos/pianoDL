export const SHOW_LIST_POINTS = false;

// https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
export function getYoutubeIdFromUrl(url) {
    return url.match(
        /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|shorts\/)([^#\&\?]*).*/,
    )?.[1] ?? '';
}

export function getInstagramIdFromUrl(url) {
    return url.match(
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)\/?/,
    )?.[1] ?? '';
}

export function getInstagramEmbedUrl(id) {
    return `https://www.instagram.com/p/${id}/embed/`;
}

export function processInstagramEmbeds() {
    if (window.instgrm) {
        window.instgrm.Embeds.process();
    }
}


export function getTiktokIdFromUrl(url) {
    return url.match(
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@(?:[a-zA-Z0-9_-]+)\/video\/([0-9]+)/,
    )?.[1] ?? '';
}

export function getTiktokEmbedUrl(id) {
    return `https://www.tiktok.com/embed/v2/${id}`;
}

export function getRedditEmbedUrl(video) {
    let url;
    try {
        url = new URL(video);
    } catch {
        return '';
    }

    const allowedHosts = ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com'];
    if (!allowedHosts.includes(url.hostname.toLowerCase())) {
        return '';
    }

    const match = url.pathname.match(/^\/r\/([\w-]+)\/comments\/([\da-z]+)(?:\/([^/]+))?\/?$/i);
    if (!match) {
        return '';
    }

    const [, subreddit, postId, slug = ''] = match;
    const postPath = `/r/${subreddit}/comments/${postId}${slug ? `/${slug}` : ''}/`;
    return `https://embed.reddit.com${postPath}?embed=true`;
}

export function embed(video) {
    if (video.includes('youtube.com') || video.includes('youtu.be')) {
        return `https://www.youtube.com/embed/${getYoutubeIdFromUrl(video)}`;
    } else if (video.includes('instagram.com')) {
        return getInstagramEmbedUrl(getInstagramIdFromUrl(video));
    } else if (video.includes('tiktok.com')) {
        return getTiktokEmbedUrl(getTiktokIdFromUrl(video));
    } else if (video.includes('reddit.com')) {
        return getRedditEmbedUrl(video);
    }
    return '';
}

export function localize(num) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 3 });
}

export function getThumbnailFromId(id) {
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }

    return array;
}

export async function fetchCsvPrefer(remoteUrl, localPath, timeoutMs = 6000) {
    const result = await fetchCsvPreferWithStatus(remoteUrl, localPath, timeoutMs);
    return result.text;
}

export async function fetchCsvPreferWithStatus(remoteUrl, localPath, timeoutMs = 6000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(remoteUrl, { signal: controller.signal, cache: 'no-store' });
        if (resp && resp.ok) {
            const text = await resp.text();
            return { text, source: 'published', checkedAt: new Date().toISOString() };
        }
        console.warn('fetchCsvPrefer: remote response not ok', resp && resp.status);
    } catch (err) {
        console.warn('fetchCsvPrefer: remote fetch failed', err && err.message);
    } finally {
        clearTimeout(timeout);
    }

    // fallback to local path
    try {
        const local = await fetch(localPath, { cache: 'no-store' });
        if (local && local.ok) {
            const text = await local.text();
            return { text, source: 'local', checkedAt: new Date().toISOString() };
        }
        throw new Error('Local fetch failed: ' + (local && local.status));
    } catch (err) {
        console.error('fetchCsvPrefer: both remote and local fetch failed', err && err.message);
        throw err;
    }
}

export function parseSummandsByPlayer(rows = []) {
    const headers = (rows[0] || []).map((header) => header.trim().toLowerCase());
    const playerIndex = headers.indexOf('player');
    const summandsIndex = headers.indexOf('summands');
    const summandsByPlayer = new Map();

    if (playerIndex === -1 || summandsIndex === -1) return summandsByPlayer;

    rows.slice(1).forEach((row) => {
        const player = (row[playerIndex] || '').trim().toLowerCase();
        if (!player) return;
        const summands = (row[summandsIndex] || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        summandsByPlayer.set(player, summands);
    });

    return summandsByPlayer;
}

export function describeCsvSource(results = []) {
    if (results.some((result) => result.source === 'local')) {
        return {
            state: 'warning',
            message: 'Local backup loaded; this data may be out of date.',
        };
    }

    if (results.length === 0 || results.some((result) => result.source !== 'published')) {
        return {
            state: 'warning',
            message: 'The published data could not be verified.',
        };
    }

    const checkedAt = Math.max(...results.map((result) => Date.parse(result.checkedAt) || 0));
    const time = new Date(checkedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    return {
        state: 'published',
        message: `Up to date on ${time}`,
    };
}

export function slugify(text = '') {
    return String(text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/%/g, '')
        .replace(/[\s\+/–—_.:,;!?()\[\]{}'"‘“”’`#@$*^=<>|\\]+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export function hashString(str = '') {
    let hash = 0x811c9dc5;
    const cleanStr = String(str || '').toLowerCase().trim();
    for (let i = 0; i < cleanStr.length; i++) {
        hash ^= cleanStr.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}

export function assignSlugsAndHashes(list = []) {
    const slugCounts = {};

    list.forEach((item) => {
        item.baseSlug = slugify(item.name) || 'entry';
        item.hash = hashString(`${item.name}|${item.player || ''}|${item.video || ''}|${item.date || ''}`);
        slugCounts[item.baseSlug] = (slugCounts[item.baseSlug] || 0) + 1;
    });

    const usedSlugs = new Set();

    list.forEach((item) => {
        let candidate = item.baseSlug;

        // If base name is shared by multiple entries, disambiguate with player name
        if (slugCounts[item.baseSlug] > 1 && item.player) {
            candidate = slugify(`${item.name}-${item.player}`);
        }

        // If candidate is still not unique, append part of hash
        if (usedSlugs.has(candidate)) {
            candidate = `${candidate}-${item.hash.slice(0, 4)}`;
        }

        usedSlugs.add(candidate);
        item.slug = candidate;
    });

    return list;
}

