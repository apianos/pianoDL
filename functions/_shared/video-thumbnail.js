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

    if (!isTikTokUrl(url)) return '';

    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.href)}`;
    return fetchProviderThumbnail(endpoint, (hostname) =>
        /(?:^|\.)tiktokcdn(?:-[a-z0-9]+)?\.com$/i.test(hostname),
    );
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
    return fetchProviderThumbnail(endpoint, (hostname) =>
        /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/i.test(hostname),
    );
}

export async function getSocialVideoThumbnail(video) {
    return (await getTikTokThumbnail(video)) || getInstagramThumbnail(video);
}
