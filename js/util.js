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

export function embed(video) {
    if (video.includes('youtube.com') || video.includes('youtu.be')) {
        return `https://www.youtube.com/embed/${getYoutubeIdFromUrl(video)}`;
    } else if (video.includes('instagram.com')) {
        return getInstagramEmbedUrl(getInstagramIdFromUrl(video));
    } else if (video.includes('tiktok.com')) {
        return getTiktokEmbedUrl(getTiktokIdFromUrl(video));
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
