// Import necessary functions from Silly-Tavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { characters, getThumbnailUrl, saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "character_similarity";

const defaultSettings = {
    koboldUrl: 'http://127.0.0.1:5001',
    clusterThreshold: 0.95,
};

const characterEmbeddings = new Map();
let uniquenessResults = [];
let clusterResults = []; // Now stores [{ clusterUniqueness, members: [{...}] }]
let libraryMeanEmbedding = []; // To store the average of all character embeddings

const fieldsToEmbed = [
    'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
];

function populateCharacterList() {
    const sortedCharacters = characters.slice().sort((a, b) => a.name.localeCompare(b.name));
    const characterListHtml = sortedCharacters.map(char => `
        <div class="charSim-character-item" data-avatar="${char.avatar}">
            <img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}'s avatar">
            <span class="charSim-name">${char.name}</span>
        </div>
    `).join('');
    $('#charSimUniquenessList').html(characterListHtml);
}

function renderUniquenessList() {
    if (uniquenessResults.length === 0) { populateCharacterList(); return; }
    const isDescending = $('#charSimSortBtn').hasClass('fa-arrow-down');
    const sortedList = [...uniquenessResults].sort((a, b) => isDescending ? b.distance - a.distance : a.distance - b.distance);
    const characterListHtml = sortedList.map(result => `
        <div class="charSim-character-item" data-avatar="${result.avatar}">
            <img src="${getThumbnailUrl('avatar', result.avatar)}" alt="${result.name}'s avatar">
            <span class="charSim-name">${result.name}</span>
            <div class="charSim-score">${result.distance.toFixed(4)}</div>
        </div>
    `).join('');
    $('#charSimUniquenessList').html(characterListHtml);
}

function renderClusterList() {
    const container = $('#charSimClusteringList');
    container.html('');

    if (clusterResults.length === 0) {
        container.html('<p class="charSim-no-results">No similar character groups found at this threshold.</p>');
        return;
    }

    clusterResults.forEach((cluster, index) => {
        const groupEl = $(`
            <div class="charSim-cluster-group">
                <div class="charSim-cluster-header">
                    Cluster Uniqueness: <span class="charSim-cluster-score">${cluster.clusterUniqueness.toFixed(4)}</span>
                </div>
            </div>
        `);
        cluster.members.forEach(member => {
            const charEl = $(`
                <div class="charSim-character-item" data-avatar="${member.avatar}">
                    <img src="${getThumbnailUrl('avatar', member.avatar)}" alt="${member.name}'s avatar">
                    <span class="charSim-name">${member.name}</span>
                    <div class="charSim-score" title="Distance from cluster center">${member.localDistance.toFixed(4)}</div>
                </div>
            `);
            groupEl.append(charEl);
        });
        container.append(groupEl);

        // Add delimiter between groups, but not after the last one
        if (index < clusterResults.length - 1) {
            container.append('<hr class="charSim-cluster-delimiter">');
        }
    });
}


async function onEmbeddingsLoad() {
    // ... (This function is unchanged)
    const koboldUrl = extension_settings[extensionName].koboldUrl;
    if (!koboldUrl) { toastr.warning('Please set the KoboldCpp URL in the extension settings first.'); return; }
    const apiUrl = `${koboldUrl.replace(/\/$/, "")}/api/extra/embeddings`;
    const buttons = $('#charSimLoadBtn, #charSimCalcUniquenessBtn, #charSimCalcClustersBtn');
    let toastId = null;
    try {
        buttons.prop('disabled', true);
        characterEmbeddings.clear();
        uniquenessResults = []; clusterResults = [];
        toastId = toastr.info(`Loading embeddings for ${characters.length} characters...`, 'Loading Embeddings', { timeOut: 0, extendedTimeOut: 0 });
        for (const char of characters) {
            const textToEmbed = fieldsToEmbed.map(field => char[field] || '').join('\n').trim();
            if (!textToEmbed) continue;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: "kcpp", input: textToEmbed, truncate: true }), });
            if (!response.ok) throw new Error(`API request failed for ${char.name}: ${response.status}`);
            const data = await response.json();
            const embedding = data?.data?.[0]?.embedding;
            if (!embedding) throw new Error(`Invalid embedding format for ${char.name}.`);
            characterEmbeddings.set(char.avatar, embedding);
        }
        toastr.remove(toastId);
        toastr.success(`Successfully loaded embeddings for ${characterEmbeddings.size} characters.`);
    } catch (error) {
        if (toastId) toastr.remove(toastId);
        toastr.error(`Error loading embeddings: ${error.message}`, 'Error');
    } finally {
        buttons.prop('disabled', false);
    }
}

