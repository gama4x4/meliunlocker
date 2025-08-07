// backend/static/js/config_api.js
import { fetchAppConfigAPI, saveAppConfigAPI } from './api.js';
import { displayStatusMessage, createSpinnerIcon } from './ui_helpers.js';

const tinyApiTokenInput = document.getElementById('tinyApiTokenInput');
const removebgApiKeyInput = document.getElementById('removebgApiKeyInput');
const removeBgCreditsEl = document.getElementById('removeBgCredits');
const imgurClientIdInput = document.getElementById('imgurClientIdInput');
const chatgptApiKeyInput = document.getElementById('chatgptApiKeyInput');
const saveApiConfigsBtn = document.getElementById('saveApiConfigsBtn');
const configApiStatusEl = document.getElementById('configApiStatus');

let appConfigCache = {};

function updateRemoveBgCreditsDisplayOnAllTabs(configData) { // INÍCIO updateRemoveBgCreditsDisplayOnAllTabs
    const currentConfig = configData || appConfigCache;
    const keyPresent = !!currentConfig.removebg_api_key;
    const used = currentConfig.removebg_credits_used_month || 0;
    const total = 50;
    const remaining = Math.max(0, total - used);
    
    let text = 'Remove.bg Créditos: ';
    if (keyPresent) { // IF keyPresent
        text += `${remaining}/${total}`;
    } else { // ELSE keyPresent
        text += 'Chave API N/D';
    } // FIM ELSE keyPresent
    
    const elementsToUpdate = [
        removeBgCreditsEl, 
        document.getElementById('removeBgCreditsTabImagens') 
    ];

    elementsToUpdate.forEach(el => { // INÍCIO forEach
        if (el) { // IF el
            el.textContent = text;
            el.className = 'api-status-text'; 

            if (keyPresent) { // IF keyPresent (interno)
                if (remaining <= 0) { el.classList.add('error'); }
                else if (remaining < 10) { el.classList.add('warning'); }
                else { el.classList.add('success'); }
            } else { // ELSE keyPresent (interno)
                el.classList.add('info');
            } // FIM ELSE keyPresent (interno)
        } // FIM IF el
    }); // FIM forEach
} // FIM updateRemoveBgCreditsDisplayOnAllTabs

async function loadApiConfigsToUIInternal() { // INÍCIO loadApiConfigsToUIInternal
    console.log("loadApiConfigsToUIInternal: Iniciando carregamento de configurações.");
    if (configApiStatusEl) { displayStatusMessage(configApiStatusEl, `${createSpinnerIcon()} Carregando configurações...`, 'info', true); }
    
    try { // INÍCIO TRY load
        const config = await fetchAppConfigAPI(); 
        appConfigCache = config; 
        sessionStorage.setItem('appConfigCache', JSON.stringify(config)); 

        if (tinyApiTokenInput) { tinyApiTokenInput.value = config.tiny_api_v2_token || ''; }
        if (removebgApiKeyInput) { removebgApiKeyInput.value = config.removebg_api_key || ''; }
        if (imgurClientIdInput) { imgurClientIdInput.value = config.imgur_client_id || ''; }
        if (chatgptApiKeyInput) { chatgptApiKeyInput.value = config.chatgpt_api_key || ''; }
        
        updateRemoveBgCreditsDisplayOnAllTabs(config); 
        
        if (configApiStatusEl) { displayStatusMessage(configApiStatusEl, "Configurações API carregadas com sucesso.", 'success'); }
        console.log("loadApiConfigsToUIInternal: Configurações carregadas e UI atualizada:", config);

    } catch (error) { // INÍCIO CATCH load
        console.error("loadApiConfigsToUIInternal: Erro ao carregar configs:", error);
        if (configApiStatusEl) { displayStatusMessage(configApiStatusEl, `Erro ao carregar configurações: ${error.message}`, 'error'); }
        
        const cachedConfigString = sessionStorage.getItem('appConfigCache');
        if (cachedConfigString) { // IF cachedConfigString
            try { // INÍCIO TRY cache
                const configFromCache = JSON.parse(cachedConfigString);
                if (tinyApiTokenInput) { tinyApiTokenInput.value = configFromCache.tiny_api_v2_token || ''; }
                if (removebgApiKeyInput) { removebgApiKeyInput.value = configFromCache.removebg_api_key || ''; }
                if (imgurClientIdInput) { imgurClientIdInput.value = configFromCache.imgur_client_id || ''; }
                if (chatgptApiKeyInput) { chatgptApiKeyInput.value = configFromCache.chatgpt_api_key || ''; }
                updateRemoveBgCreditsDisplayOnAllTabs(configFromCache);
                if (configApiStatusEl) { displayStatusMessage(configApiStatusEl, `Configurações carregadas do cache local. Erro original: ${error.message}`, 'warning'); }
                console.log("loadApiConfigsToUIInternal: Configurações carregadas do cache devido a erro.", configFromCache);
            } catch(e){ console.error("loadApiConfigsToUIInternal: Erro ao parsear config do cache sessionStorage:", e); } // FIM CATCH cache
        } // FIM IF cachedConfigString
    } // FIM CATCH load
} // FIM loadApiConfigsToUIInternal

