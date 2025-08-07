// backend/static/js/attributes_desc_tab.js
import { fetchMLCategoryAttributesAPI, generateDescriptionChatGptAPI } from './api.js';
import { displayStatusMessage, createSpinnerIcon } from './ui_helpers.js';

const mlDescriptionTextarea = document.getElementById('mlDescriptionTextarea');
const generateDescChatGptBtn = document.getElementById('generateDescChatGptBtn');
const descriptionStatusEl = document.getElementById('descriptionStatus');
const mlAttributesContainer = document.getElementById('mlAttributesContainer');
const attributesStatusEl = document.getElementById('attributesStatus');

let currentMlCategoryIdForAttrsUI = null;
let lastTinyProductDataForAttrsUI = null;
let currentAttributesFromAPI = [];

function createAttributeInputElement(attr) {
    console.log(`ATTR_DEBUG: Processando atributo para input: ID=${attr.id}, Nome='${attr.name}', ValueType='${attr.value_type}', Values:`, attr.values);

    const formGroupDiv = document.createElement('div');
    formGroupDiv.className = 'form-group form-group-attribute';
    formGroupDiv.dataset.attributeId = attr.id;

    const label = document.createElement('label');
    label.htmlFor = `attr_input_${attr.id}`;
    label.textContent = `${attr.name || attr.id}:`;
    const isRequired = attr.tags && (attr.tags.required || attr.tags.catalog_required);
    if (isRequired) {
        const requiredStar = document.createElement('span');
        requiredStar.className = 'attribute-required-star';
        requiredStar.textContent = ' *';
        label.appendChild(requiredStar);
    }
    formGroupDiv.appendChild(label);

    let inputElement = null;
    const inputId = `attr_input_${attr.id}`;
    const valueType = attr.value_type || 'string';

    const fieldInputContainer = document.createElement('div');
    fieldInputContainer.className = 'attribute-input-wrapper'; // Classe para possível estilização
    fieldInputContainer.style.display = 'flex';
    fieldInputContainer.style.alignItems = 'center';
    fieldInputContainer.style.width = '100%';

    if (valueType === 'list' || (valueType === 'string' && attr.values && attr.values.length > 0 && !['BRAND', 'MODEL'].includes(attr.id.toUpperCase()))) {
        inputElement = document.createElement('select');
        inputElement.id = inputId;
        inputElement.name = attr.id;
        const emptyOption = document.createElement('option');
        emptyOption.value = ""; emptyOption.textContent = "-- Selecione --"; inputElement.appendChild(emptyOption);
        (attr.values || []).forEach(val => {
            if (val && val.name !== undefined && val.id !== undefined) {
                const option = document.createElement('option');
                option.value = String(val.id); option.textContent = val.name;
                inputElement.appendChild(option);
            }
        });
    } else if (valueType === 'boolean') {
        inputElement = document.createElement('select');
        inputElement.id = inputId; inputElement.name = attr.id;
        const options = { "": "-- Selecione --" };
        const simApiValue = attr.values?.find(v => v.name?.toLowerCase() === 'sim')?.id || "242085";
        const naoApiValue = attr.values?.find(v => v.name?.toLowerCase() === 'não')?.id || "242084";
        options[simApiValue] = "Sim"; options[naoApiValue] = "Não";
        for (const valId in options) {
            const option = document.createElement('option');
            option.value = valId; option.textContent = options[valId];
            inputElement.appendChild(option);
        }
    } else if (attr.id.toUpperCase() === 'BRAND' || attr.id.toUpperCase() === 'MODEL') {
        inputElement = document.createElement('input');
        inputElement.type = 'text'; inputElement.id = inputId; inputElement.name = attr.id;
        inputElement.setAttribute('list', `datalist_attr_${attr.id}`);
        if (attr.value_max_length) inputElement.maxLength = attr.value_max_length;
        const dataList = document.createElement('datalist'); dataList.id = `datalist_attr_${attr.id}`;
        (attr.values || []).forEach(val => {
            if (val && val.name !== undefined) {
                const option = document.createElement('option'); option.value = val.name;
                dataList.appendChild(option);
            }
        });
        fieldInputContainer.appendChild(dataList); // Datalist é irmão do input, dentro do container
    } else if (valueType === 'string' || valueType === 'number' || valueType === 'number_unit') {
        inputElement = document.createElement('input');
        inputElement.type = (valueType === 'number' || valueType === 'number_unit') ? 'number' : 'text';
        if (valueType === 'number' || valueType === 'number_unit') inputElement.step = "any";
        inputElement.id = inputId; inputElement.name = attr.id;
        if (attr.value_max_length) inputElement.maxLength = attr.value_max_length;

        if (attr.default_unit && valueType === 'number_unit') {
             const unitSpan = document.createElement('span');
             unitSpan.textContent = ` (${attr.default_unit})`;
             unitSpan.style.fontSize = "0.8em"; unitSpan.style.marginLeft = "5px";
             fieldInputContainer.appendChild(unitSpan);
        }
    } else {
        console.warn(`ATTR_DEBUG: Tipo de valor '${valueType}' para o atributo '${attr.id}' não resultou na criação de um input explícito. Verifique a lógica ou os dados da API.`);
        // Não cria input se não souber como, mas o label ainda aparecerá.
        // Ou criar um input de texto genérico como fallback:
        // inputElement = document.createElement('input');
        // inputElement.type = 'text'; inputElement.id = inputId; inputElement.name = attr.id;
        // inputElement.placeholder = `Tipo: ${valueType}`;
    }
    
    if (inputElement) {
        inputElement.classList.add('form-control-attributes');
        inputElement.style.flexGrow = '1';
        fieldInputContainer.insertBefore(inputElement, fieldInputContainer.firstChild);
    } else {
        // Se inputElement não foi criado (ex: tipo não tratado e sem fallback)
        // Adiciona uma mensagem para indicar que o campo não pôde ser renderizado.
        const noInputMsg = document.createElement('span');
        noInputMsg.textContent = `[Campo para '${valueType}' não implementado]`;
        noInputMsg.style.color = 'grey'; noInputMsg.style.fontSize = '0.8em';
        fieldInputContainer.appendChild(noInputMsg);
        console.log(`ATTR_DEBUG: Nenhum elemento de input foi criado para ${attr.id} com value_type ${valueType}.`);
    }
    formGroupDiv.appendChild(fieldInputContainer);
    return formGroupDiv;
}