function calculateLibraryMean() {
    const embeddings = Array.from(characterEmbeddings.values());
    if (embeddings.length === 0) return [];
    const dimension = embeddings[0].length;
    const mean = new Array(dimension).fill(0);
    embeddings.forEach(vector => {
        for (let i = 0; i < dimension; i++) mean[i] += vector[i];
    });
    for (let i = 0; i < dimension; i++) mean[i] /= embeddings.length;
    libraryMeanEmbedding = mean;
}

function onCalculateUniqueness() {
    if (characterEmbeddings.size === 0) { toastr.warning('Please load character embeddings first.'); return; }
    toastr.info('Calculating uniqueness scores...');
    
    // Ensure library mean is calculated
    if (libraryMeanEmbedding.length === 0) {
        calculateLibraryMean();
    }
    
    const results = [];
    for (const [avatar, embedding] of characterEmbeddings.entries()) {
        let distance = 0;
        for (let i = 0; i < libraryMeanEmbedding.length; i++) distance += Math.abs(embedding[i] - libraryMeanEmbedding[i]);
        const char = characters.find(c => c.avatar === avatar);
        if (char) results.push({ avatar: char.avatar, name: char.name, distance });
    }
    uniquenessResults = results;
    renderUniquenessList();
    toastr.success('Uniqueness calculation complete.');
}

function onCalculateClusters() {
    if (characterEmbeddings.size === 0) { toastr.warning('Please load character embeddings first.'); return; }

    // Ensure library mean is calculated for cluster uniqueness
    if (libraryMeanEmbedding.length === 0) {
        calculateLibraryMean();
    }

    const threshold = extension_settings[extensionName].clusterThreshold;
    const buttons = $('#charSimLoadBtn, #charSimCalcUniquenessBtn, #charSimCalcClustersBtn');
    let toastId = toastr.info(`Calculating clusters at ${threshold.toFixed(2)} threshold...`, 'Clustering', { timeOut: 0, extendedTimeOut: 0 });
    buttons.prop('disabled', true);

    const workerCode = `...`; // Worker code is unchanged, omitted for brevity
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (event) => {
        const rawGroups = event.data.filter(group => group.length > 1);
        const dimension = libraryMeanEmbedding.length;
        const newResults = [];

        rawGroups.forEach(group => {
            const groupEmbeddings = group.map(member => characterEmbeddings.get(member.avatar));
            
            // 1. Calculate the mean embedding for this specific cluster
            const clusterMean = new Array(dimension).fill(0);
            groupEmbeddings.forEach(vector => {
                for (let i = 0; i < dimension; i++) clusterMean[i] += vector[i];
            });
            for (let i = 0; i < dimension; i++) clusterMean[i] /= group.length;

            // 2. Calculate the cluster's uniqueness (distance from library mean)
            let clusterUniqueness = 0;
            for (let i = 0; i < dimension; i++) {
                clusterUniqueness += Math.abs(clusterMean[i] - libraryMeanEmbedding[i]);
            }

            // 3. Calculate local distance for each member and sort them
            const members = group.map(member => {
                const embedding = characterEmbeddings.get(member.avatar);
                let localDistance = 0;
                for (let i = 0; i < dimension; i++) {
                    localDistance += Math.abs(embedding[i] - clusterMean[i]);
                }
                const char = characters.find(c => c.avatar === member.avatar);
                return { avatar: char.avatar, name: char.name, localDistance };
            }).sort((a, b) => a.localDistance - b.localDistance); // Sort by local distance ascending

            newResults.push({ clusterUniqueness, members });
        });

        // Sort the clusters themselves by their uniqueness, descending
        newResults.sort((a, b) => b.clusterUniqueness - a.clusterUniqueness);

        clusterResults = newResults;
        renderClusterList();
        toastr.remove(toastId);
        toastr.success(`Clustering complete. Found ${clusterResults.length} groups.`);
        buttons.prop('disabled', false);
        worker.terminate();
    };
    worker.onerror = (error) => { /* ... (unchanged) */ };
    worker.postMessage({ embeddings: characterEmbeddings, threshold });
}

