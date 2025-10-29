import { extension_settings } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';

// Keep track of where your extension is located, name should match folder name
const extensionName = "character-similarity";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Default settings for the extension
const defaultSettings = {
    embeddingUrl: 'http://127.0.0.1:5001/api/v1/embeddings',
};

/**
 * Loads the extension's settings, initializing them with defaults if they don't exist.
 */
function loadSettings() {
    //Create the settings if they don't exist
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    // Updating settings in the UI
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
jQuery(async () => {
    // Load the HTML file for the settings panel using the path.
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

    // Append settingsHtml to the right-hand settings column.
    $("#extensions_settings2").append(settingsHtml);

    // Attach the event listener to the input field now that it exists in the DOM.
    $('#char_sim_embedding_url').on('input', onEmbeddingUrlInput);

    // Load the initial settings value into the UI.
    loadSettings();
});