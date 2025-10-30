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
    // (This part remains unchanged)
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(defaultSettings, extension_settings[extensionName]);
    Object.assign(extension_settings[extensionName], defaultSettings);

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

    $("#extensions_settings2").append(settingsHtml);

    $("#kobold_url_input").on("input", (event) => {
        const value = $(event.target).val();
        extension_settings[extensionName].koboldUrl = value;
        saveSettingsDebounced();
    });

    // --- MAIN SIMILARITY PANEL ---
    // 1. CREATE THE PANEL HTML
    const panelHtml = `
    <div id="characterSimilarityPanel" class="draggable">
        <div class="charSimPanel-header panelControlBar flex-container">
            <div class="fa-solid fa-grip drag-grabber" style="cursor: grab;"></div>
            <b>Character Similarity</b>
            <div id="charSimCloseBtn" class="fa-solid fa-circle-xmark floating_panel_close"></div>
        </div>
        <div class="charSimPanel-body">
            <p>Similarity results will be displayed here.</p>
        </div>
    </div>
    `;

    // 2. INJECT THE PANEL HTML INTO THE DOM
    // #movingDivs is the container for floating UI elements in SillyTavern
    $('#movingDivs').append(panelHtml);

    // 3. ATTACH EVENT LISTENERS FOR THE PANEL
    $('#charSimCloseBtn').on('click', () => {
        $('#characterSimilarityPanel').removeClass('open');
    });


    // --- CHARACTER PANEL BUTTON ---
    // (This part is mostly the same, but the click listener is updated)
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.dataset.i18n = '[title]Find Similar Characters';
    openButton.title = 'Find Similar Characters';

    // Update the click listener to show the panel
    openButton.addEventListener('click', () => {
        console.log('Character Similarity button clicked!');
        // Show the panel by adding the 'open' class
        $('#characterSimilarityPanel').addClass('open');
    });

    const buttonContainer = document.getElementById('rm_buttons_container');
    if (buttonContainer) {
        buttonContainer.append(openButton);
    } else {
        const searchForm = document.getElementById('form_character_search_form');
        const searchBar = document.getElementById('character_search_bar');
        searchForm.insertBefore(openButton, searchBar);
    }
});