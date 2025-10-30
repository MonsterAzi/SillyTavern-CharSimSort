// Import necessary functions from SillyTavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { characters, getThumbnailUrl, saveSettingsDebounced } from "../../../../script.js";

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
    // 1. CREATE THE PANEL HTML WITH PLACEHOLDERS FOR CONTENT
    // FIXED: Removed conflicting classes from the header div.
    const panelHtml = `
    <div id="characterSimilarityPanel" class="draggable">
        <div class="charSimPanel-header">
            <div class="fa-solid fa-grip drag-grabber"></div>
            <b>Character Similarity</b>
            <div id="charSimCloseBtn" class="fa-solid fa-circle-xmark floating_panel_close"></div>
        </div>
        <div class="charSimPanel-body">
            <div class="charSimPanel-controls">
                <div id="charSimLoadBtn" class="menu_button">Load Embeddings</div>
                <div id="charSimCalcBtn" class="menu_button">Calculate Similarities</div>
                <div class="spacer"></div>
                <div id="charSimSortBtn" class="menu_button menu_button_icon fa-solid fa-arrow-down" title="Sort Descending"></div>
            </div>
            <div id="charSimCharacterList">
                <!-- Character list will be dynamically inserted here -->
            </div>
        </div>
    </div>
    `;

    // 2. INJECT THE PANEL HTML INTO THE DOM
    $('#movingDivs').append(panelHtml);

    // 3. POPULATE THE CHARACTER LIST
    const sortedCharacters = characters.slice().sort((a, b) => a.name.localeCompare(b.name));
    const characterListHtml = sortedCharacters.map(char => `
        <div class="charSim-character-item">
            <img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}'s avatar">
            <span>${char.name}</span>
        </div>
    `).join('');
    $('#charSimCharacterList').html(characterListHtml);


    // 4. ATTACH EVENT LISTENERS FOR THE PANEL AND ITS CONTROLS
    $('#charSimCloseBtn').on('click', () => {
        $('#characterSimilarityPanel').removeClass('open');
    });
    $('#charSimLoadBtn').on('click', () => {
        toastr.info('This will eventually load embeddings for all characters.', 'WIP');
        console.log('Load Embeddings clicked');
    });
    $('#charSimCalcBtn').on('click', () => {
        toastr.info('This will eventually calculate and display similarities.', 'WIP');
        console.log('Calculate Similarities clicked');
    });
    $('#charSimSortBtn').on('click', function() {
        $(this).toggleClass('fa-arrow-down fa-arrow-up');
        if ($(this).hasClass('fa-arrow-down')) {
            $(this).attr('title', 'Sort Descending');
            console.log('Sort direction: Descending');
        } else {
            $(this).attr('title', 'Sort Ascending');
            console.log('Sort direction: Ascending');
        }
    });

    // --- CHARACTER PANEL BUTTON ---
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.dataset.i18n = '[title]Find Similar Characters';
    openButton.title = 'Find Similar Characters';
    openButton.addEventListener('click', () => {
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