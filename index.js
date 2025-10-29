import { extension_settings, renderExtensionTemplateAsync } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';

// The name of the extension's folder.
const MODULE_NAME = 'character-similarity';

// Default settings for the extension.
const defaultSettings = {
    embeddingUrl: 'http://127.0.0.1:5001/api/v1/embeddings',
};

/**
 * Loads the extension's settings, initializing them with defaults if they don't exist.
 */
function loadSettings() {
    // Ensure the settings object for this extension exists.
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }

    // Merge defaults to handle new settings in future updates, then assign to the extension's settings.
    const settings = Object.assign({}, defaultSettings, extension_settings[MODULE_NAME]);
    extension_settings[MODULE_NAME] = settings;


    // Update the UI with the loaded settings.
    $('#char_sim_embedding_url').val(settings.embeddingUrl);
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
    // 1. Load the settings HTML from settings.html using the reliable built-in function.
    //    'MODULE_NAME' tells it which extension folder to look in.
    //    'settings' is the name of the file (settings.html).
    const settingsHtml = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');

    // 2. Append the loaded HTML to the correct settings panel.
    //    '#extensions_settings2' is the right-hand column in the extensions menu.
    $('#extensions_settings2').append(settingsHtml);

    // 3. Attach the event listener to the input field.
    //    This is done *after* the HTML is added to the DOM.
    $('#char_sim_embedding_url').on('input', onEmbeddingUrlInput);

    // 4. Load the initial settings value into the UI.
    loadSettings();
});