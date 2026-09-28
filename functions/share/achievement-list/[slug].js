import { assignSlugsAndHashes } from '../../../js/util.js';

const csvPath = '/data/pianoDL - piano achievement list (30).csv';
const remoteCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4hK8Pul9plvCZ0XYWEqQMFVEmPg50fsoUQeKg3Y6BuBEEiG8BE4UtmNxDG_xvgAZ_uZPXl5eptf5A/pub?gid=702241830&single=true&output=csv';
const fallbackImage = '/list_icon.png';

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let insideQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (insideQuotes) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    insideQuotes = false;
                }
            } else {
                field += character;
            }
        } else if (character === '"') {
            insideQuotes = true;
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
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
}

function isPastEntry(rank, tag) {
    return /^(?:old|past)(?:\b|\s)/i.test(String(rank || '').trim())
        || /^(?:old|past)(?:\b|\s)/i.test(String(tag || '').trim());
}

function getValue(row, indexes, keys) {
    for (const key of keys) {
        const index = indexes.get(key);
        if (index !== undefined && row[index]) return row[index].trim();
    }
    return '';
}

function parseAchievements(text) {
    const [header = [], ...rows] = parseCsv(text);
    const indexes = new Map(header.map((value, index) => [
        value.trim().toLowerCase().replace(/\?/g, ''),
        index,
    ]));

    const entries = rows.map((row) => {
        const name = getValue(row, indexes, ['name']);
        const rank = getValue(row, indexes, ['#', 'rank', 'x', 'id']);
        const tag = getValue(row, indexes, ['column 1', 'tag', 'old', 'type']);
        return {
            name,
            player: getValue(row, indexes, ['player', 'user']),
            video: getValue(row, indexes, ['player video', 'video', 'link']),
            date: getValue(row, indexes, ['date']),
            difficulty: getValue(row, indexes, ['difficulty']),
            rank,
            tag,
        };
    }).filter((entry) => entry.name && !isPastEntry(entry.rank, entry.tag));

    return assignSlugsAndHashes(entries).map((entry, index) => ({
        ...entry,
        rank: index + 1,
    }));
}

function isAchievementCsv(text) {
    const header = (parseCsv(text)[0] || []).join(' ').toLowerCase();
    return header.includes('name')
        && (header.includes('#') || header.includes('player video') || header.includes('player'));
}

async function getAchievementCsv(origin) {
    try {
        const response = await fetch(remoteCsv, { signal: AbortSignal.timeout(4000) });
        if (response.ok) {
            const text = await response.text();
            if (isAchievementCsv(text)) return text;
        }
    } catch {
        // Fall back to the checked-in data if the published sheet is unavailable.
    }

    const response = await fetch(new URL(csvPath, origin));
    if (!response.ok) throw new Error('Achievement CSV unavailable');
    const text = await response.text();
    if (!isAchievementCsv(text)) throw new Error('Achievement CSV has an invalid header');
    return text;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

function getYoutubeThumbnail(video) {
    let url;
    try {
        url = new URL(video);
    } catch {
        return '';
    }

    const hostname = url.hostname.toLowerCase();
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(hostname)) {
        return '';
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const id = hostname.endsWith('youtu.be')
        ? segments[0]
        : url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(segments[0]) ? segments[1] : '');
    return id && /^[\w-]{6,}$/.test(id)
        ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
        : '';
}

function isTikTokUrl(url) {
    return ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']
        .includes(url.hostname.toLowerCase());
}

function isInstagramUrl(url) {
    return ['instagram.com', 'www.instagram.com', 'm.instagram.com']
        .includes(url.hostname.toLowerCase())
        && /^\/(?:p|reel|reels|tv)\/[\w-]+\/?$/i.test(url.pathname);
}

async function fetchProviderThumbnail(endpoint, allowedHost) {
    try {
        const response = await fetch(endpoint, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return '';

        const thumbnail = new URL((await response.json()).thumbnail_url);
        if (thumbnail.protocol !== 'https:' || !allowedHost(thumbnail.hostname.toLowerCase())) {
            return '';
        }
        return thumbnail.href;
    } catch {
        return '';
    }
}

async function getTikTokThumbnail(video) {
    let url;
    try {
        url = new URL(video);
    } catch {
        return '';
    }

    if (!isTikTokUrl(url)) {
        return '';
    }

    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.href)}`;
    return fetchProviderThumbnail(endpoint, (hostname) => /(?:^|\.)tiktokcdn(?:-[a-z0-9]+)?\.com$/i.test(hostname));
}

async function getInstagramThumbnail(video) {
    let url;
    try {
        url = new URL(video);
    } catch {
        return '';
    }

    if (!isInstagramUrl(url)) return '';

    const endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url.href)}`;
    return fetchProviderThumbnail(endpoint, (hostname) => /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/i.test(hostname));
}

async function getPreviewImage(entry, origin) {
    const youtubeThumbnail = getYoutubeThumbnail(entry.video);
    if (youtubeThumbnail) return youtubeThumbnail;

    const tiktokThumbnail = await getTikTokThumbnail(entry.video);
    if (tiktokThumbnail) return tiktokThumbnail;

    const instagramThumbnail = await getInstagramThumbnail(entry.video);
    if (instagramThumbnail) return instagramThumbnail;

    return new URL(fallbackImage, origin).href;
}

function createSharePage(entry, origin, imageUrl) {
    const shareUrl = new URL(`/achievement-list/${encodeURIComponent(entry.slug)}`, origin).href;
    const title = `${entry.name}`;
    const description = [
        entry.player ? `Played by ${entry.player}` : '',
        `Achievement #${entry.rank}`,
        entry.difficulty ? entry.difficulty.replace(/-/g, ' ') : '',
    ].filter(Boolean).join(' · ');
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeImageUrl = escapeHtml(imageUrl);
    const safeShareUrl = escapeHtml(shareUrl);
    const metadata = `
<meta name="description" content="${safeDescription}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="pianoDL">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeShareUrl}">
<meta property="og:image" content="${safeImageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImageUrl}">`;

    return { metadata, safeTitle };
}

export async function onRequest({ request, params }) {
    const slug = String(params.slug || '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return new Response('Not found', { status: 404 });
    }

    const origin = new URL(request.url).origin;
    if (new URL(request.url).pathname.startsWith('/share/')) {
        return Response.redirect(new URL(`/achievement-list/${encodeURIComponent(slug)}`, origin), 301);
    }

    let csvText;
    try {
        csvText = await getAchievementCsv(origin);
    } catch {
        return new Response('Achievement data is temporarily unavailable.', {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    const entry = parseAchievements(csvText).find((item) => item.slug === slug);
    if (!entry) return new Response('Achievement not found', { status: 404 });

    const imageUrl = await getPreviewImage(entry, origin);
    const { metadata, safeTitle } = createSharePage(entry, origin, imageUrl);
    const appResponse = await fetch(new URL('/', origin));
    if (!appResponse.ok) {
        return new Response('Application shell is temporarily unavailable.', {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    let html = await appResponse.text();
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
    if (!/<\/head>/i.test(html)) {
        return new Response('Application shell has invalid HTML.', { status: 503 });
    }
    html = html.replace(/<\/head>/i, `${metadata}\n</head>`);

    return new Response(html, {
        headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
