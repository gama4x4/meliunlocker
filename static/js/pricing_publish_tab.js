// backend/static/js/pricing_publish_tab.js
import {
    calculateMLPricesAPI // Assumindo que esta função será chamada para calcular os preços
    // Importe outras funções da api.js que você precisará para publicar, etc.
    // Ex: publishMLItemAPI (você precisará criar esta em api.js e no backend)
} from './api.js';
import { displayStatusMessage, createSpinnerIcon, formatCurrency } from './ui_helpers.js';
// Importar de outros módulos se precisar de dados (ex: para pegar dados do produto das abas anteriores)
import { getCurrentProductImages } from './images_tab.js';
import { getCurrentAttributesForPayload, getCurrentDescription } from './attributes_desc_tab.js'; // Você precisará criar estas funções

// --- Seletores de Elementos DOM para esta Aba ---
// Seção 1: Calcular Preços
const costPriceInputEl = document.getElementById('priceCalcCustoInput');
const desiredProfitInputEl = document.getElementById('priceCalcLucroInput');
const profitTypeSelectEl = document.getElementById('priceCalcLucroTipo');
const originZipInputEl = document.getElementById('priceCalcCepOrigemInput');
const alturaInputEl = document.getElementById('priceCalcAlturaInput');
const larguraInputEl = document.getElementById('priceCalcLarguraInput');
const comprimentoInputEl = document.getElementById('priceCalcComprimentoInput');
const pesoInputEl = document.getElementById('priceCalcPesoInput');
const applyDiscount10CheckboxEl = document.getElementById('priceCalcDesconto10Checkbox');
const includeAnticipationFeeCheckboxEl = document.getElementById('priceCalcTaxaAntecipacaoCheckbox');
const offerFreeShippingCheckboxEl = document.getElementById('priceCalcFreteGratisCheckbox');
const calculatePricesBtnEl = document.getElementById('calculatePricesBtn');
const priceCalcStatusEl = document.getElementById('priceCalcStatus'); // Para mensagens de status do cálculo

// Seção 2: Resultados dos Preços
const priceResultsContainerEl = document.getElementById('priceResultsContainer');

// Seção 3: Publicar
const publishMlAccountsCheckboxesContainerEl = document.getElementById('publishMlAccountsCheckboxes');
const publishClassicCheckboxEl = document.getElementById('publishClassicCheckbox');
const publishPremiumCheckboxEl = document.getElementById('publishPremiumCheckbox');
const publishCompatProfileSelectEl = document.getElementById('publishCompatProfileSelect');
const refreshCompatProfilesPublishBtnEl = document.getElementById('refreshCompatProfilesPublishBtn');
const publishToMlBtnEl = document.getElementById('publishToMlBtn');
const publishStatusEl = document.getElementById('publishStatus'); // Para mensagens de status da publicação

let calculatedPricesData = {}; // Para armazenar os resultados do cálculo de preço por conta

// --- Funções Específicas da Aba ---

function renderPriceCalculationResults() {
    if (!priceResultsContainerEl) return;
    priceResultsContainerEl.innerHTML = ''; // Limpa resultados anteriores

    if (Object.keys(calculatedPricesData).length === 0) {
        priceResultsContainerEl.innerHTML = '<p style="text-align:center; color:#777;">Nenhum preço calculado ainda ou nenhuma conta selecionada para cálculo.</p>';
        return;
    }

    let hasValidResults = false;
    for (const accountNick in calculatedPricesData) {
        const result = calculatedPricesData[accountNick];
        const card = document.createElement('div');
        card.className = 'price-result-card';

        let content = `<h4>${accountNick}</h4>`;
        if (result.error) {
            content += `<p class="error-message-calc">Erro: ${result.error}</p>`;
        } else {
            hasValidResults = true;
            content += `<p class="shipping-info">Modo Envio Conta: <strong>${result.account_shipping_mode?.toUpperCase()}</strong></p>`;
            if (offerFreeShippingCheckboxEl?.checked && result.account_shipping_mode === 'me2') {
                content += `<p class="shipping-info">Custo Frete Vendedor (ME2): <strong>${formatCurrency(result.shipping_final_cost)}</strong>`;
                if (result.shipping_original_promoted_cost && Math.abs(result.shipping_original_promoted_cost - result.shipping_final_cost) > 0.01) {
                    content += ` <small>(Base API: ${formatCurrency(result.shipping_original_promoted_amount_api)}, Desc: ${(result.shipping_api_discount_rate * 100).toFixed(0)}%)</small>`;
                }
                content += `</p>`;
            } else if (offerFreeShippingCheckboxEl?.checked && result.account_shipping_mode === 'me1'){
                 content += `<p class="shipping-info">Custo Frete Vendedor (ME1): <strong>R$ 0,00</strong> (Tabela Própria)</p>`;
            }


            if (publishClassicCheckboxEl?.checked && result.classic_price !== undefined) {
                content += `<div class="price-type"><strong>Clássico (gold_special):</strong>
                               <div class="price-value">${formatCurrency(result.classic_price)}</div>
                               <div class="fees-info">${result.classic_fees_info || 'Info taxas N/A'}</div>
                           </div>`;
            }
            if (publishPremiumCheckboxEl?.checked && result.premium_price !== undefined) {
                content += `<div class="price-type" style="margin-top:10px;"><strong>Premium (gold_pro):</strong>
                               <div class="price-value">${formatCurrency(result.premium_price)}</div>
                               <div class="fees-info">${result.premium_fees_info || 'Info taxas N/A'}</div>
                           </div>`;
            }
        }
        card.innerHTML = content;
        priceResultsContainerEl.appendChild(card);
    }
    if (!hasValidResults && Object.keys(calculatedPricesData).length > 0) {
         priceResultsContainerEl.innerHTML = '<p style="text-align:center; color:#c0392b;">Ocorreram erros em todos os cálculos. Verifique as mensagens individuais.</p>';
    }
}


