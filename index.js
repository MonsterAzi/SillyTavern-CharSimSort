import { extension_settings } from '../../../extensions.js';
import { getContext, getApiUrl, getApiKey } from '../../../../script.js';
import { getThumbnailUrl, saveSettingsDebounced } from '../../../../script.js';

const extensionName = 'character-similarity';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let similarityWorker;
let similarityResults = [];

const defaultSettings = {
    embeddingModel: 'nomic-embed-text-v1.5',
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    $('#similarity_embedding_model').val(extension_settings[extensionName].embeddingModel);
}

function onModelNameInput() {
    extension_settings[extensionName].embeddingModel = $(this).val();
    saveSettingsDebounced();
}

function renderResults() {
    const tbody = $('#similarity_results_tbody');
    tbody.empty();

    const sortOrder = $('#similarity_sort_order').val();
    const sortedResults = [...similarityResults].sort((a, b) => {
        return sortOrder === 'desc' ? b.similarity - a.similarity : a.similarity - b.similarity;
    });

    if (sortedResults.length === 0) {
        tbody.append('<tr><td colspan="3" class="text-center">No results to display.</td></tr>');
        return;
    }

    sortedResults.forEach(item => {
        const char1Avatar = getThumbnailUrl('avatar', item.char1.avatar);
        const char2Avatar = getThumbnailUrl('avatar', item.char2.avatar);

        const row = `
            <tr>
                <td>
                    <div class="similarity-char-cell">
                        <img src="${char1Avatar}" alt="${item.char1.name}">
                        <span>${item.char1.name}</span>
                    </div>
                </td>
                <td>
                    <div class="similarity-char-cell">
                        <img src="${char2Avatar}" alt="${item.char2.name}">
                        <span>${item.char2.name}</span>
                    </div>
                </td>
                <td class="sim-col">${item.similarity.toFixed(4)}</td>
            </tr>
        `;
        tbody.append(row);
    });
}


async function calculateSimilarity() {
    const context = getContext();
    const calculateButton = $('#similarity_calculate_button');
    const progressContainer = $('#similarity_progress_container');
    const progressText = $('#similarity_progress_text');
    const progressBar = $('#similarity_progress_bar');
    const resultsArea = $('#similarity_results_area');

    calculateButton.prop('disabled', true).find('span').text('Calculating...');
    progressContainer.show();
    resultsArea.hide();
    similarityResults = [];
    renderResults(); // Clear table

    const { characters, unshallowCharacter } = context;
    if (characters.some(c => c.shallow) && typeof unshallowCharacter === 'function') {
        toastr.info('Unshallowing all characters before proceeding. This may take a moment.');
        for (let i = 0; i < characters.length; i++) {
            if (characters[i].shallow) {
                progressText.text(`Loading character definitions... (${i + 1}/${characters.length})`);
                await unshallowCharacter(i);
            }
        }
    }

    if (similarityWorker) {
        similarityWorker.terminate();
    }

    similarityWorker = new Worker(`${extensionFolderPath}/worker.js`);

    similarityWorker.onmessage = (event) => {
        const { type, data } = event.data;

        switch (type) {
            case 'progress':
                progressText.text(data.message);
                progressBar.val(data.progress);
                break;
            case 'result':
                similarityResults = data;
                renderResults();
                resultsArea.show();
                progressContainer.hide();
                calculateButton.prop('disabled', false).find('span').text('Calculate Similarity');
                toastr.success(`Similarity calculation complete. Found ${data.length} pairs.`);
                similarityWorker.terminate();
                break;
            case 'error':
                toastr.error(data, 'Worker Error', { timeOut: 0, extendedTimeOut: 0 });
                progressContainer.hide();
                calculateButton.prop('disabled', false).find('span').text('Calculate Similarity');
                similarityWorker.terminate();
                break;
        }
    };

    similarityWorker.onerror = (error) => {
        console.error('Worker error:', error);
        toastr.error('An unexpected error occurred in the similarity worker.', 'Worker Error');
        calculateButton.prop('disabled', false).find('span').text('Calculate Similarity');
        progressContainer.hide();
    };

    const characterData = characters.map(c => ({
        name: c.name,
        avatar: c.avatar,
        description: c.description,
        personality: c.personality,
        scenario: c.scenario,
        first_mes: c.first_mes,
        mes_example: c.mes_example,
    }));
    
    const settings = {
        apiUrl: getApiUrl(),
        apiKey: getApiKey(),
        model: $('#similarity_embedding_model').val(),
    };

    similarityWorker.postMessage({ characters: characterData, settings });
}

jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $('#extensions_settings2').append(settingsHtml);

    const openButton = $('<button id="char_similarity_button" class="menu_button"><i class="fa-solid fa-people-arrows"></i> Similarity</button>');
    openButton.on('click', () => {
        $('#character_similarity_settings .inline-drawer-toggle').trigger('click');
    });
    $('#rm_buttons_container').prepend(openButton);

    $('#similarity_calculate_button').on('click', calculateSimilarity);
    $('#similarity_sort_order').on('change', renderResults);
    $('#similarity_embedding_model').on('input', onModelNameInput);

    loadSettings();
});