// Import necessary functions from SillyTavern's core scripts.
import { extension_settings } from "../../../extensions.js";
import { characters, getThumbnailUrl, saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "character_similarity";

const defaultSettings = {
    koboldUrl: 'http://127.0.0.1:5001',
    clusterThreshold: 0.95,
};

const characterEmbeddings = new Map();
let similarityResults = [];
let clusterResults = [];

const fieldsToEmbed = [
    'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
];

const clusterWorker = new Worker(new URL('./clustering.worker.js', import.meta.url));

function renderUniquenessList() {
    const listContainer = $('#charSimUniquenessList');
    if (similarityResults.length === 0) {
        const sortedChars = characters.slice().sort((a, b) => a.name.localeCompare(b.name));
        const html = sortedChars.map(char => `
            <div class="charSim-character-item" data-avatar="${char.avatar}">
                <img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}'s avatar">
                <span class="charSim-name">${char.name}</span>
            </div>
        `).join('');
        listContainer.html(html);
        return;
    }
    const isDescending = $('#charSimSortBtn').hasClass('fa-arrow-down');
    const sortedList = [...similarityResults].sort((a, b) => isDescending ? b.distance - a.distance : a.distance - b.distance);
    const html = sortedList.map(result => `
        <div class="charSim-character-item" data-avatar="${result.avatar}">
            <img src="${getThumbnailUrl('avatar', result.avatar)}" alt="${result.name}'s avatar">
            <span class="charSim-name">${result.name}</span>
            <div class="charSim-score">${result.distance.toFixed(4)}</div>
        </div>
    `).join('');
    listContainer.html(html);
}

function renderClusterList() {
    const listContainer = $('#charSimClusteringContent');
    if (clusterResults.length === 0) {
        listContainer.html('<p class="charSim-placeholder">No clusters found. Try analyzing data with a lower threshold.</p>');
        return;
    }
    const groupsWithData = clusterResults
        .map(groupAvatars => groupAvatars.map(avatar => characters.find(c => c.avatar === avatar)).filter(Boolean))
        .filter(group => group.length > 1);
    if (groupsWithData.length === 0) {
        listContainer.html('<p class="charSim-placeholder">No groups with more than one character found at this threshold.</p>');
        return;
    }
    const html = groupsWithData.map(group => `
        <div class="charSim-cluster-group">
            ${group.map(char => `
                <div class="charSim-character-item" data-avatar="${char.avatar}">
                    <img src="${getThumbnailUrl('avatar', char.avatar)}" alt="${char.name}'s avatar">
                    <span class="charSim-name">${char.name}</span>
                </div>
            `).join('')}
        </div>
    `).join('');
    listContainer.html(html);
}

async function onEmbeddingsLoad() {
    const koboldUrl = extension_settings[extensionName].koboldUrl;
    if (!koboldUrl) {
        toastr.warning('Please set the KoboldCpp URL in the extension settings first.');
        return;
    }
    const apiUrl = `${koboldUrl.replace(/\/$/, "")}/api/extra/embeddings`;
    const buttons = $('#charSimLoadBtn, #charSimAnalyzeBtn');
    let toastId = null;
    try {
        buttons.prop('disabled', true);
        characterEmbeddings.clear();
        similarityResults = [];
        clusterResults = [];
        toastId = toastr.info(`Loading embeddings for ${characters.length} characters...`, 'Loading Embeddings', { timeOut: 0, extendedTimeOut: 0, closeButton: true });
        for (const char of characters) {
            const textToEmbed = fieldsToEmbed.map(field => char[field] || '').join('\n').trim();
            if (!textToEmbed) continue;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: "kcpp", input: textToEmbed, truncate: true }),
            });
            if (!response.ok) throw new Error(`API request for ${char.name} failed: ${response.status}`);
            const data = await response.json();
            const embedding = data?.data?.[0]?.embedding;
            if (!embedding) throw new Error(`Invalid embedding format for ${char.name}.`);
            characterEmbeddings.set(char.avatar, embedding);
        }
        toastr.remove(toastId);
        toastr.success(`Successfully loaded embeddings for ${characterEmbeddings.size} characters.`);
    } catch (error) {
        console.error('Failed to load embeddings:', error);
        if (toastId) toastr.remove(toastId);
        toastr.error(`Error loading embeddings: ${error.message}`, 'Error', { timeOut: 10000 });
    } finally {
        buttons.prop('disabled', false);
    }
}

let clusterToastId = null; // Variable to hold the ID of the clustering progress toast
function onAnalyzeData() {
    if (characterEmbeddings.size === 0) {
        toastr.warning('Please load character embeddings first.');
        return;
    }
    // --- 1. Uniqueness Calculation ---
    toastr.info('Calculating uniqueness scores...');
    const embeddings = Array.from(characterEmbeddings.values());
    const meanEmbedding = new Array(embeddings[0].length).fill(0);
    embeddings.forEach(vector => vector.forEach((val, i) => meanEmbedding[i] += val));
    meanEmbedding.forEach((_, i) => meanEmbedding[i] /= embeddings.length);
    const results = [];
    for (const [avatar, embedding] of characterEmbeddings.entries()) {
        let distance = embedding.reduce((sum, val, i) => sum + Math.abs(val - meanEmbedding[i]), 0);
        const char = characters.find(c => c.avatar === avatar);
        if (char) results.push({ avatar: char.avatar, name: char.name, distance });
    }
    similarityResults = results;
    renderUniquenessList();
    toastr.success('Uniqueness calculation complete.');

    // --- 2. Clustering ---
    clusterToastId = toastr.info('Starting cluster analysis... (0%)', 'Clustering', { timeOut: 0, extendedTimeOut: 0, closeButton: true });
    const dataForWorker = Array.from(characterEmbeddings.entries()).map(([id, embedding]) => ({ id, embedding }));
    const threshold = Number($('#charSimThresholdSlider').val());
    clusterWorker.postMessage({ embeddings: dataForWorker, threshold });
}