async function handleCalculatePrices() {
    if (!calculatePricesBtnEl || !priceCalcStatusEl) return;
    displayStatusMessage(priceCalcStatusEl, `${createSpinnerIcon()} Calculando preços...`, 'info', true);
    calculatePricesBtnEl.disabled = true;

    const selectedAccountCheckboxes = publishMlAccountsCheckboxesContainerEl?.querySelectorAll('input[type="checkbox"]:checked');
    const selectedMlAccountsForCalc = selectedAccountCheckboxes ? Array.from(selectedAccountCheckboxes).map(cb => cb.name) : [];

    if (selectedMlAccountsForCalc.length === 0) {
        displayStatusMessage(priceCalcStatusEl, "Nenhuma conta ML selecionada na seção 'Publicar' para calcular os preços.", 'warning');
        calculatePricesBtnEl.disabled = false;
        calculatedPricesData = {}; // Limpa dados antigos
        renderPriceCalculationResults();
        return;
    }

    // Coleta dados da UI da Aba Produto & SKU
    const productCategoryId = document.getElementById('mlCategoryIdHidden')?.value;
    if (!productCategoryId) {
        displayStatusMessage(priceCalcStatusEl, "ID da Categoria ML não definido na Aba 'Produto & SKU'.", 'warning');
        calculatePricesBtnEl.disabled = false;
        return;
    }

    const priceCalcPayload = {
        cost_price: parseFloat(costPriceInputEl?.value) || 0,
        desired_profit: parseFloat(desiredProfitInputEl?.value) || 0,
        profit_type: profitTypeSelectEl?.value || 'REAIS', // REAIS ou PERCENT
        product_category_id: productCategoryId,
        origin_zip: originZipInputEl?.value.trim(),
        dimensions: {
            height: parseFloat(alturaInputEl?.value) || 0,
            width: parseFloat(larguraInputEl?.value) || 0,
            length: parseFloat(comprimentoInputEl?.value) || 0,
            weight_kg: parseFloat(pesoInputEl?.value) || 0
        },
        apply_discount_10: applyDiscount10CheckboxEl?.checked || false,
        include_anticipation_fee: includeAnticipationFeeCheckboxEl?.checked || false,
        offer_free_shipping: offerFreeShippingCheckboxEl?.checked || false,
        publish_classic: publishClassicCheckboxEl?.checked || false, // Pega da seção Publicar
        publish_premium: publishPremiumCheckboxEl?.checked || false, // Pega da seção Publicar
        selected_ml_accounts: selectedMlAccountsForCalc
    };

    console.log("Payload para cálculo de preços:", priceCalcPayload);

    try {
        calculatedPricesData = await calculateMLPricesAPI(priceCalcPayload); // Chama a API
        renderPriceCalculationResults(); // Atualiza a UI com os resultados
        displayStatusMessage(priceCalcStatusEl, "Cálculo de preços concluído.", 'success');
    } catch (error) {
        console.error("Erro ao calcular preços:", error);
        displayStatusMessage(priceCalcStatusEl, `Erro no cálculo: ${error.message}`, 'error');
        calculatedPricesData = {}; // Limpa em caso de erro total
        renderPriceCalculationResults();
    } finally {
        calculatePricesBtnEl.disabled = false;
    }
}

