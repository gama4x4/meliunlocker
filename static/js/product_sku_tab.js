// backend/static/js/product_sku_tab.js
import {
    fetchTinyProductDetailsAPI,
    // fetchMLCategorySuggestionAPI, // Desabilitado
    fetchMLCategoriesAPI,
    // searchMLCategoriesAPI, // Desabilitado
    checkMLSkuStatusAPI
} from './api.js';
import { displayStatusMessage, createSpinnerIcon } from './ui_helpers.js';
import { populateImagesFromTinyData, clearProductImages } from './images_tab.js';
import {
    loadMlAttributesForCategoryUIFromOtherModule,
    clearMlAttributesUI,
    setLastTinyProductDataForAttributes,
    populateDescriptionFromTiny,
    clearDescriptionUI
} from './attributes_desc_tab.js';

// --- Seletores de Elementos DOM ---
const tinySkuInput = document.getElementById('tinySkuInput');
const tinyIdInput = document.getElementById('tinyIdInput');
const fetchTinyProductBtn = document.getElementById('fetchTinyProductBtn');
const tinyProductStatusEl = document.getElementById('tinyProductStatus');
const mlTitleInput = document.getElementById('mlTitleInput');
const mlTitleCharCount = document.getElementById('mlTitleCharCount');
const mlQuantityInput = document.getElementById('mlQuantityInput');
const mlSellerSkuInput = document.getElementById('mlSellerSkuInput');
const mlHandlingTimeInput = document.getElementById('mlHandlingTimeInput');
const mlLocalPickupCheckbox = document.getElementById('mlLocalPickupCheckbox');
const mlCategoryDisplay = document.getElementById('mlCategoryDisplay');
const mlCategoryIdHidden = document.getElementById('mlCategoryIdHidden');
const suggestMlCategoryBtn = document.getElementById('suggestMlCategoryBtn');
const browseMlCategoryBtn = document.getElementById('browseMlCategoryBtn');
const mlCategorySuggestionArea = document.getElementById('mlCategorySuggestionArea');
const mlCategoryStatus = document.getElementById('mlCategoryStatus');
const mlSkuCheckResultsArea = document.getElementById('mlSkuCheckResultsArea');

const categoryBrowserModal = document.getElementById('mlCategoryBrowserModal');
const closeCategoryBrowserModalBtn = document.getElementById('closeCategoryBrowserModal');
const categorySearchInput = document.getElementById('categorySearchInput');
const categoryListUl = document.getElementById('categoryListUl'); 
const categoryBrowserStatus = document.getElementById('categoryBrowserStatus');
const categoryModalInitialMessageEl = document.getElementById('categoryModalInitialMessage');

const costPriceInput = document.getElementById('priceCalcCustoInput');
const alturaInput = document.getElementById('priceCalcAlturaInput');
const larguraInput = document.getElementById('priceCalcLarguraInput');
const comprimentoInput = document.getElementById('priceCalcComprimentoInput');
const pesoInput = document.getElementById('priceCalcPesoInput');

// --- Funções Específicas da Aba ---