async function handleSaveApiConfigs() { // INÍCIO handleSaveApiConfigs
    console.log("handleSaveApiConfigs: Botão Salvar Clicado.");
    if (!saveApiConfigsBtn || !configApiStatusEl) { // IF !saveApiConfigsBtn
        console.error("handleSaveApiConfigs: Elementos essenciais da UI não encontrados.");
        return;
    } // FIM IF !saveApiConfigsBtn
    displayStatusMessage(configApiStatusEl, `${createSpinnerIcon()} Salvando configurações...`, 'info', true);
    
    const newConfigData = {
        tiny_api_v2_token: tinyApiTokenInput?.value.trim(),
        removebg_api_key: removebgApiKeyInput?.value.trim(),
        imgur_client_id: imgurClientIdInput?.value.trim(),
        chatgpt_api_key: chatgptApiKeyInput?.value.trim()
    };
    Object.keys(newConfigData).forEach(key => { // INÍCIO forEach keys
        if (newConfigData[key] === undefined) { delete newConfigData[key]; }
    }); // FIM forEach keys
    console.log("handleSaveApiConfigs: Dados para salvar:", newConfigData);

    try { // INÍCIO TRY save
        const result = await saveAppConfigAPI(newConfigData); 
        console.log("handleSaveApiConfigs: Resposta do saveAppConfigAPI:", result);
        if (result.success) { // IF result.success
            displayStatusMessage(configApiStatusEl, result.message || "Configurações salvas com sucesso!", 'success');
            setTimeout(loadApiConfigsToUIInternal, 300); 
        } else { // ELSE result.success
            throw new Error(result.error || result.message || "Erro desconhecido ao salvar configurações.");
        } // FIM ELSE result.success
    } catch (error) { // INÍCIO CATCH save
        console.error("handleSaveApiConfigs: Erro ao salvar:", error);
        if (configApiStatusEl) { displayStatusMessage(configApiStatusEl, `Erro ao salvar configurações: ${error.message}`, 'error'); }
    } // FIM CATCH save
} // FIM handleSaveApiConfigs

export function initConfigApiTab() { // INÍCIO initConfigApiTab
    console.log("--- initConfigApiTab INICIADA ---");
    console.log("Elemento saveApiConfigsBtn:", saveApiConfigsBtn); 
    console.log("Elemento configApiStatusEl:", configApiStatusEl);

    if (saveApiConfigsBtn) { // IF saveApiConfigsBtn
        saveApiConfigsBtn.addEventListener('click', handleSaveApiConfigs);
        console.log("Listener de clique para saveApiConfigsBtn ADICIONADO.");
    } else { // ELSE saveApiConfigsBtn
        console.error("ERRO em initConfigApiTab: Botão saveApiConfigsBtn NÃO encontrado no DOM!");
    } // FIM ELSE saveApiConfigsBtn
    
    loadApiConfigsToUIInternal(); 
    console.log("--- initConfigApiTab FINALIZADA ---");
} // FIM initConfigApiTab (Linha 149 do código que você me passou)

// Função exportada para ser chamada pelo dashboard.js quando a aba de configurações é ativada/clicada
export function loadApiConfigsJS() { // INÍCIO loadApiConfigsJS (Linha 151)
    console.log("loadApiConfigsJS (chamada externa): Recarregando dados da aba Configurações."); // <<< LINHA 152
    loadApiConfigsToUIInternal();
} // FIM loadApiConfigsJS (Linha 154)

console.log("config_api.js loaded"); // Linha 156