function renderPublishAccountCheckboxes() {
    if (!publishMlAccountsCheckboxesContainerEl) return;
    publishMlAccountsCheckboxesContainerEl.innerHTML = `${createSpinnerIcon()} Carregando contas...`;

    const mlAccounts = window.dashboardAppShared?.mlAccountsData || JSON.parse(sessionStorage.getItem('mlAccountsCache') || '{}');

    publishMlAccountsCheckboxesContainerEl.innerHTML = ''; // Limpa
    if (Object.keys(mlAccounts).length === 0) {
        publishMlAccountsCheckboxesContainerEl.innerHTML = '<p><small>Nenhuma conta ML configurada na aba "Contas ML".</small></p>';
        return;
    }

    Object.keys(mlAccounts).sort().forEach(nickname => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'checkbox-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `pub_acc_${nickname}`;
        checkbox.name = nickname; // Usado para pegar as contas selecionadas
        checkbox.className = 'styled-checkbox';
        // Poderia marcar a conta ativa por padrão, se desejado
        // if (nickname === window.dashboardAppShared?.currentActiveMLAccountNickname) {
        //     checkbox.checked = true;
        // }

        const label = document.createElement('label');
        label.htmlFor = `pub_acc_${nickname}`;
        label.className = 'checkbox-label';
        label.textContent = nickname;

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        publishMlAccountsCheckboxesContainerEl.appendChild(itemDiv);
    });
}

async function handlePublishToMl() {
    // Esta função será complexa. Por enquanto, um placeholder.
    if(!publishToMlBtnEl || !publishStatusEl) return;
    displayStatusMessage(publishStatusEl, "Funcionalidade de Publicar ainda não implementada no frontend.", 'info');
    console.log("Botão Publicar Clicado - Lógica a ser implementada.");

    // 1. Coletar todos os dados das abas:
    //    - Aba Produto: title, qty, seller_sku, handling_time, local_pickup, category_id
    //    - Aba Imagens: getCurrentProductImages() -> lista de {source: url}
    //    - Aba Ficha: getCurrentAttributesForPayload() -> lista de {id: "ID", value_name/id: "VAL"}
    //                 getCurrentDescription() -> string da descrição
    //    - Aba Preços: selected_ml_accounts, publish_classic, publish_premium,
    //                  calculatedPricesData (para pegar os preços por conta/tipo),
    //                  selected_compat_profile (do publishCompatProfileSelectEl.value)

    // 2. Validar dados obrigatórios.

    // 3. Construir o payload para o backend /api/ml/item/publish
    //    O backend cuidará de iterar pelas contas e tipos de anúncio.

    // 4. Chamar a API e mostrar resultados.
}


export function initPricingPublishTab() {
    console.log("Pricing & Publish Tab Initialized");

    if (calculatePricesBtnEl) {
        calculatePricesBtnEl.addEventListener('click', handleCalculatePrices);
    }

    if (publishToMlBtnEl) {
        publishToMlBtnEl.addEventListener('click', handlePublishToMl)
    }

    if (refreshCompatProfilesPublishBtnEl) {
        refreshCompatProfilesPublishBtnEl.addEventListener('click', () => {
            // TODO: Implementar lógica para buscar perfis de compatibilidade
            // e popular o publishCompatProfileSelectEl
            console.log("Botão Atualizar Perfis de Compatibilidade clicado - Lógica a implementar");
            if(publishCompatProfileSelectEl) {
                publishCompatProfileSelectEl.innerHTML = '<option value="">Carregando...</option>';
                // Simula uma carga
                setTimeout(() => {
                     publishCompatProfileSelectEl.innerHTML = '<option value="">Nenhum Perfil</option><option value="perfil_teste_1">Perfil Teste 1</option>';
                }, 1000);
            }
        });
        // Disparar clique inicial para carregar
        refreshCompatProfilesPublishBtnEl.dispatchEvent(new Event('click'));
    }
    // Carregar dados iniciais necessários para esta aba
    loadDataForPricingTab();
}

// Função chamada quando a aba é ativada
export function loadDataForPricingTab() {
    console.log("loadDataForPricingTab chamada.");
    renderPublishAccountCheckboxes(); // Popula os checkboxes de contas
    renderPriceCalculationResults(); // Renderiza resultados de cálculo (pode estar vazio inicialmente)
    // A lógica de carregar perfis de compatibilidade também pode ir aqui ou ser chamada pelo botão refresh.
}

console.log("pricing_publish_tab.js loaded");