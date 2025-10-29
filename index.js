// Import necessary functions from SillyTavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// A unique name for the extension to store its settings.
const extensionName = "character_similarity";

// Default settings that will be applied on first load.
const defaultSettings = {
    // We now only store the base URL.
    koboldUrl: 'http://127.0.0.1:5001',
};

/**
 * Main function that runs when the script is loaded.
 */
jQuery(() => {
    // 1. INITIALIZE SETTINGS
    // Ensure the settings object for this extension exists.
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    // Merge defaults into the settings object to ensure all keys are present.
    Object.assign(defaultSettings, extension_settings[extensionName]);
    Object.assign(extension_settings[extensionName], defaultSettings);


    // 2. CREATE THE SETTINGS UI HTML
    // Create the HTML string with current settings values embedded directly.
    const settingsHtml = `
    <div class="character-similarity-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Character Similarity</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="character-similarity_block">
                    <label for="kobold_url_input">KoboldCpp URL</label>
                    <input
                        id="kobold_url_input"
                        class="text_pole"
                        type="text"
                        value="${extension_settings[extensionName].koboldUrl}"
                        placeholder="http://127.0.0.1:5001"
                    >
                    <small>The base URL for your KoboldCpp instance.</small>
                </div>
            </div>
        </div>
    </div>`;


    // 3. INJECT THE HTML INTO THE DOM
    // Append the created HTML to the settings panel in the right column.
    $("#extensions_settings2").append(settingsHtml);


    // 4. ATTACH EVENT LISTENERS
    // Now that the HTML is in the DOM, we can safely attach event listeners.
    $("#kobold_url_input").on("input", (event) => {
        const value = $(event.target).val();
        // Save the updated base URL to settings.
        extension_settings[extensionName].koboldUrl = value;
        saveSettingsDebounced();
    });
});