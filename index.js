// Import necessary functions from SillyTavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// A unique name for the extension to store its settings.
const extensionName = "character_similarity";

// Default settings that will be applied on first load.
const defaultSettings = {
    koboldUrl: 'http://127.0.0.1:5001',
};

/**
 * Main function that runs when the script is loaded.
 */
jQuery(() => {
    // --- SETTINGS PANEL ---
    // 1. INITIALIZE SETTINGS
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(defaultSettings, extension_settings[extensionName]);
    Object.assign(extension_settings[extensionName], defaultSettings);

    // 2. CREATE THE SETTINGS UI HTML
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

    // 3. INJECT THE SETTINGS HTML INTO THE DOM
    $("#extensions_settings2").append(settingsHtml);

    // 4. ATTACH EVENT LISTENERS FOR SETTINGS
    $("#kobold_url_input").on("input", (event) => {
        const value = $(event.target).val();
        extension_settings[extensionName].koboldUrl = value;
        saveSettingsDebounced();
    });

    // --- CHARACTER PANEL BUTTON ---
    // 1. CREATE THE BUTTON ELEMENT
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    // Using classes from dupefinder and SillyTavern for consistent styling.
    // 'fa-project-diagram' is a fitting icon for showing relationships/similarity.
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.dataset.i18n = '[title]Find Similar Characters';
    openButton.title = 'Find Similar Characters';

    // Add a placeholder click listener
    openButton.addEventListener('click', () => {
        console.log('Character Similarity button clicked!');
        // In the future, this will open the main UI panel.
        toastr.info("The Character Similarity panel is not yet implemented.");
    });

    // 2. INJECT THE BUTTON INTO THE DOM
    // This logic is adapted from the dupefinder extension for robustness.
    // It tries to find the recommended container, and falls back to another location if not found.
    const buttonContainer = document.getElementById('rm_buttons_container');
    if (buttonContainer) {
        buttonContainer.append(openButton);
    } else {
        const searchForm = document.getElementById('form_character_search_form');
        const searchBar = document.getElementById('character_search_bar');
        searchForm.insertBefore(openButton, searchBar);
    }
});