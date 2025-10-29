import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';

// Should match the folder name of the extension
const MODULE_NAME = 'character-similarity';

// Default settings for the extension
const defaultSettings = {
    embeddingUrl: 'http://127.0.0.1:5001/api/v1/embeddings',
};

/**
 * Loads the extension's settings, initializing them with defaults if they don't exist.
 */
function loadSettings() {
    // Ensure the settings object exists
    if (Object.keys(extension_settings[MODULE_NAME] || {}).length === 0) {
        extension_settings[MODULE_NAME] = { ...defaultSettings };
    }

    // Merge defaults to handle new settings in future updates
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    // Update the UI with the loaded settings
    $('#char_sim_embedding_url').val(extension_settings[MODULE_NAME].embeddingUrl);
}

/**
 * Handles input changes for the Embedding URL setting.
 * @param {Event} event - The input event.
 */
function onEmbeddingUrlInput(event) {
    const value = $(event.target).val();
    extension_settings[MODULE_NAME].embeddingUrl = value;
    saveSettingsDebounced();
}

/**
 * This function is executed when the extension is loaded.
 */
jQuery(async function () {
    // Create a container for our settings panel in the UI
    const settingsContainer = `
        <div id="character-similarity-container" class="character-similarity-container"></div>
    `;
    // The right-side settings panel
    $('#extensions_settings2').append(settingsContainer);

    // Load and inject the HTML for the settings panel
    const settingsHtml = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    $('#character-similarity-container').append(settingsHtml);

    // Set up event listeners for the UI elements
    $('#char_sim_embedding_url').on('input', onEmbeddingUrlInput);

    // Load the initial settings
    loadSettings();
});