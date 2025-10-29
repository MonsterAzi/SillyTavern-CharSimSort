import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "character_similarity";

const defaultSettings = {
    embeddingUrl: 'http://127.0.0.1:5001/api/v1/embedding',
};

/**
 * Loads the extension settings, initializing them with defaults if they don't exist.
 * This function only deals with the settings object, not the UI.
 */
function loadSettings() {
    // Ensure the settings object for this extension exists.
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    // Apply default settings for any keys that are missing.
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

/**
 * Handles the input event for the Embedding URL field.
 * Updates the settings object and saves it.
 * @param {Event} event
 */
function onUrlInput(event) {
    const value = $(event.target).val();
    extension_settings[extensionName].embeddingUrl = value;
    saveSettingsDebounced();
}


/**
 * Main entry point for the extension.
 * This is executed when the DOM is ready.
 */
jQuery(() => {
    // 1. Load settings into the extension_settings object.
    loadSettings();

    // 2. Define the HTML for the settings panel, embedding the current settings value directly.
    const settingsHtml = `
    <div class="character-similarity-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Character Similarity</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="character-similarity_block">
                    <label for="embedding_url_input">Embedding URL</label>
                    <input
                        id="embedding_url_input"
                        class="text_pole"
                        type="text"
                        value="${extension_settings[extensionName].embeddingUrl}"
                        placeholder="http://127.0.0.1:5001/api/v1/embedding"
                    >
                    <small>The URL for your KoboldCpp embedding API endpoint.</small>
                </div>
                <hr class="sysHR" />
            </div>
        </div>
    </div>`;

    // 3. Append the settings HTML to the SillyTavern UI.
    $("#extensions_settings2").append(settingsHtml);

    // 4. Attach the event listener to the newly created input field.
    $("#embedding_url_input").on("input", onUrlInput);
});