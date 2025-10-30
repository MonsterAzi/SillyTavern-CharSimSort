// A web worker to perform heavy clustering calculations in the background.

// Import the clustering library from a CDN.
// This is a simple way to get external libraries into a worker without a complex build setup.
importScripts('https://cdn.jsdelivr.net/npm/set-clustering@1.1.0/dist/index.min.js');

// --- Vector Math Functions ---

/**
 * Calculates the dot product of two vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
function dotProduct(vecA, vecB) {
    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
        product += vecA[i] * vecB[i];
    }
    return product;
}

/**
 * Calculates the magnitude (length) of a vector.
 * @param {number[]} vec
 * @returns {number}
 */
function magnitude(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}

/**
 * Calculates the cosine similarity between two vectors.
 * The result is normalized to a [0, 1] range, where 1 is identical.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
function cosineSimilarity(vecA, vecB) {
    const dot = dotProduct(vecA, vecB);
    const magA = magnitude(vecA);
    const magB = magnitude(vecB);
    if (magA === 0 || magB === 0) return 0; // Prevent division by zero if a vector is all zeros.
    const similarity = dot / (magA * magB);
    // The clustering library expects a value from 0 to 1.
    // Cosine similarity is in the range [-1, 1], so we scale it.
    return (similarity + 1) / 2;
}


// Listen for messages from the main thread.
self.onmessage = function(event) {
    const { embeddings, threshold } = event.data;

    // The library expects an array of items and a function to compare any two items.
    // Our items are objects with an id (avatar) and the embedding vector.
    const clusterer = cluster(embeddings, (a, b) => cosineSimilarity(a.embedding, b.embedding));

    // Get groups of items that meet the similarity threshold.
    const groups = clusterer.similarGroups(threshold);

    // We only need to send back the IDs (avatars), not the full embedding vectors, to save memory.
    const resultAvatarGroups = groups.map(group => group.map(item => item.id));

    // Send the results back to the main thread.
    self.postMessage(resultAvatarGroups);
};