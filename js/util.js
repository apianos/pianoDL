export const SHOW_LIST_POINTS = true;
export const VERIFIED_CSV_PATH = '/data/pianoDL - piano achievement list (30).csv';
export const REMOTE_VERIFIED_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=702241830&single=true&output=csv';

export function parseCsv(text, delimiter = ',') {
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

export function isPastRank(rank = '', extra = '') {
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

export async function fetchVerifiedLevels() {
    const { text } = await fetchCsvPreferWithStatus(
        REMOTE_VERIFIED_CSV,
        VERIFIED_CSV_PATH,
    );
    const [header = [], ...rows] = parseCsv(text);
    const normalizeHeader = (value) =>
        value.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/\?/g, '');
    const findColumn = (names) =>
        header.findIndex((value) => names.includes(normalizeHeader(value)));
    const rankIndex = findColumn(['#', 'rank', 'x', 'id']);
    const nameIndex = findColumn(['name']);
    const tagIndex = findColumn(['column 1', 'tag', 'old', 'type']);
    const videoIndex = findColumn(['player video', 'video', 'link']);
    const difficultyIndex = findColumn(['difficulty']);
    const verifierIndex = findColumn(['verifier']);

    if ([rankIndex, nameIndex, videoIndex, verifierIndex].some((index) => index < 0)) {
        throw new Error('Verified-list CSV is missing required columns.');
    }

    const verifiedLevels = rows
        .filter((row) => {
            const tag = tagIndex < 0 ? row[4] : row[tagIndex];
            return (
                !isPastRank(row[rankIndex], tag) &&
                (row[verifierIndex] || '').trim().toLowerCase() === 'y' &&
                (row[nameIndex] || '').trim() !== ''
            );
        })
        .map((row, index) => ({
            rank: index + 1,
            name: row[nameIndex].trim(),
            video: (row[videoIndex] || '').trim(),
            difficulty: (difficultyIndex < 0 ? '' : row[difficultyIndex] || '')
                .trim()
                .replace(/\.png$/i, ''),
        }));

    if (verifiedLevels.length === 0) {
        throw new Error('Verified-list CSV contains no verified levels.');
    }

    return verifiedLevels;
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
