import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "character_similarity";

// Default settings for the extension
const defaultSettings = {
    embeddingUrl: 'http://127.0.0.1:5001/api/v1/embedding',
};

// Function to load and initialize settings
function loadSettings() {
    // Ensure the settings object exists
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    // Check for missing settings and apply defaults
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }

    // Update the UI with the loaded settings
    $("#embedding_url_input").val(extension_settings[extensionName].embeddingUrl);
}

// This function is called when the Embedding URL input is changed
function onUrlInput(event) {
    const value = $(event.target).val();
    extension_settings[extensionName].embeddingUrl = value;
    saveSettingsDebounced();
}


// This function is called when the extension is loaded
jQuery(() => {
    // Define the HTML for the settings panel
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
                    <input id="embedding_url_input" class="text_pole" type="text" placeholder="http://127.0.0.1:5001/api/v1/embedding">
                    <small>The URL for your KoboldCpp embedding API endpoint.</small>
                </div>
                <hr class="sysHR" />
            </div>
        </div>
    </div>`;

    // Append the settings HTML to the extension settings section in SillyTavern
    // We use extensions_settings2 for the right column
    $("#extensions_settings2").append(settingsHtml);

    // Add an event listener for the input field
    $("#embedding_url_input").on("input", onUrlInput);

    // Load the initial settings
    loadSettings();
});