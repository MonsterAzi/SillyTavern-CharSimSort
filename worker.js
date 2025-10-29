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

// Function to call an OpenAI-compatible embeddings endpoint
async function getEmbedding(text, apiUrl, apiKey, model) {
    if (!apiUrl) {
        self.postMessage({ type: 'error', data: 'API URL is not configured.' });
        return null;
    }

    const url = new URL(apiUrl);
    // Use the base path and append the standard embeddings endpoint
    url.pathname = (url.pathname.endsWith('/v1/') ? url.pathname.slice(0, -1) : url.pathname.replace(/\/v1$/, '')) + '/v1/embeddings';

    const headers = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = {
        input: text,
    };
    if (model) {
        body.model = model;
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            const friendlyError = `API Error (${response.status}): ${errorText.substring(0, 200)}`;
            console.error('API Error:', response.status, errorText);
            self.postMessage({ type: 'error', data: friendlyError });
            return null;
        }

        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].embedding) {
            return data.data[0].embedding;
        } else {
            console.error('Unexpected API response structure:', data);
            self.postMessage({ type: 'error', data: 'Embedding not found in API response. Check worker console for details.' });
            return null;
        }
    } catch (error) {
        console.error('Fetch failed:', error);
        self.postMessage({ type: 'error', data: `Network request failed: ${error.message}. Is the API server running and accessible?` });
        return null;
    }
}


self.onmessage = async (event) => {
    const { characters, settings } = event.data;
    const { apiUrl, apiKey, model } = settings;
    const numCharacters = characters.length;
    const characterEmbeddings = [];
    let hasError = false;

    // Step 1: Generate embeddings for all characters
    for (let i = 0; i < numCharacters; i++) {
        if (hasError) break; // Stop processing if an error occurred
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
                message: `Getting embedding for: ${char.name} (${i + 1}/${numCharacters})`,
                progress: (i / (numCharacters * 2)) * 100, // Embedding is ~half the work
            },
        });

        if (!combinedText) {
            console.warn(`Skipping character ${char.name} due to empty text fields.`);
            continue;
        }

        const embedding = await getEmbedding(combinedText, apiUrl, apiKey, model);
        if (embedding) {
            characterEmbeddings.push({ name: char.name, avatar: char.avatar, embedding });
        } else {
            console.warn(`Failed to get embedding for character ${char.name}.`);
            // The getEmbedding function will post a specific error, so we just set a flag to stop.
            hasError = true;
        }
    }

    if (hasError) return; // Exit worker if embedding failed

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
            if (processedPairs % 1000 === 0 || processedPairs === totalPairs) {
                self.postMessage({
                    type: 'progress',
                    data: {
                        message: `Calculating similarities... (${processedPairs}/${totalPairs})`,
                        progress: 50 + (processedPairs / totalPairs) * 50,
                    },
                });
            }
        }
    }

    self.postMessage({ type: 'result', data: results });
};