// --- FUNÇÃO CHAVE PARA CARREGAR E RENDERIZAR ATRIBUTOS ---
async function loadMlAttributesForCategoryUIInternal(categoryId) {
    if (!categoryId) {
        if (mlAttributesContainer) mlAttributesContainer.innerHTML = '<p>Nenhuma categoria selecionada para carregar atributos.</p>';
        if (attributesStatusEl) displayStatusMessage(attributesStatusEl, 'Selecione uma categoria primeiro.', 'info');
        currentMlCategoryIdForAttrsUI = null; currentAttributesFromAPI = []; return;
    }
    
    currentMlCategoryIdForAttrsUI = categoryId; currentAttributesFromAPI = [];
    if (mlAttributesContainer) mlAttributesContainer.innerHTML = `<p>${createSpinnerIcon()} Carregando atributos para categoria ${categoryId}...</p>`;
    if (attributesStatusEl) displayStatusMessage(attributesStatusEl, 'Carregando atributos...', 'info', true);

    try {
        const attributesListFromAPI = await fetchMLCategoryAttributesAPI(categoryId); // Espera a lista diretamente
        
        // DEBUG: Ver o que a API de atributos está retornando para o frontend
        console.log("ATTR_DEBUG: Atributos recebidos do backend para Categoria " + categoryId + ":", JSON.stringify(attributesListFromAPI, null, 2));

        if (attributesListFromAPI && attributesListFromAPI.error_message) { // Se o backend retornou um erro estruturado
            throw new Error(attributesListFromAPI.error_message);
        }
        
        currentAttributesFromAPI = Array.isArray(attributesListFromAPI) ? attributesListFromAPI : [];
        
        if (mlAttributesContainer) mlAttributesContainer.innerHTML = '';
        let attributesDisplayedCount = 0;

        if (currentAttributesFromAPI.length > 0) {
            const commonIdsToShowAlways = ['BRAND', 'MODEL', 'PART_NUMBER', 'MANUFACTURER_PART_NUMBER', 'GTIN', 'EAN', 'LINE', 'ITEM_CONDITION', 'COLOR', 'MAIN_COLOR', 'SIZE'];
            const idsToExplicitlyIgnore = ["SELLER_SKU", "PARENT_ITEM_ID", "VARIATION_ID", "DATASHEET", "HAZMAT_TRANSPORTABILITY", "PICK_UP", "PACKAGE_HEIGHT", "PACKAGE_WIDTH", "PACKAGE_LENGTH", "PACKAGE_WEIGHT"];
            const mandatoryImportant = []; const optionals = [];

            currentAttributesFromAPI.forEach(attr => {
                if (!attr || !attr.id) { console.warn("Atributo inválido da API:", attr); return; }
                if (idsToExplicitlyIgnore.includes(attr.id.toUpperCase())) return;
                const tags = attr.tags || {}; 
                const isApiRequired = tags.required || tags.catalog_required;
                if (tags.hidden && !commonIdsToShowAlways.includes(attr.id.toUpperCase())) return;
                if (isApiRequired || commonIdsToShowAlways.includes(attr.id.toUpperCase())) {
                    mandatoryImportant.push(attr);
                } else {
                    optionals.push(attr);
                }
            });
            mandatoryImportant.sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id));
            optionals.sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id));
            
            mandatoryImportant.forEach(attr => { 
                const attrElement = createAttributeInputElement(attr);
                if (attrElement) mlAttributesContainer.appendChild(attrElement); 
                attributesDisplayedCount++; 
            });
            if (optionals.length > 0) {
                const sep = document.createElement('hr'); sep.className = 'section-divider'; mlAttributesContainer.appendChild(sep);
                const optTitle = document.createElement('h4'); optTitle.innerHTML = '<i class="fas fa-sliders-h icon"></i> Atributos Opcionais'; optTitle.style.fontSize='1em';optTitle.style.marginTop='15px'; mlAttributesContainer.appendChild(optTitle);
                optionals.forEach(attr => {
                    const attrElement = createAttributeInputElement(attr);
                    if (attrElement) mlAttributesContainer.appendChild(attrElement);
                    attributesDisplayedCount++;
                });
            }
            if (attributesDisplayedCount > 0) {
                displayStatusMessage(attributesStatusEl, `${attributesDisplayedCount} atributos carregados para ${categoryId}.`, 'success');
                if (lastTinyProductDataForAttrsUI) { applyTinyDataToMlAttributesUIInternal(lastTinyProductDataForAttrsUI, currentAttributesFromAPI); }
            } else {
                 mlAttributesContainer.innerHTML = '<p>Nenhum atributo configurável encontrado para esta categoria (após filtros internos).</p>';
                 displayStatusMessage(attributesStatusEl, 'Nenhum atributo configurável.', 'info');
            }
        } else {
            mlAttributesContainer.innerHTML = '<p>Nenhum atributo retornado pela API para esta categoria ou formato inesperado.</p>';
            displayStatusMessage(attributesStatusEl, 'Nenhum atributo para esta categoria.', 'info');
        }
    } catch (error) {
        console.error("Erro em loadMlAttributesForCategoryUIInternal:", error);
        if (mlAttributesContainer) mlAttributesContainer.innerHTML = `<p class="error-message">Erro ao carregar atributos: ${error.message}</p>`;
        displayStatusMessage(attributesStatusEl, `Erro ao carregar atributos: ${error.message}`, 'error');
        currentAttributesFromAPI = [];
    }
}