jQuery(() => {
    // --- SETTINGS PANEL ---
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
                    <input id="kobold_url_input" class="text_pole" type="text" value="${extension_settings[extensionName].koboldUrl}" placeholder="http://127.0.0.1:5001">
                    <small>The base URL for your KoboldCpp instance.</small>
                </div>
            </div>
        </div>
    </div>`;
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
                <div id="charSimAnalyzeBtn" class="menu_button">Analyze Data</div>
                <div class="spacer"></div>
                <label for="charSimThresholdSlider" class="charSim-slider-label">
                    Threshold: <span id="charSimThresholdValue">${defaultSettings.clusterThreshold.toFixed(2)}</span>
                    <input type="range" id="charSimThresholdSlider" min="0.5" max="1.0" step="0.01" value="${defaultSettings.clusterThreshold}">
                </label>
                <div id="charSimSortBtn" class="menu_button menu_button_icon fa-solid fa-arrow-down" title="Sort Descending"></div>
            </div>
            <div class="charSim-tabs">
                <div class="charSim-tab active" data-tab="uniqueness">Uniqueness</div>
                <div class="charSim-tab" data-tab="clustering">Clustering</div>
            </div>
            <div class="charSim-tab-content active" id="charSimUniquenessContent">
                <div id="charSimUniquenessList"></div>
            </div>
            <div class="charSim-tab-content" id="charSimClusteringContent">
                <p class="charSim-placeholder">Click "Analyze Data" to find character clusters.</p>
            </div>
        </div>
    </div>`;
    $('#movingDivs').append(panelHtml);

    // --- EVENT LISTENERS ---
    $('#charSimCloseBtn').on('click', () => $('#characterSimilarityPanel').removeClass('open'));
    $('#charSimLoadBtn').on('click', onEmbeddingsLoad);
    $('#charSimAnalyzeBtn').on('click', onAnalyzeData);

    $('#charSimSortBtn').on('click', function() {
        $(this).toggleClass('fa-arrow-down fa-arrow-up');
        $(this).attr('title', $(this).hasClass('fa-arrow-down') ? 'Sort Descending' : 'Sort Ascending');
        renderUniquenessList();
    });

    $('#charSimThresholdSlider').on('input', function() {
        const value = Number($(this).val());
        $('#charSimThresholdValue').text(value.toFixed(2));
        extension_settings[extensionName].clusterThreshold = value;
        saveSettingsDebounced();
    });

    $('.charSim-tab').on('click', function() {
        const tabName = $(this).data('tab');
        $('.charSim-tab').removeClass('active');
        $(this).addClass('active');
        $('.charSim-tab-content').removeClass('active').hide();
        $(`#${tabName === 'uniqueness' ? 'charSimUniquenessContent' : 'charSimClusteringContent'}`).show().addClass('active');
        $('#charSimSortBtn').toggle(tabName === 'uniqueness');
    });

    // UPDATED: Worker message handler
    clusterWorker.onmessage = (event) => {
        switch (event.data.type) {
            case 'progress':
                if (clusterToastId) {
                    const percent = event.data.data.percent;
                    toastr.info(`Analyzing clusters... (${percent}%)`, 'Clustering', { toastId: clusterToastId, timeOut: 0, extendedTimeOut: 0 });
                }
                break;
            case 'result':
                if (clusterToastId) toastr.remove(clusterToastId);
                clusterResults = event.data.data;
                renderClusterList();
                toastr.success('Cluster analysis complete!', 'Clustering');
                break;
            case 'error':
                if (clusterToastId) toastr.remove(clusterToastId);
                console.error("Clustering Worker Error:", event.data.data);
                toastr.error(`Clustering failed: ${event.data.data.message}`, 'Error');
                break;
        }
    };
    clusterWorker.onerror = (error) => {
        if (clusterToastId) toastr.remove(clusterToastId);
        console.error("Fatal Clustering Worker Error:", error);
        toastr.error('A fatal error occurred in the clustering worker. Check the console for details.', 'Error');
    };

    // --- CHARACTER PANEL BUTTON ---
    const openButton = document.createElement('div');
    openButton.id = 'characterSimilarityOpenBtn';
    openButton.classList.add('menu_button', 'fa-solid', 'fa-project-diagram', 'faSmallFontSquareFix');
    openButton.title = 'Find Similar Characters';
    openButton.addEventListener('click', () => {
        if ($('#characterSimilarityPanel').hasClass('open')) return;
        renderUniquenessList();
        renderClusterList();
        $('#characterSimilarityPanel').addClass('open');
    });
    const buttonContainer = document.getElementById('rm_buttons_container');
    if (buttonContainer) {
        buttonContainer.append(openButton);
    } else {
        document.getElementById('form_character_search_form').insertBefore(openButton, document.getElementById('character_search_bar'));
    }
    
    eventSource.on(event_types.APP_READY, renderUniquenessList);
});