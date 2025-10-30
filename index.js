// Import necessary functions from Silly-Tavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { characters, getThumbnailUrl, saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

// A unique name for the extension to store its settings.
const extensionName = "character_similarity";

const defaultSettings = {
    koboldUrl: 'http://127.0.0.1:5001',
};

// In-memory storage for the loaded embeddings.
const characterEmbeddings = new Map();
// Stores the results of the last calculation: [{ avatar, name, distance }]
let similarityResults = [];

const fieldsToEmbed = [
    'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
];

/**
 * Populates the character list in the panel with an alphabetical, unscored list.
 */
function populateCharacterList() {
    const sortedCharacters = characters.slice().sort((a, b) => a.name.localeCompare(b.name));
    const characterListHtml = sortedCharacters.map(char => `
        <div class="charSim-character-item" data-avatar="${char.avatar}">
            <img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}'s avatar">
            <span class="charSim-name">${char.name}</span>
        </div>
    `).join('');
    $('#charSimCharacterList').html(characterListHtml);
}

/**
 * Renders the character list based on the calculated similarity scores and current sort direction.
 */
function renderSortedList() {
    if (similarityResults.length === 0) {
        // If there are no results, show the default list.
        populateCharacterList();
        return;
    }

    const isDescending = $('#charSimSortBtn').hasClass('fa-arrow-down');
    const sortedList = [...similarityResults]; // Create a copy to sort

    sortedList.sort((a, b) => {
        return isDescending ? b.distance - a.distance : a.distance - b.distance;
    });

    const characterListHtml = sortedList.map(result => `
        <div class="charSim-character-item" data-avatar="${result.avatar}">
            <img src="${getThumbnailUrl('avatar', result.avatar)}" alt="${result.name}'s avatar">
            <span class="charSim-name">${result.name}</span>
            <div class="charSim-score">${result.distance.toFixed(4)}</div>
        </div>
    `).join('');

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

    const apiUrl = `${koboldUrl.replace(/\/$/, "")}/api/extra/embeddings`;
    const buttons = $('#charSimLoadBtn, #charSimCalcBtn');
    let toastId = null;

    try {
        buttons.prop('disabled', true);
        characterEmbeddings.clear();
        similarityResults = []; // Clear old results

        toastId = toastr.info(
            `Loading embeddings for ${characters.length} characters... This may take a while.`,
            'Loading Embeddings',
            { timeOut: 0, extendedTimeOut: 0, closeButton: true }
        );

        for (const char of characters) {
            const textToEmbed = fieldsToEmbed
                .map(field => char[field] || '')
                .join('\n')
                .trim();

            if (!textToEmbed) {
                console.log(`Skipping character ${char.name} as it has no text data to embed.`);
                continue;
            }

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
                throw new Error(`API request failed for ${char.name} with status ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
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
        if (toastId) toastr.remove(toastId);
        toastr.error(`An error occurred while loading embeddings: ${error.message}`, 'Error', { timeOut: 10000 });
    } finally {
        buttons.prop('disabled', false);
    }
}

/**
 * Calculates the uniqueness score for each character and triggers a re-render of the list.
 */
function onCalculateSimilarities() {
    if (characterEmbeddings.size === 0) {
        toastr.warning('Please load character embeddings first by clicking "Load Embeddings".');
        return;
    }

    toastr.info('Calculating uniqueness scores...');

    const embeddings = Array.from(characterEmbeddings.values());
    const embeddingCount = embeddings.length;
    const dimension = embeddings[0].length;

    // 1. Calculate the mean embedding vector
    const meanEmbedding = new Array(dimension).fill(0);
    for (const vector of embeddings) {
        for (let i = 0; i < dimension; i++) {
            meanEmbedding[i] += vector[i];
        }
    }
    for (let i = 0; i < dimension; i++) {
        meanEmbedding[i] /= embeddingCount;
    }

    // 2. Calculate the L1 distance from the mean for each character
    const results = [];
    for (const [avatar, embedding] of characterEmbeddings.entries()) {
        let distance = 0;
        for (let i = 0; i < dimension; i++) {
            distance += Math.abs(embedding[i] - meanEmbedding[i]);
        }
        const char = characters.find(c => c.avatar === avatar);
        if (char) {
            results.push({ avatar: char.avatar, name: char.name, distance: distance });
        }
    }

    similarityResults = results;
    renderSortedList(); // Render the list with the new scores
    toastr.success('Similarity calculation complete.');
}

/**
 * Main function that runs when the script is loaded.
 */
jQuery(() => {
    // --- SETTINGS PANEL ---
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(defaultSettings, extension_settings[extensionName]);
    Object.assign(extension_settings[extensionName], defaultSettings);
    const settingsHtml = `...`; // Unchanged, omitted for brevity
    $("#extensions_settings2").append(settingsHtml);
    $("#kobold_url_input").on("input", (event) => {
        extension_settings[extensionName].koboldUrl = event.target.value;
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
                <div id="charSimSortBtn" class="menu_button menu_button_icon fa-solid fa.solid fa-arrow-down" title="Sort Descending"></div>
            </div>
            <div id="charSimCharacterList"></div>
        </div>
    </div>`;
    $('#movingDivs').append(panelHtml);

    // Attach event listeners for the panel and its controls
    $('#charSimCloseBtn').on('click', () => $('#characterSimilarityPanel').removeClass('open'));
    $('#charSimLoadBtn').on('click', onEmbeddingsLoad);
    $('#charSimCalcBtn').on('click', onCalculateSimilarities); // Hook up the calculation function

    $('#charSimSortBtn').on('click', function() {
        $(this).toggleClass('fa-arrow-down fa-arrow-up');
        $(this).attr('title', $(this).hasClass('fa-arrow-down') ? 'Sort Descending' : 'Sort Ascending');
        renderSortedList(); // Re-render the list with the new sort order
    });

    // --- CHARACTER PANEL BUTTON ---
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.title = 'Find Similar Characters';
    openButton.addEventListener('click', () => {
        // When opening, if we have results, show them. Otherwise, show the default list.
        if (similarityResults.length > 0) {
            renderSortedList();
        } else {
            populateCharacterList();
        }
        $('#characterSimilarityPanel').addClass('open');
    });
    const buttonContainer = document.getElementById('rm_buttons_container');
    if (buttonContainer) {
        buttonContainer.append(openButton);
    } else {
        document.getElementById('form_character_search_form').insertBefore(openButton, document.getElementById('character_search_bar'));
    }

    // Wait for the app to be fully ready before populating the initial list.
    eventSource.on(event_types.APP_READY, populateCharacterList);
});