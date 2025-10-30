import express from 'express';

const extensionName = 'character_similarity';
const defaultSettings = {
    koboldUrl: 'http://127.0.0.1:5001',
};

/**
 * Initializes the server plugin for Character Similarity.
 * @param {object} settings - The global server settings object.
 * @param {Function} saveSettings - Function to save the global settings.
 * @param {express.Application} expressApp - The Express application instance.
 */
export function load(settings, saveSettings, expressApp) {
    // Ensure settings for the extension exist
    settings.extensions = settings.extensions || {};
    settings.extensions[extensionName] = settings.extensions[extensionName] || {};
    Object.assign(defaultSettings, settings.extensions[extensionName]);
    Object.assign(settings.extensions[extensionName], defaultSettings);

    const router = express.Router();

    // Endpoint to get/set the KoboldCpp URL
    router.get('/settings', (req, res) => {
        res.json({ koboldUrl: settings.extensions[extensionName].koboldUrl });
    });

    router.post('/settings', (req, res) => {
        const { koboldUrl } = req.body;
        if (typeof koboldUrl === 'string') {
            settings.extensions[extensionName].koboldUrl = koboldUrl;
            saveSettings();
            res.json({ success: true, message: 'Settings saved.' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid koboldUrl provided.' });
        }
    });

    // The main proxy endpoint
    router.post('/proxy', async (req, res) => {
        const { input } = req.body;
        if (!input) {
            return res.status(400).json({ error: 'Missing "input" in request body.' });
        }

        const koboldUrl = settings.extensions[extensionName].koboldUrl;
        const apiUrl = `${koboldUrl.replace(/\/$/, "")}/api/extra/embeddings`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'kcpp',
                    input: input,
                    truncate: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`KoboldCpp API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            res.json(data);

        } catch (error) {
            console.error(`[${extensionName}] Proxy Error:`, error);
            res.status(502).json({ error: 'Failed to connect to KoboldCpp API.', details: error.message });
        }
    });

    // Register the router with SillyTavern's main app
    expressApp.use(`/api/extensions/${extensionName}`, router);
}