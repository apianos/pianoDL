import { getSocialVideoThumbnail } from '../_shared/video-thumbnail.js';

export async function onRequest({ request }) {
    if (request.method !== 'GET') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { Allow: 'GET' },
        });
    }

    const video = new URL(request.url).searchParams.get('video');
    if (!video) {
        return new Response('Missing video URL', { status: 400 });
    }

    const thumbnail = await getSocialVideoThumbnail(video);
    if (!thumbnail) {
        return new Response('Thumbnail unavailable', {
            status: 404,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    return new Response(null, {
        status: 302,
        headers: {
            Location: thumbnail,
            'Cache-Control': 'public, max-age=600',
        },
    });
}