jQuery(() => {
    // --- SETTINGS ---
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(defaultSettings, extension_settings[extensionName]);
    Object.assign(extension_settings[extensionName], defaultSettings);
    const settingsHtml = `...`; // Unchanged, omitted for brevity
    $("#extensions_settings2").append(settingsHtml);
    $("#kobold_url_input").on("input", (event) => { /* ... (unchanged) */ });

    // --- MAIN PANEL ---
    const panelHtml = `
    <div id="characterSimilarityPanel" class="draggable">
        <div class="charSimPanel-header">
            <div class="fa-solid fa-grip drag-grabber"></div><b>Character Similarity</b><div id="charSimCloseBtn" class="fa-solid fa-circle-xmark floating_panel_close"></div>
        </div>
        <div class="charSimPanel-body">
            <div class="charSim-tabs">
                <div class="charSim-tab-button active" data-tab="uniqueness">Uniqueness</div>
                <div class="charSim-tab-button" data-tab="clustering">Clustering</div>
            </div>
            <div id="charSimUniquenessView" class="charSim-tab-pane active">
                <div class="charSimPanel-controls">
                    <div id="charSimLoadBtn" class="menu_button">Load Embeddings</div>
                    <div id="charSimCalcUniquenessBtn" class="menu_button">Calculate Uniqueness</div>
                    <div class="spacer"></div>
                    <div id="charSimSortBtn" class="menu_button menu_button_icon fa-solid fa-arrow-down" title="Sort Descending"></div>
                </div>
                <div id="charSimUniquenessList" class="charSim-list-container"></div>
            </div>
            <div id="charSimClusteringView" class="charSim-tab-pane">
                <div class="charSimPanel-controls">
                    <div id="charSimCalcClustersBtn" class="menu_button">Calculate Clusters</div>
                    <div class="spacer"></div>
                    <label for="charSimThresholdSlider">Threshold: <span id="charSimThresholdValue">${defaultSettings.clusterThreshold.toFixed(2)}</span></label>
                    <input type="range" id="charSimThresholdSlider" min="0.5" max="1.0" step="0.01" value="${defaultSettings.clusterThreshold}">
                </div>
                <div id="charSimClusteringList" class="charSim-list-container">
                    <p class="charSim-no-results">Load embeddings and click "Calculate Clusters" to see results.</p>
                </div>
            </div>
        </div>
    </div>`;
    $('#movingDivs').append(panelHtml);

    // --- EVENT LISTENERS ---
    $('#charSimCloseBtn').on('click', () => $('#characterSimilarityPanel').removeClass('open'));
    $('#charSimLoadBtn').on('click', onEmbeddingsLoad);
    $('#charSimCalcUniquenessBtn').on('click', onCalculateUniqueness);
    $('#charSimCalcClustersBtn').on('click', onCalculateClusters);
    $('#charSimSortBtn').on('click', function() { $(this).toggleClass('fa-arrow-down fa-arrow-up'); $(this).attr('title', $(this).hasClass('fa-arrow-down') ? 'Sort Descending' : 'Sort Ascending'); renderUniquenessList(); });
    $('.charSim-tab-button').on('click', function() { const tab = $(this).data('tab'); $('.charSim-tab-button, .charSim-tab-pane').removeClass('active'); $(this).addClass('active'); $(`#charSim${tab.charAt(0).toUpperCase() + tab.slice(1)}View`).addClass('active'); });
    $('#charSimThresholdSlider').on('input', function() { const value = parseFloat($(this).val()); $('#charSimThresholdValue').text(value.toFixed(2)); extension_settings[extensionName].clusterThreshold = value; saveSettingsDebounced(); });

    // --- CHARACTER PANEL BUTTON ---
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.title = 'Find Similar Characters';
    openButton.addEventListener('click', () => { if (uniquenessResults.length > 0) renderUniquenessList(); else populateCharacterList(); $('#characterSimilarityPanel').addClass('open'); });
    const buttonContainer = document.getElementById('rm_buttons_container');
    if (buttonContainer) buttonContainer.append(openButton);
    else document.getElementById('form_character_search_form').insertBefore(openButton, document.getElementById('character_search_bar'));

    eventSource.on(event_types.APP_READY, populateCharacterList);
});