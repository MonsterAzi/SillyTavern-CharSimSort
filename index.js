import { extension_settings } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';

// Should match the folder name of the extension
const extensionName = 'character-similarity';
// Path to the extension's folder. This is important for $.get to find the files.
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Default settings for the extension
const defaultSettings = {
    embeddingUrl: 'http://127.0.0.1:5001/api/v1/embeddings',
};

/**
 * Loads the extension's settings, initializing them with defaults if they don't exist.
 */
function loadSettings() {
    // Ensure the settings object exists
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    // Merge defaults to handle new settings in future updates
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }

    // Update the UI with the loaded settings
    $('#char_sim_embedding_url').val(extension_settings[extensionName].embeddingUrl);
}

/**
 * Handles input changes for the Embedding URL setting.
 * @param {Event} event - The input event.
 */
function onEmbeddingUrlInput(event) {
    const value = $(event.target).val();
    extension_settings[extensionName].embeddingUrl = value;
    saveSettingsDebounced();
}

/**
 * This function is executed when the extension is loaded.
 */
jQuery(async function () {
    // Load the HTML file for the settings panel.
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

    // Append the loaded HTML to the right-side settings panel.
    $('#extensions_settings2').append(settingsHtml);

    // Set up event listeners for the UI elements.
    $('#char_sim_embedding_url').on('input', onEmbeddingUrlInput);

    // Load the initial settings.
    loadSettings();
});