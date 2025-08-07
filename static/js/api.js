// backend/static/js/api.js
import { displayStatusMessage, createSpinnerIcon } from './ui_helpers.js';

const API_BASE_URL = ''; // Relativo à raiz do site, então /api/... funcionará

async function handleApiResponse(response, callingFunctionName = 'API call') {
    if (!response.ok) {
        let errorData = { error_message: `Erro HTTP ${response.status} - ${response.statusText}` };
        try {
            const jsonError = await response.json();
            if (jsonError && jsonError.error_message) {
                errorData.error_message = jsonError.error_message;
            } else if (jsonError && jsonError.error) { // Alguns endpoints podem usar 'error'
                 errorData.error_message = jsonError.error;
            } else if (jsonError && jsonError.message) { // Outros podem usar 'message'
                 errorData.error_message = jsonError.message;
            }
        } catch (e) {
            // Não conseguiu parsear JSON, usa o statusText
            console.warn(`[${callingFunctionName}] Falha ao parsear JSON da resposta de erro:`, e);
        }
        console.error(`[${callingFunctionName}] Erro na resposta da API (${response.status}):`, errorData.error_message);
        throw new Error(errorData.error_message);
    }
    try {
        return await response.json();
    } catch (e) {
        console.error(`[${callingFunctionName}] Erro ao parsear JSON da resposta bem-sucedida:`, e);
        throw new Error("Resposta do servidor não é um JSON válido, mesmo com status OK.");
    }
}

// == Configurações da Aplicação ==
export async function fetchAppConfigAPI() {
    const response = await fetch(`${API_BASE_URL}/api/app-config`);
    return handleApiResponse(response, 'fetchAppConfigAPI');
}

export async function saveAppConfigAPI(configData) {
    const response = await fetch(`${API_BASE_URL}/api/app-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
    });
    return handleApiResponse(response, 'saveAppConfigAPI'); // Retorna o JSON da resposta
}

// == Mercado Livre Contas & Auth ==
export async function fetchMLAccountsAPI() {
    const response = await fetch(`${API_BASE_URL}/api/ml/accounts`);
    return handleApiResponse(response, 'fetchMLAccountsAPI');
}

export async function removeMLAccountAPI(nickname) {
    const response = await fetch(`${API_BASE_URL}/api/ml/accounts/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname })
    });
    return handleApiResponse(response, 'removeMLAccountAPI');
}

export async function setActiveMLAccountAPI(nickname) {
    const response = await fetch(`${API_BASE_URL}/api/ml/accounts/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname })
    });
    return handleApiResponse(response, 'setActiveMLAccountAPI');
}

// == Tiny ERP ==
export async function fetchTinyProductDetailsAPI(sku, idTiny) {
    const params = new URLSearchParams();
    if (sku) params.append('sku', sku);
    if (idTiny) params.append('id', idTiny);
    const response = await fetch(`${API_BASE_URL}/api/tiny/product-details?${params.toString()}`);
    return handleApiResponse(response, 'fetchTinyProductDetailsAPI'); // Retorna product_data ou error
}

// == Mercado Livre - Categorias e Atributos ==
export async function fetchMLCategorySuggestionAPI(title) {
    const response = await fetch(`${API_BASE_URL}/api/ml/suggest-category?title=${encodeURIComponent(title)}`);
    return handleApiResponse(response, 'fetchMLCategorySuggestionAPI');
}

export async function fetchMLCategoriesAPI(categoryId = null) {
    const url = categoryId ? `${API_BASE_URL}/api/ml/categories/${categoryId}` : `${API_BASE_URL}/api/ml/categories`;
    const response = await fetch(url);
    return handleApiResponse(response, 'fetchMLCategoriesAPI'); // Espera-se que o backend retorne a lista
}

export async function searchMLCategoriesAPI(query) {
    const response = await fetch(`${API_BASE_URL}/api/ml/categories/search?q=${encodeURIComponent(query)}`);
    return handleApiResponse(response, 'searchMLCategoriesAPI'); // Espera-se que o backend retorne a lista
}

export async function fetchMLCategoryAttributesAPI(categoryId) {
    const response = await fetch(`${API_BASE_URL}/api/ml/category-attributes/${categoryId}`);
    return handleApiResponse(response, 'fetchMLCategoryAttributesAPI'); // Espera-se que o backend retorne a lista
}

// == OpenAI (ChatGPT) ==
export async function generateDescriptionChatGptAPI(title, currentDescription) {
    const response = await fetch(`${API_BASE_URL}/api/ml/generate-description-chatgpt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, current_description: currentDescription })
    });
    return handleApiResponse(response, 'generateDescriptionChatGptAPI');
}

// == Mercado Livre - SKU Check ==
export async function checkMLSkuStatusAPI(sku) {
    const response = await fetch(`${API_BASE_URL}/api/ml/check-sku-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: sku })
    });
    return handleApiResponse(response, 'checkMLSkuStatusAPI'); // Retorna o objeto com resultados por conta
}

// == Processamento de Imagem ==
export async function optimizeImageAPI(imageUrl) {
    const response = await fetch(`${API_BASE_URL}/api/image/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageUrl })
    });
    return handleApiResponse(response, 'optimizeImageAPI');
}

export async function removeBackgroundImageAPI(imageUrl) {
    const response = await fetch(`${API_BASE_URL}/api/image/remove-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageUrl })
    });
    return handleApiResponse(response, 'removeBackgroundImageAPI');
}

// == Mercado Livre - Cálculo de Preços ==
export async function calculateMLPricesAPI(priceCalcData) {
    const response = await fetch(`${API_BASE_URL}/api/ml/calculate-prices`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(priceCalcData)
    });
    return handleApiResponse(response, 'calculateMLPricesAPI'); // Retorna resultados por conta
}


// Adicione mais funções de API aqui conforme necessário para outras abas/funcionalidades

console.log("api.js loaded");