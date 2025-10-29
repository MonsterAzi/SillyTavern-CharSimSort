// SillyTavern functions are not available in workers by default.
// We must import them. The path is relative to the web root.
importScripts('/scripts/extensions.js');

// A standard function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += vecA[i] * vecA[i];
        magnitudeB += vecB[i] * vecB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

// Function to call the Extras API and get an embedding for a text
async function getEmbedding(text) {
    try {
        const url = new URL(self.getApiUrl());
        url.pathname = '/api/get_embeddings';

        const apiResult = await self.doExtrasFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (apiResult.ok) {
            const data = await apiResult.json();
            return data.embedding;
        } else {
            console.error('Extras API call failed:', apiResult.statusText);
            const errorText = await apiResult.text();
            console.error('Error details:', errorText);
            return null;
        }
    } catch (error) {
        console.error('Error fetching embedding:', error);
        return null;
    }
}


self.onmessage = async (event) => {
    const characters = event.data;
    const numCharacters = characters.length;
    const characterEmbeddings = [];

    // Step 1: Generate embeddings for all characters
    for (let i = 0; i < numCharacters; i++) {
        const char = characters[i];
        const combinedText = [
            char.name,
            char.description,
            char.personality,
            char.scenario,
            char.first_mes,
            char.mes_example,
        ].filter(Boolean).join('\n').trim();

        self.postMessage({
            type: 'progress',
            data: {
                message: `Generating embedding for: ${char.name} (${i + 1}/${numCharacters})`,
                progress: (i / (numCharacters * 2)) * 100, // Embedding is ~half the work
            },
        });

        if (!combinedText) {
            console.warn(`Skipping character ${char.name} due to empty text fields.`);
            continue;
        }

        const embedding = await getEmbedding(combinedText);
        if (embedding) {
            characterEmbeddings.push({ name: char.name, avatar: char.avatar, embedding });
        } else {
            console.warn(`Failed to get embedding for character ${char.name}.`);
        }
    }

    // Step 2: Calculate pairwise similarity
    const results = [];
    const numEmbeddings = characterEmbeddings.length;
    const totalPairs = (numEmbeddings * (numEmbeddings - 1)) / 2;
    let processedPairs = 0;

    for (let i = 0; i < numEmbeddings; i++) {
        for (let j = i + 1; j < numEmbeddings; j++) {
            const char1 = characterEmbeddings[i];
            const char2 = characterEmbeddings[j];
            const similarity = cosineSimilarity(char1.embedding, char2.embedding);
            results.push({
                char1: { name: char1.name, avatar: char1.avatar },
                char2: { name: char2.name, avatar: char2.avatar },
                similarity: similarity,
            });

            processedPairs++;
            if (processedPairs % 1000 === 0) { // Update progress periodically
                self.postMessage({
                    type: 'progress',
                    data: {
                        message: `Calculating similarities... (${processedPairs}/${totalPairs})`,
                        progress: 50 + (processedPairs / totalPairs) * 50, // Similarity calc is the other half
                    },
                });
            }
        }
    }

    // Step 3: Send final results back to the main thread
    self.postMessage({ type: 'result', data: results });
};