function clearProductRelatedFieldsOnTabInternal() {
    console.log("Limpando campos do produto (product_sku_tab.js)...");
    if (mlTitleInput) mlTitleInput.value = '';
    if (mlTitleCharCount) mlTitleCharCount.textContent = '0/60';
    if (mlQuantityInput) mlQuantityInput.value = '0';
    if (mlSellerSkuInput) mlSellerSkuInput.value = '';
    if (mlHandlingTimeInput) mlHandlingTimeInput.value = '';
    if (mlLocalPickupCheckbox) mlLocalPickupCheckbox.checked = false;
    if (mlCategoryDisplay) mlCategoryDisplay.value = 'Nenhuma categoria selecionada';
    if (mlCategoryIdHidden) mlCategoryIdHidden.value = '';
    if (mlCategorySuggestionArea) mlCategorySuggestionArea.innerHTML = '';
    if (mlCategoryStatus) displayStatusMessage(mlCategoryStatus, '');
    if (mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p>Aguardando busca de produto Tiny...</p>';

    if (typeof clearProductImages === 'function') clearProductImages();
    else console.warn("Função clearProductImages não importada/definida.");

    if (typeof clearMlAttributesUI === 'function') clearMlAttributesUI();
    else console.warn("Função clearMlAttributesUI não importada/definida.");

    if (typeof setLastTinyProductDataForAttributes === 'function') setLastTinyProductDataForAttributes(null);
    else console.warn("Função setLastTinyProductDataForAttributes não importada/definida.");
    
    if (typeof clearDescriptionUI === 'function') clearDescriptionUI();
    else {
        console.warn("Função clearDescriptionUI não importada; limpando textarea diretamente se encontrado.");
        const descTextareaFallback = document.getElementById('mlDescriptionTextarea');
        if (descTextareaFallback) descTextareaFallback.value = '';
    }

    if (costPriceInput) costPriceInput.value = '0.00';
    if (alturaInput) alturaInput.value = '0.0';
    if (larguraInput) larguraInput.value = '0.0';
    if (comprimentoInput) comprimentoInput.value = '0.0';
    if (pesoInput) pesoInput.value = '0.000';
}

async function handleFetchTinyProductInternal() {
    const sku = tinySkuInput?.value.trim();
    const idTiny = tinyIdInput?.value.trim();

    if (!sku && !idTiny) {
        displayStatusMessage(tinyProductStatusEl, 'Insira SKU ou ID Tiny para buscar.', 'warning');
        return;
    }
    displayStatusMessage(tinyProductStatusEl, `${createSpinnerIcon()} Buscando produto no Tiny...`, 'info', true);
    clearProductRelatedFieldsOnTabInternal();

    try {
        const productData = await fetchTinyProductDetailsAPI(sku, idTiny); 
        console.log("Dados recebidos do Tiny (frontend):", productData);

        if (!productData || Object.keys(productData).length === 0 || productData.error_message || productData.not_found) {
            throw new Error(productData.error_message || productData.message || "Nenhum dado de produto retornado ou produto não encontrado no Tiny.");
        }
        
        if (typeof setLastTinyProductDataForAttributes === 'function') {
            setLastTinyProductDataForAttributes(productData);
        }

        let successMessage = `Tiny: "${productData.nome_tiny || 'Produto s/ nome'}" (ID: ${productData.id_tiny || 'N/A'}) carregado! Estoque: ${productData.estoque_tiny !== undefined ? productData.estoque_tiny : 'N/A'}.`;
        if (productData.product_found_by_search_name) {
            successMessage = `Tiny: "${productData.nome_tiny || 'Produto s/ nome'}" (ID: ${productData.id_tiny || 'N/A'}) carregado. <br><small>(Busca por SKU '${sku}' não exata, usando: '${productData.product_found_by_search_name}')</small>`;
            displayStatusMessage(tinyProductStatusEl, successMessage, 'info', true);
        } else {
             displayStatusMessage(tinyProductStatusEl, successMessage, 'success');
        }

        if (mlTitleInput) mlTitleInput.value = productData.nome_tiny || '';
        if (mlTitleInput) mlTitleInput.dispatchEvent(new Event('input'));
        if (mlQuantityInput) mlQuantityInput.value = productData.estoque_tiny === undefined ? '0' : String(productData.estoque_tiny);
        if (mlSellerSkuInput) mlSellerSkuInput.value = productData.codigo_tiny || '';
        if (mlHandlingTimeInput) mlHandlingTimeInput.value = productData.dias_preparacao_tiny || '';
        if (mlLocalPickupCheckbox) mlLocalPickupCheckbox.checked = productData.permite_retirada_tiny || false;

        let precoBaseTiny = 0.0;
        if (productData.preco_promocional_tiny && parseFloat(productData.preco_promocional_tiny) > 0) {
            precoBaseTiny = parseFloat(productData.preco_promocional_tiny);
        } else if (productData.preco_venda_tiny !== undefined) {
            precoBaseTiny = parseFloat(productData.preco_venda_tiny);
        }
        if (costPriceInput) costPriceInput.value = precoBaseTiny >= 0 ? precoBaseTiny.toFixed(2) : '0.00';
        
        if (alturaInput) alturaInput.value = parseFloat(productData.altura_embalagem_tiny || 0).toFixed(1);
        if (larguraInput) larguraInput.value = parseFloat(productData.largura_embalagem_tiny || 0).toFixed(1);
        if (comprimentoInput) comprimentoInput.value = parseFloat(productData.comprimento_embalagem_tiny || 0).toFixed(1);
        if (pesoInput) pesoInput.value = parseFloat(productData.peso_bruto_tiny || 0).toFixed(3);

        if (typeof populateImagesFromTinyData === 'function') {
            populateImagesFromTinyData(productData.anexos_tiny);
        }
        
        if (typeof populateDescriptionFromTiny === 'function' && productData.descricao_complementar_tiny !== undefined) {
            populateDescriptionFromTiny(productData.descricao_complementar_tiny);
        }

        if (suggestMlCategoryBtn) { 
            suggestMlCategoryBtn.disabled = !(mlTitleInput?.value); 
        }

        const skuParaVerificarML = mlSellerSkuInput?.value.trim();
        if (skuParaVerificarML) {
            await handleCheckMlSkuStatusInternal(skuParaVerificarML);
        } else {
            if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p>SKU do ML não preenchido.</p>';
        }

    } catch (error) {
        console.error("Erro completo em handleFetchTinyProductInternal:", error);
        displayStatusMessage(tinyProductStatusEl, `Erro ao buscar produto do Tiny: ${error.message}`, 'error');
    }
}

function handleSuggestMlCategoryInternal() { 
    displayStatusMessage(mlCategoryStatus, 'Sugestão de categoria desabilitada temporariamente.', 'info');
    console.log("handleSuggestMlCategoryInternal: Funcionalidade de sugestão desabilitada.");
}

async function handleCheckMlSkuStatusInternal(sku) {
    if (!sku) {
        if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p>SKU ML não fornecido.</p>'; return;
    }
    if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = `<p>${createSpinnerIcon()} Verificando SKU ML '${sku}'...</p>`;
    try {
        const results = await checkMLSkuStatusAPI(sku);
        if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '';
        if (results.error_message) {
             mlSkuCheckResultsArea.innerHTML = `<p class="error-message">${results.error_message}</p>`; return;
        }
        if (Object.keys(results).length === 0 || (Object.keys(results).length === 1 && results.message)) {
            mlSkuCheckResultsArea.innerHTML = `<p>${results.message || 'Nenhuma conta ML configurada ou resposta vazia para o SKU.'}</p>`;
            return;
        }
        const table = document.createElement('table');
        table.className = 'sku-check-results-table';
        let tableHtml = `<thead><tr><th>Conta ML</th><th>Status</th><th>Itens Encontrados (ID / Título / Tipo / Preço / Vend.)</th></tr></thead><tbody>`;
        let foundAnyItemsOverall = false;
        for (const nickname in results) {
            const res = results[nickname];
            let itemsHtml = 'Nenhum item encontrado para este SKU nesta conta.';
            let statusClass = 'status-not-found';
            let statusText = 'Não Encontrado';

            if (res.error) {
                itemsHtml = `<span class="error-text">${res.message || res.error}</span>`;
                statusText = 'Erro'; statusClass = 'error-text';
            } else if (res.found && res.items && res.items.length > 0) {
                statusText = 'Encontrado'; statusClass = 'status-ok'; itemsHtml = '<ul>';
                foundAnyItemsOverall = true;
                res.items.forEach(item => {
                    itemsHtml += `<li><a href="${item.permalink}" target="_blank" title="${item.title}">${item.id}</a> - ${item.title.substring(0,40)}... (${item.listing_type_id||'N/A'}) St:${item.status} R$${parseFloat(item.price||0).toFixed(2)} (Vend: ${item.sold_quantity || 0})</li>`;
                });
                itemsHtml += '</ul>';
            }
            tableHtml += `<tr><td>${nickname}</td><td class="${statusClass}">${statusText}</td><td>${itemsHtml}</td></tr>`;
        }
        tableHtml += `</tbody>`; table.innerHTML = tableHtml;
        mlSkuCheckResultsArea.appendChild(table);
        if (!foundAnyItemsOverall && !Object.values(results).some(r => r.error)) {
            if (mlSkuCheckResultsArea.children.length === 1 && mlSkuCheckResultsArea.firstChild.tagName === 'TABLE' && mlSkuCheckResultsArea.firstChild.rows.length <=1) { 
                displayStatusMessage(mlSkuCheckResultsArea, `SKU '${sku}' não encontrado em nenhuma conta.`, 'info', false);
            }
        }
    } catch (error) {
        if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = `<p class="error-message">Erro ao verificar SKU: ${error.message}</p>`;
    }
}

async function renderMLCategoryTreeInternal(parentId = null, parentLiElement = null) {
    console.log(`renderMLCategoryTreeInternal INICIADA - parentId: ${parentId}`);
    let targetUl = parentLiElement ? parentLiElement.querySelector('ul') : categoryListUl;

    if (!targetUl && parentLiElement) {
        const newSubUl = document.createElement('ul'); parentLiElement.appendChild(newSubUl); targetUl = newSubUl;
    } else if (!targetUl && !parentLiElement) {
        displayStatusMessage(categoryBrowserStatus, 'Erro: Container da lista (#categoryListUl) não encontrado.', 'error'); return;
    }

    displayStatusMessage(categoryBrowserStatus, `${createSpinnerIcon()} Carregando categorias...`, 'info', true);
    if (targetUl) targetUl.innerHTML = '';
    if (categoryModalInitialMessageEl && !parentLiElement) categoryModalInitialMessageEl.style.display = 'none';

    try {
        const categoriesData = await fetchMLCategoriesAPI(parentId); // API para raiz ou filhos
        console.log(`Dados de categorias recebidos para parentId ${parentId}:`, categoriesData);
        
        if (categoriesData.error_message) throw new Error(categoriesData.error_message);
        if (!categoriesData || !Array.isArray(categoriesData) || categoriesData.length === 0) {
            let message = 'Nenhuma subcategoria encontrada.';
            if (!parentId) message = 'Nenhuma categoria raiz. Verifique o token/API.';
            
            if (parentLiElement) {
                parentLiElement.classList.remove('has-children');
                parentLiElement.classList.add('leaf-node');
                parentLiElement.title = `Selecionar: ${parentLiElement.dataset.name}`;
                
                const currentTextContent = parentLiElement.firstChild.nodeValue || parentLiElement.dataset.name; // Pega o texto antes de limpar
                parentLiElement.innerHTML = ''; // Limpa o interior do LI (remove o sub-UL vazio e a seta do CSS se o ::before for texto)
                parentLiElement.textContent = currentTextContent; // Re-adiciona o texto limpo

                // Remove listener de expansão (se existir) e adiciona de seleção.
                // A maneira mais robusta é clonar e substituir.
                const newLeafLi = parentLiElement.cloneNode(true);
                newLeafLi.classList.add('leaf-node'); // Garante
                newLeafLi.classList.remove('has-children');

                // Adiciona listeners ao nó clonado
                newLeafLi.addEventListener('click', function handleSelectLeaf(event) {
                    event.stopPropagation();
                    setMLCategoryGloballyInternal(this.dataset.id, this.dataset.name, this.dataset.path);
                });
                // Substitui o nó antigo pelo novo com o listener correto
                parentLiElement.parentNode.replaceChild(newLeafLi, parentLiElement);
                message = `"${newLeafLi.dataset.name}" é uma categoria final. Clique para selecionar.`;
            } else {
                 if (targetUl) targetUl.innerHTML = `<li><small>${message}</small></li>`;
                 if (categoryModalInitialMessageEl) categoryModalInitialMessageEl.style.display = 'block';
            }
            displayStatusMessage(categoryBrowserStatus, message, 'info');
            return;
        }

        categoriesData.forEach(cat => {
            const li = document.createElement('li');
            const catId = cat.id; const catName = cat.name;
            if (!catId || !catName) { console.warn("Cat inválida da API:", cat); return; }

            li.textContent = `${catName} (ID: ${catId})`;
            li.dataset.id = catId; li.dataset.name = catName;
            const path = cat.path_from_root ? cat.path_from_root.map(p => p.name).join(' > ') : catName;
            li.dataset.path = path;

            let isLeaf = (cat.settings && typeof cat.settings.leaf === 'boolean') ? cat.settings.leaf : false;
            if (!isLeaf && cat.children_categories && Array.isArray(cat.children_categories) && cat.children_categories.length === 0) {
                isLeaf = true; // Se settings.leaf não for true, mas children_categories for explicitamente vazio
            }
            console.log(`Categoria: ${catName}, ID: ${catId}, settings.leaf: ${cat.settings?.leaf}, children_categories_count: ${cat.children_categories?.length}, Deteminado como isLeaf: ${isLeaf}`);
            
            if (!isLeaf) {
                li.classList.add('has-children');
                const subUl = document.createElement('ul'); 
                li.appendChild(subUl);
                li.addEventListener('click', function handleExpand(event) {
                    event.stopPropagation();
                    this.classList.toggle('open');
                    const childUl = this.querySelector('ul');
                    if (this.classList.contains('open') && childUl && childUl.innerHTML.trim() === '') {
                        console.log(`Expandindo categoria: ${this.dataset.name} (ID: ${this.dataset.id})`);
                        renderMLCategoryTreeInternal(this.dataset.id, this);
                    }
                });
            } else {
                li.classList.add('leaf-node');
                li.title = `Selecionar: ${catName}`;
                li.addEventListener('click', function handleSelect(event) {
                    event.stopPropagation();
                    console.log("Nó folha clicado:", this.dataset.id, this.dataset.name);
                    setMLCategoryGloballyInternal(this.dataset.id, this.dataset.name, this.dataset.path);
                });
            }
            targetUl.appendChild(li);
        });
        if(categoriesData.length > 0) displayStatusMessage(categoryBrowserStatus, 'Categorias carregadas. Clique para expandir ou selecionar.', 'success');
    } catch (error) {
        console.error("Erro em renderMLCategoryTreeInternal:", error);
        displayStatusMessage(categoryBrowserStatus, `Erro ao carregar categorias: ${error.message}`, 'error');
        if (targetUl) targetUl.innerHTML = `<li><small style="color:red;">Falha ao carregar: ${error.message}</small></li>`;
        if (categoryModalInitialMessageEl && !parentId) categoryModalInitialMessageEl.style.display = 'block';
    }
}

async function setMLCategoryGloballyInternal(id, name, pathString = '') {
    if (mlCategoryIdHidden) mlCategoryIdHidden.value = id;
    if (mlCategoryDisplay) mlCategoryDisplay.value = name + (pathString ? ` (${pathString} - ID: ${id})` : ` (ID: ${id})`);
    displayStatusMessage(mlCategoryStatus, `Categoria definida: ${name} (ID: ${id})`, 'success');
    if (mlCategorySuggestionArea) mlCategorySuggestionArea.innerHTML = '';
    if (categoryBrowserModal) categoryBrowserModal.style.display = 'none';
    console.log(`Categoria ML definida: ID=${id}, Nome='${name}'`);
    
    if (typeof loadMlAttributesForCategoryUIFromOtherModule === 'function') {
        await loadMlAttributesForCategoryUIFromOtherModule(id);
    } else {
        console.error("loadMlAttributesForCategoryUIFromOtherModule não definida.");
    }
}

export function initProductSkuTab() {
    console.log("Product & SKU Tab Initialized");

    if (fetchTinyProductBtn) {
        fetchTinyProductBtn.addEventListener('click', handleFetchTinyProductInternal);
    }
    if (mlTitleInput && mlTitleCharCount) {
        mlTitleInput.addEventListener('input', () => {
            const currentLength = mlTitleInput.value.length;
            const maxLength = parseInt(mlTitleInput.getAttribute('maxlength')) || 60;
            mlTitleCharCount.textContent = `${currentLength}/${maxLength}`;
            mlTitleCharCount.style.color = currentLength > maxLength ? 'red' : (currentLength > maxLength - 10 ? 'orange' : '#777');
        });
        mlTitleInput.dispatchEvent(new Event('input'));
    }

    if (mlSellerSkuInput) {
        let skuCheckTimeoutProductTab;
        mlSellerSkuInput.addEventListener('input', () => {
            clearTimeout(skuCheckTimeoutProductTab);
            const currentMlSku = mlSellerSkuInput.value.trim();
            if (currentMlSku.length >= 1) {
                skuCheckTimeoutProductTab = setTimeout(() => {
                    handleCheckMlSkuStatusInternal(currentMlSku);
                }, 1200);
            } else {
                if (mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p>Digite o SKU do ML para verificar.</p>';
            }
        });
    }

    if (suggestMlCategoryBtn) {
        suggestMlCategoryBtn.addEventListener('click', handleSuggestMlCategoryInternal);
        suggestMlCategoryBtn.disabled = true; 
    }

    if (browseMlCategoryBtn) {
        browseMlCategoryBtn.addEventListener('click', () => {
            if (categoryBrowserModal) {
                categoryBrowserModal.style.display = 'block';
                if (categoryModalInitialMessageEl) {
                    categoryModalInitialMessageEl.style.display = 'block';
                    const linkInStaticMessage = categoryModalInitialMessageEl.querySelector('#loadRootCategoriesLinkInModal');
                    if (linkInStaticMessage && !linkInStaticMessage.dataset.listenerAttachedStaticCatModal) { 
                        linkInStaticMessage.addEventListener('click', (e) => { 
                            e.preventDefault();
                            console.log("Link estático '#loadRootCategoriesLinkInModal' clicado (listener em init).");
                            renderMLCategoryTreeInternal(); 
                        });
                        linkInStaticMessage.dataset.listenerAttachedStaticCatModal = "true";
                    }
                }
                if (categoryListUl) categoryListUl.innerHTML = '';
                if (categoryBrowserStatus) displayStatusMessage(categoryBrowserStatus, 'Pronto para carregar categorias raiz.', 'info');
                if (categorySearchInput) { 
                    categorySearchInput.value = ''; 
                    categorySearchInput.placeholder = "Busca desabilitada por enquanto.";
                    categorySearchInput.disabled = true; 
                }
            }
        });
    }
    
    if (closeCategoryBrowserModalBtn) {
        closeCategoryBrowserModalBtn.addEventListener('click', () => {
            if (categoryBrowserModal) categoryBrowserModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target === categoryBrowserModal) {
            if (categoryBrowserModal) categoryBrowserModal.style.display = "none";
        }
    });

    if (categorySearchInput) {
        categorySearchInput.disabled = true;
        categorySearchInput.placeholder = "Busca por string desabilitada.";
        categorySearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
    }
}