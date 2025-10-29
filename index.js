import { getContext } from "../../../../script.js";
import { doExtrasFetch, getApiUrl, modules } from "../../../extensions.js";
import { showLoader, hideLoader } from "../../../../loader.js";

const extensionName = "CharacterSimilarity";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// #region UTILITY FUNCTIONS
/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} The cosine similarity score.
 */
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Fetches text embeddings from the Extras server.
 * @param {string} text The text to embed.
 * @returns {Promise<number[]|null>} The embedding vector or null on error.
 */
async function fetchEmbedding(text) {
    try {
        const url = new URL(getApiUrl());
        url.pathname = '/api/getembeddings';
        const response = await doExtrasFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            console.error(`Failed to fetch embedding: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        return data.embedding;
    } catch (error) {
        console.error('Error in fetchEmbedding:', error);
        return null;
    }
}

/**
 * Sorts an HTML table.
 * @param {HTMLTableElement} table The table to sort.
 * @param {number} column The index of the column to sort by.
 * @param {boolean} asc Whether to sort in ascending order.
 */
function sortTableByColumn(table, column, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    const rows = Array.from(tBody.querySelectorAll("tr"));

    const sortedRows = rows.sort((a, b) => {
        const aColText = a.querySelector(`td:nth-child(${column + 1})`).textContent.trim();
        const bColText = b.querySelector(`td:nth-child(${column + 1})`).textContent.trim();

        const isNumber = !isNaN(parseFloat(aColText)) && isFinite(aColText);

        if (isNumber) {
            return (parseFloat(aColText) - parseFloat(bColText)) * dirModifier;
        } else {
            return aColText.localeCompare(bColText) * dirModifier;
        }
    });

    while (tBody.firstChild) {
        tBody.removeChild(tBody.firstChild);
    }
    tBody.append(...sortedRows);

    table.querySelectorAll("th").forEach(th => th.removeAttribute("data-sort-dir"));
    const header = table.querySelector(`th:nth-child(${column + 1})`);
    header.setAttribute("data-sort-dir", asc ? "asc" : "desc");
    header.querySelector('i').className = `fa-solid ${asc ? 'fa-sort-up' : 'fa-sort-down'}`;
}

// #endregion

/**
 * Main analysis function.
 */
async function startAnalysis() {
    const context = getContext();
    const characters = context.characters;

    if (characters.length < 2) {
        toastr.warning("You need at least two characters to run a similarity analysis.");
        return;
    }

    if (!modules.includes("summarize")) {
        toastr.error("The 'Summarize & Embed' module is not available on your Extras server. Please enable it to use this feature.");
        return;
    }

    const progressContainer = document.getElementById('similarity_progress_container');
    const progressText = document.getElementById('similarity_progress_text');
    const progressBar = document.getElementById('similarity_progress_bar');
    const startButton = document.getElementById('start_similarity_analysis');
    const tableBody = document.querySelector('#similarity_results_table tbody');

    // Reset UI
    startButton.disabled = true;
    startButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    tableBody.innerHTML = '';
    progressContainer.classList.remove('hidden');

    // Step 1: Get Embeddings for all characters
    const embeddings = new Map();
    const totalChars = characters.length;
    progressBar.max = totalChars;
    progressBar.value = 0;

    for (let i = 0; i < totalChars; i++) {
        const char = characters[i];
        progressText.textContent = `Generating embedding for ${char.name} (${i + 1}/${totalChars})...`;
        const representativeText = `${char.description}\n${char.first_mes}`;
        const embedding = await fetchEmbedding(representativeText);

        if (embedding) {
            embeddings.set(char.avatar, { name: char.name, vector: embedding });
        } else {
            toastr.warning(`Could not generate embedding for ${char.name}. Skipping.`);
        }
        progressBar.value = i + 1;
    }

    // Step 2: Calculate similarities
    const characterKeys = Array.from(embeddings.keys());
    const totalComparisons = (characterKeys.length * (characterKeys.length - 1)) / 2;
    progressText.textContent = `Calculating ${totalComparisons} similarity scores...`;
    progressBar.max = totalComparisons;
    progressBar.value = 0;

    const results = [];
    for (let i = 0; i < characterKeys.length; i++) {
        for (let j = i + 1; j < characterKeys.length; j++) {
            const keyA = characterKeys[i];
            const keyB = characterKeys[j];

            const charA = embeddings.get(keyA);
            const charB = embeddings.get(keyB);

            const score = cosineSimilarity(charA.vector, charB.vector);
            results.push({
                char1: charA.name,
                char2: charB.name,
                score: score,
            });
            progressBar.value++;
        }
    }

    // Step 3: Display results
    progressText.textContent = 'Rendering results...';
    progressBar.max = results.length;
    progressBar.value = 0;

    const fragment = document.createDocumentFragment();
    for (const result of results) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${DOMPurify.sanitize(result.char1)}</td>
            <td>${DOMPurify.sanitize(result.char2)}</td>
            <td>${result.score.toFixed(4)}</td>
        `;
        fragment.appendChild(row);
        progressBar.value++;
    }
    tableBody.appendChild(fragment);

    // Finalize
    progressContainer.classList.add('hidden');
    startButton.disabled = false;
    startButton.innerHTML = '<i class="fa-solid fa-play"></i> Start Analysis';
    toastr.success(`Analysis complete! Found ${results.length} similarity pairs.`);

    // Sort by default (score descending)
    sortTableByColumn(document.getElementById('similarity_results_table'), 2, false);
}


/**
 * Extension initialization logic.
 */
jQuery(async () => {
    const modalHtml = await $.get(`${extensionFolderPath}/modal.html`);
    $('body').append(modalHtml);

    // Create and add the main button to the character manager screen
    const button = $(`<button id="character-similarity-btn" class="menu_button"><i class="fa-solid fa-people-arrows"></i> Find Similar Characters</button>`);
    $('#character_manager_content .character-manager-header').append(button);

    // --- Event Listeners ---
    const modal = document.getElementById('similarity_modal');
    button.on('click', () => modal.style.display = 'block');
    $('#similarity_close_button').on('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    $('#start_similarity_analysis').on('click', startAnalysis);

    document.querySelectorAll("#similarity_results_table th").forEach(headerCell => {
        headerCell.addEventListener("click", () => {
            const tableElement = headerCell.parentElement.parentElement.parentElement;
            const headerIndex = parseInt(headerCell.getAttribute('data-column'));
            const currentIsAsc = headerCell.getAttribute("data-sort-dir") === "asc";

            tableElement.querySelectorAll('i.fa-sort-up, i.fa-sort-down').forEach(i => i.className = 'fa-solid fa-sort');
            sortTableByColumn(tableElement, headerIndex, !currentIsAsc);
        });
    });

    console.log("Character Similarity Finder extension loaded.");
});