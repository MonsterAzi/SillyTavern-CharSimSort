// Import necessary functions from SillyTavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { characters, getThumbnailUrl, saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

// A unique name for the extension to store its settings.
const extensionName = "character_similarity";

// Default settings that will be applied on first load.
const defaultSettings = {
    koboldUrl: 'http://127.0.0.1:5001',
};

// In-memory storage for the loaded embeddings.
// Map<avatar_filename, embedding_vector>
const characterEmbeddings = new Map();

// The fields from the character card that will be combined and sent for embedding.
const fieldsToEmbed = [
    'name',
    'description',
    'personality',
    'scenario',
    'first_mes',
    'mes_example',
];


/**
 * Populates the character list in the panel.
 * Should be called after the app is ready or when the panel is opened.
 */
function populateCharacterList() {
    // Sort characters alphabetically by name for the initial view
    const sortedCharacters = characters.slice().sort((a, b) => a.name.localeCompare(b.name));

    // Generate the HTML for each character item
    const characterListHtml = sortedCharacters.map(char => `
        <div class="charSim-character-item" data-avatar="${char.avatar}">
            <img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}'s avatar">
            <span>${char.name}</span>
        </div>
    `).join('');

    // Insert the generated list into its container
    $('#charSimCharacterList').html(characterListHtml);
}


/**
 * Fetches embeddings for all characters from the KoboldCpp API.
 */
async function onEmbeddingsLoad() {
    const koboldUrl = extension_settings[extensionName].koboldUrl;
    if (!koboldUrl) {
        toastr.warning('Please set the KoboldCpp URL in the extension settings first.');
        return;
    }

    // CORRECTED: Use the correct API endpoint for embeddings
    const apiUrl = `${koboldUrl.replace(/\/$/, "")}/api/extra/embeddings`;
    const buttons = $('#charSimLoadBtn, #charSimCalcBtn');
    let toastId = null;

    try {
        buttons.prop('disabled', true);
        characterEmbeddings.clear();
        toastId = toastr.info('Starting embedding process...', 'Loading Embeddings', { timeOut: 0, extendedTimeOut: 0, closeButton: true });

        for (const [index, char] of characters.entries()) {
            toastr.info(`Loading embedding for ${char.name} (${index + 1}/${characters.length})...`, 'Loading Embeddings', { toastId: toastId, timeOut: 0, extendedTimeOut: 0 });

            const textToEmbed = fieldsToEmbed
                .map(field => char[field] || '')
                .join('\n')
                .trim();

            if (!textToEmbed) {
                console.log(`Skipping character ${char.name} as it has no text data to embed.`);
                continue;
            }

            // CORRECTED: Use the correct request body format
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "kcpp",
                    input: textToEmbed,
                    truncate: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            // CORRECTED: Use the correct path to the embedding in the response
            const embedding = data?.data?.[0]?.embedding;

            if (!embedding || !Array.isArray(embedding)) {
                throw new Error(`Invalid embedding format received for ${char.name}.`);
            }

            characterEmbeddings.set(char.avatar, embedding);
        }

        toastr.remove(toastId);
        toastr.success(`Successfully loaded embeddings for ${characterEmbeddings.size} characters.`);

    } catch (error) {
        console.error('Failed to load embeddings:', error);
        toastr.remove(toastId);
        toastr.error(`An error occurred while loading embeddings: ${error.message}`, 'Error', { timeOut: 10000 });
    } finally {
        buttons.prop('disabled', false);
    }
}


/**
 * Main function that runs when the script is loaded.
 */
jQuery(() => {
    // --- SETTINGS PANEL ---
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(defaultSettings, extension_settings[extensionName]);
    Object.assign(extension_settings[extensionName], defaultSettings);

    const settingsHtml = `...`; // (HTML is unchanged, keeping it brief)
    $("#extensions_settings2").append(settingsHtml);
    $("#kobold_url_input").on("input", (event) => {
        const value = $(event.target).val();
        extension_settings[extensionName].koboldUrl = value;
        saveSettingsDebounced();
    });

    // --- MAIN SIMILARITY PANEL ---
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
                <!-- Character list will be populated on APP_READY -->
            </div>
        </div>
    </div>`;
    $('#movingDivs').append(panelHtml);

    // Attach event listeners for the panel and its controls
    $('#charSimCloseBtn').on('click', () => $('#characterSimilarityPanel').removeClass('open'));
    $('#charSimLoadBtn').on('click', onEmbeddingsLoad);
    $('#charSimCalcBtn').on('click', () => { /* Placeholder */ });
    $('#charSimSortBtn').on('click', function() { /* Placeholder */ });

    // --- CHARACTER PANEL BUTTON ---
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.title = 'Find Similar Characters';
    openButton.addEventListener('click', () => {
        // Re-populate the list each time the panel is opened to catch any new characters.
        populateCharacterList();
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

    // CORRECTED: Wait for the app to be fully ready before populating the initial list.
    eventSource.on(event_types.APP_READY, populateCharacterList);
});