// ... (resto das funções: applyTinyDataToMlAttributesUIInternal, handleGenerateDescChatGpt, 
// initAttributesDescTab, loadMlAttributesForCategoryUIFromOtherModule, clearMlAttributesUI,
// setLastTinyProductDataForAttributes, populateDescriptionFromTiny, clearDescriptionUI,
// getCurrentAttributesForPayload, getCurrentDescription)
// COLE O RESTANTE DO ARQUIVO attributes_desc_tab.js QUE VOCÊ JÁ TINHA AQUI
// ... (A partir daqui, cole o restante do arquivo attributes_desc_tab.js que eu enviei na mensagem anterior,
//      começando com a função applyTinyDataToMlAttributesUIInternal)

// Função de aplicar dados do Tiny (já existente, apenas para referência de onde colar)
// function applyTinyDataToMlAttributesUIInternal(tinyData, attributesFromMLAPI) { ... }

// Função de gerar descrição com ChatGPT (já existente)
// async function handleGenerateDescChatGpt() { ... }

// --- Funções Exportadas ---
export function initAttributesDescTab() {
    if (generateDescChatGptBtn) {
        generateDescChatGptBtn.addEventListener('click', handleGenerateDescChatGpt);
    }
    if (mlAttributesContainer) mlAttributesContainer.innerHTML = '<p>Selecione uma categoria na Aba "Produto & SKU".</p>';
    console.log("Attributes & Description Tab Initialized");
}

export function loadMlAttributesForCategoryUIFromOtherModule(categoryId) {
    loadMlAttributesForCategoryUIInternal(categoryId);
}

