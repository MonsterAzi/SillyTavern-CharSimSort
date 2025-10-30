// A web worker to perform heavy clustering calculations in the background.

// Import the clustering library from a CDN.
importScripts('https://cdn.jsdelivr.net/npm/set-clustering@1.1.0/dist/index.min.js');

// --- Vector Math Functions ---

function dotProduct(vecA, vecB) {
    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
        product += vecA[i] * vecB[i];
    }
    return product;
}

function magnitude(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}

function cosineSimilarity(vecA, vecB) {
    const dot = dotProduct(vecA, vecB);
    const magA = magnitude(vecA);
    const magB = magnitude(vecB);
    if (magA === 0 || magB === 0) return 0;
    const similarity = dot / (magA * magB);
    return (similarity + 1) / 2;
}

// Listen for messages from the main thread.
self.onmessage = function(event) {
    try {
        const { embeddings, threshold } = event.data;

        // --- Progress Reporting Setup ---
        const n = embeddings.length;
        const totalRuns = (n * (n - 1)) / 2;
        let run = 0;
        let lastPercent = -1;

        const clusterer = cluster(embeddings, (a, b) => {
            // Increment counter and report progress
            run++;
            const percent = Math.floor((run / totalRuns) * 100);
            if (percent > lastPercent) {
                self.postMessage({ type: 'progress', data: { percent } });
                lastPercent = percent;
            }

            // Return the actual similarity
            return cosineSimilarity(a.embedding, b.embedding);
        });

        const groups = clusterer.similarGroups(threshold);
        const resultAvatarGroups = groups.map(group => group.map(item => item.id));

        // Send the final result
        self.postMessage({ type: 'result', data: resultAvatarGroups });

    } catch (error) {
        // Send any errors back to the main thread
        self.postMessage({ type: 'error', data: { message: error.message, stack: error.stack } });
    }
};