export function clearMlAttributesUI() {
    if (mlAttributesContainer) mlAttributesContainer.innerHTML = '<p>Selecione uma categoria ML para ver atributos.</p>';
    if (attributesStatusEl) displayStatusMessage(attributesStatusEl, '');
    currentMlCategoryIdForAttrsUI = null;
    currentAttributesFromAPI = [];
    console.log("Atributos ML limpos (attributes_desc_tab.js).");
}

export function setLastTinyProductDataForAttributes(tinyData) {
    lastTinyProductDataForAttrsUI = tinyData;
    console.log("Dados do Tiny para atributos atualizados (attributes_desc_tab.js):", lastTinyProductDataForAttrsUI);
    if (currentMlCategoryIdForAttrsUI && currentAttributesFromAPI.length > 0 && lastTinyProductDataForAttrsUI) {
        console.log("Reaplicando dados do Tiny aos atributos existentes após nova carga do Tiny.");
        applyTinyDataToMlAttributesUIInternal(lastTinyProductDataForAttrsUI, currentAttributesFromAPI);
    }
}

export function populateDescriptionFromTiny(descriptionText) {
    if (mlDescriptionTextarea && descriptionText !== undefined) {
        mlDescriptionTextarea.value = descriptionText;
        if(descriptionStatusEl) displayStatusMessage(descriptionStatusEl, 'Descrição populada com dados do Tiny.', 'info');
    } else if (mlDescriptionTextarea) {
        mlDescriptionTextarea.value = '';
    }
}

export function clearDescriptionUI() {
    if (mlDescriptionTextarea) {
        mlDescriptionTextarea.value = '';
    }
    if (descriptionStatusEl) {
        displayStatusMessage(descriptionStatusEl, ''); 
    }
    console.log("Textarea de descrição limpo (attributes_desc_tab.js).");
}

export function getCurrentAttributesForPayload() {
    const attributesForPayload = [];
    if (!mlAttributesContainer || !currentAttributesFromAPI || currentAttributesFromAPI.length === 0) {
        console.warn("getCurrentAttributesForPayload: Nenhum atributo carregado, adicionando ITEM_CONDITION.");
        attributesForPayload.push({ id: "ITEM_CONDITION", value_id: "2230284" });
        return attributesForPayload;
    }
    
    currentAttributesFromAPI.forEach(attrDef => {
        const inputElement = document.getElementById(`attr_input_${attrDef.id}`);
        if (inputElement) {
            const attrId = attrDef.id;
            let valueName = null;
            let valueId = null;

            if (inputElement.tagName === 'SELECT') {
                if (inputElement.value && inputElement.value !== "") {
                    valueId = inputElement.value; 
                }
            } else { 
                if (inputElement.value && inputElement.value.trim() !== "") {
                    valueName = inputElement.value.trim();
                }
            }

            const attributeEntry = { id: attrId };
            if (valueId) attributeEntry.value_id = valueId;
            if (valueName) attributeEntry.value_name = valueName;
            
            if (attributeEntry.value_id || attributeEntry.value_name) {
                if ( (attrId.toUpperCase() === 'BRAND' || attrId.toUpperCase() === 'MODEL') && attributeEntry.value_name && !attributeEntry.value_id) {
                    // OK
                } else if (!attributeEntry.value_id && attrDef.value_type === 'list' && attributeEntry.value_name) {
                    console.warn(`Atributo de lista '${attrId}' sendo enviado apenas com value_name: '${valueName}'.`);
                }
                attributesForPayload.push(attributeEntry);
            }
        }
    });
    
    const hasItemCondition = attributesForPayload.some(attr => attr.id.toUpperCase() === 'ITEM_CONDITION');
    const itemConditionDef = currentAttributesFromAPI.find(attr => attr.id.toUpperCase() === 'ITEM_CONDITION');
    const isItemConditionIgnored = itemConditionDef?.tags?.hidden || itemConditionDef?.tags?.read_only;

    if (!hasItemCondition && !isItemConditionIgnored) {
        attributesForPayload.push({ id: "ITEM_CONDITION", value_id: "2230284" }); 
        console.log("getCurrentAttributesForPayload: ITEM_CONDITION padrão ('Novo') adicionado.");
    }

    console.log("Atributos para payload (Ficha Técnica):", JSON.stringify(attributesForPayload));
    return attributesForPayload;
}

export function getCurrentDescription() {
    return mlDescriptionTextarea ? mlDescriptionTextarea.value.trim() : "";
}

console.log("attributes_desc_tab.js loaded");