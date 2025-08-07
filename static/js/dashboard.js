// backend/static/js/dashboard.js
document.addEventListener('DOMContentLoaded', function () {
    // --- Seletores Globais de Elementos DOM ---
    const menuItems = document.querySelectorAll('.sidebar .menu-item');
    const tabPanes = document.querySelectorAll('.main-content .tab-pane');
    const pageTitleElement = document.getElementById('pageTitle');
    const globalStatusElement = document.getElementById('globalStatus');

    // --- Aba Configurações API ---
    const tinyApiTokenInput = document.getElementById('tinyApiTokenInput');
    const removebgApiKeyInput = document.getElementById('removebgApiKeyInput');
    const removeBgCreditsEl = document.getElementById('removeBgCredits');
    const imgurClientIdInput = document.getElementById('imgurClientIdInput');
    const chatgptApiKeyInput = document.getElementById('chatgptApiKeyInput');
    const saveApiConfigsBtn = document.getElementById('saveApiConfigsBtn');
    const configApiStatusEl = document.getElementById('configApiStatus');

    // --- Aba Contas Mercado Livre ---
    const addMLAccountBtn = document.getElementById('addMLAccountBtn');
    const mlAccountsListDiv = document.getElementById('mlAccountsList');
    const mlAccountStatusEl = document.getElementById('mlAccountStatus');
    let currentActiveMLAccountNickname = null;

    // --- Aba Produto & SKU ---
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

    // --- Modal de Categorias ML ---
    const categoryBrowserModal = document.getElementById('mlCategoryBrowserModal');
    const closeCategoryBrowserModalBtn = document.getElementById('closeCategoryBrowserModal');
    const categorySearchInput = document.getElementById('categorySearchInput');
    const loadRootCategoriesLink = document.getElementById('loadRootCategoriesLink');
    const categoryListUl = document.getElementById('categoryListUl');
    const categoryBrowserStatus = document.getElementById('categoryBrowserStatus');

    // --- Aba Imagens ---
    const newImageUrlInput = document.getElementById('newImageUrlInput');
    const addImageUrlBtn = document.getElementById('addImageUrlBtn');
    const imageAddStatusEl = document.getElementById('imageAddStatus');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const optimizeFirstImageBtn = document.getElementById('optimizeFirstImageBtn');
    const removeBgFirstImageBtn = document.getElementById('removeBgFirstImageBtn');
    const removeBgCreditsTabImagensEl = document.getElementById('removeBgCreditsTabImagens');
    let productImages = [];

    // --- Aba Ficha & Descrição ---
    const mlDescriptionTextarea = document.getElementById('mlDescriptionTextarea');
    const generateDescChatGptBtn = document.getElementById('generateDescChatGptBtn');
    const descriptionStatusEl = document.getElementById('descriptionStatus');
    const mlAttributesContainer = document.getElementById('mlAttributesContainer');
    const attributesStatusEl = document.getElementById('attributesStatus');
    let currentMlCategoryIdForAttributes = null;
    let lastTinyProductDataForAttributes = null;

    // --- Seletores para campos que serão preenchidos automaticamente (Aba de Preços) ---
    const costPriceInput = document.getElementById('priceCalcCustoInput');
    const alturaInput = document.getElementById('priceCalcAlturaInput');
    const larguraInput = document.getElementById('priceCalcLarguraInput');
    const comprimentoInput = document.getElementById('priceCalcComprimentoInput');
    const pesoInput = document.getElementById('priceCalcPesoInput');
    const cepOrigemInput = document.getElementById('priceCalcCepOrigemInput');

    // =================================================================================
    // --- LÓGICA DE NAVEGAÇÃO POR ABAS ---
    // =================================================================================
    function updatePageTitle(menuItemElement) {
        if (pageTitleElement && menuItemElement) {
            const iconElement = menuItemElement.querySelector('.icon');
            let cleanTitle = menuItemElement.textContent || "";
            if (iconElement && iconElement.textContent) {
                cleanTitle = cleanTitle.replace(iconElement.textContent, '').trim();
            }
            pageTitleElement.textContent = cleanTitle;
        }
    }

    menuItems.forEach(item => {
        item.addEventListener('click', function (event) {
            event.preventDefault();
            menuItems.forEach(mi => mi.classList.remove('active'));
            tabPanes.forEach(tp => tp.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            const activeTabPane = document.getElementById(tabId);
            if (activeTabPane) {
                activeTabPane.classList.add('active');
                updatePageTitle(this);
            }
            if (tabId === 'tabConfiguracoes') loadApiConfigs();
            else if (tabId === 'tabContasML') loadMLAccounts();
            else if (tabId === 'tabImagens') { renderProductImages(); }
        });
    });
    if (menuItems.length > 0) menuItems[0].click();


    // =================================================================================
    // --- LÓGICA PARA ABA "CONFIGURAÇÕES API" ---
    // =================================================================================
    async function loadApiConfigs() {
        if(configApiStatusEl) {configApiStatusEl.textContent = "Carregando..."; configApiStatusEl.className = 'status-message info';}
        try {
            const response = await fetch('/api/app-config');
            if (!response.ok) { const errorData = await response.json().catch(() => ({ error: 'Resposta servidor inválida' })); throw new Error(errorData.error || `Falha configs: ${response.status}`);}
            const config = await response.json();
            sessionStorage.setItem('appConfigCache', JSON.stringify(config));
            if (tinyApiTokenInput) tinyApiTokenInput.value = config.tiny_api_v2_token || '';
            if (removebgApiKeyInput) removebgApiKeyInput.value = config.removebg_api_key || '';
            if (imgurClientIdInput) imgurClientIdInput.value = config.imgur_client_id || '';
            if (chatgptApiKeyInput) chatgptApiKeyInput.value = config.chatgpt_api_key || '';
            updateRemoveBgCreditsDisplay(config);
            if(configApiStatusEl) {configApiStatusEl.textContent = "Configurações carregadas."; configApiStatusEl.className = 'status-message success';}
        } catch (error) { if (configApiStatusEl) {configApiStatusEl.textContent = `Erro: ${error.message}`; configApiStatusEl.className = 'status-message error';}}
    }

    function updateRemoveBgCreditsDisplay(configData) {
        const currentConfig = configData || JSON.parse(sessionStorage.getItem('appConfigCache') || '{}');
        const keyPresent = !!currentConfig.removebg_api_key;
        const used = currentConfig.removebg_credits_used_month || 0; const total = 50;
        const remaining = Math.max(0, total - used);
        const text = keyPresent ? `Créditos: ${remaining}/${total}` : 'Chave Remove.bg N/D';
        let className = 'api-status-text info';
        if (keyPresent) { if (remaining <= 0) className = 'api-status-text error'; else if (remaining < 10) className = 'api-status-text warning'; else className = 'api-status-text success';}
        if(removeBgCreditsEl) { removeBgCreditsEl.textContent = text; removeBgCreditsEl.className = className; }
        if(removeBgCreditsTabImagensEl) { removeBgCreditsTabImagensEl.textContent = text; removeBgCreditsTabImagensEl.className = className; }
    }

    if (saveApiConfigsBtn) { saveApiConfigsBtn.addEventListener('click', async () => {
        if(configApiStatusEl) {configApiStatusEl.textContent = "Salvando..."; configApiStatusEl.className = 'status-message info';}
        const newConfigData = { tiny_api_v2_token: tinyApiTokenInput?.value.trim(), removebg_api_key: removebgApiKeyInput?.value.trim(), imgur_client_id: imgurClientIdInput?.value.trim(), chatgpt_api_key: chatgptApiKeyInput?.value.trim()};
        Object.keys(newConfigData).forEach(key => newConfigData[key] === undefined && delete newConfigData[key]);
        try {
            const response = await fetch('/api/app-config', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newConfigData)});
            const result = await response.json();
            if (configApiStatusEl) { configApiStatusEl.textContent = result.message || result.error; configApiStatusEl.className = result.success ? 'status-message success' : 'status-message error';}
            if(result.success) setTimeout(loadApiConfigs, 500);
        } catch (error) { if (configApiStatusEl) {configApiStatusEl.textContent = `Erro: ${error.message}`; configApiStatusEl.className = 'status-message error';}}
    });}

    // =================================================================================
    // --- LÓGICA PARA ABA "CONTAS MERCADO LIVRE" ---
    // =================================================================================
    function updateGlobalStatusWithActiveMLAccount(activeAccountDetails) {
        if (globalStatusElement) {
            if (activeAccountDetails && activeAccountDetails.nickname) {
                currentActiveMLAccountNickname = activeAccountDetails.nickname;
                const tokenStatusIcon = activeAccountDetails.token_valid ? '<i class="fas fa-shield-alt" style="color: green;" title="Token Válido"></i>' : '<i class="fas fa-exclamation-triangle" style="color: orange;" title="Token Inválido/Expirado - Tente reativar ou readicionar"></i>';
                globalStatusElement.innerHTML = `Conta ML Ativa: <strong>${activeAccountDetails.nickname}</strong> (Envio: ${activeAccountDetails.shipping_mode.toUpperCase()}) ${tokenStatusIcon}`;
            } else { currentActiveMLAccountNickname = null; globalStatusElement.innerHTML = '<i class="fas fa-plug"></i> Nenhuma conta ML ativa.';}
        }
    }
    async function loadMLAccounts() {
        if (!mlAccountsListDiv) return; mlAccountsListDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Carregando contas...</p>';
        try {
            const response = await fetch('/api/ml/accounts');
            if (!response.ok) { const errD = await response.json().catch(()=>({error:'Err servidor'})); throw new Error(errD.error || `Falha contas: ${response.status}`);}
            const accounts = await response.json(); mlAccountsListDiv.innerHTML = ''; const ul = document.createElement('ul'); ul.className = 'ml-accounts-list-ul';
            if (Object.keys(accounts).length === 0) { mlAccountsListDiv.innerHTML = '<p>Nenhuma conta ML configurada.</p>'; updateGlobalStatusWithActiveMLAccount(null); return;}
            if (currentActiveMLAccountNickname && !accounts[currentActiveMLAccountNickname]) currentActiveMLAccountNickname = null;
            for (const nickname in accounts) {
                const acc = accounts[nickname]; const li = document.createElement('li'); const tokenExpiresAt = acc.expires_at ? acc.expires_at * 1000 : 0;
                const isTokenValid = acc.access_token && Date.now() < tokenExpiresAt; const isActive = nickname === currentActiveMLAccountNickname;
                li.className = isActive ? 'ml-account-item active-account' : 'ml-account-item';
                li.innerHTML = `<div class="account-info"><span class="account-nick">${nickname}</span><span class="account-status ${isTokenValid ? 'status-ok' : 'status-error'}"><i class="fas ${isTokenValid ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${isTokenValid ? 'Válido' : 'Inválido'}</span><span class="account-sellerid">ID: ${acc.seller_id || 'N/A'}</span><span class="account-shipping">Envio: ${acc.shipping_mode ? acc.shipping_mode.toUpperCase() : 'N/A'}</span></div><div class="account-actions"><button class="btn-small btn-set-active" data-nick="${nickname}" ${isActive ? 'disabled' : ''} title="${isActive ? 'Já ativa' : 'Ativar'}"><i class="fas ${isActive ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${isActive ? 'Ativa' : 'Ativar'}</button><button class="btn-small btn-remove-account" data-nick="${nickname}" title="Remover"><i class="fas fa-trash-alt"></i></button></div>`;
                ul.appendChild(li);
            }
            mlAccountsListDiv.appendChild(ul); addAccountActionListeners();
            let activeAccountSet = false;
            if (currentActiveMLAccountNickname && accounts[currentActiveMLAccountNickname]) {
                 const activeAccData = accounts[currentActiveMLAccountNickname];
                 updateGlobalStatusWithActiveMLAccount({nickname: currentActiveMLAccountNickname, shipping_mode: activeAccData.shipping_mode || 'me2', token_valid: activeAccData.access_token && Date.now() < (activeAccData.expires_at || 0) * 1000});
                 activeAccountSet = true;
            }
            if (!activeAccountSet) { updateGlobalStatusWithActiveMLAccount(null); }
        } catch (error) { if (mlAccountsListDiv) mlAccountsListDiv.innerHTML = `<p class="error-message">Erro: ${error.message}</p>`;}
    }
    function addAccountActionListeners() {
        document.querySelectorAll('.btn-set-active').forEach(btn => { btn.addEventListener('click', async (e) => { await setActiveMLAccount(e.currentTarget.dataset.nick); }); });
        document.querySelectorAll('.btn-remove-account').forEach(btn => { btn.addEventListener('click', async (e) => { if (confirm(`Remover conta ML "${e.currentTarget.dataset.nick}"? Esta ação não pode ser desfeita.`)) { await removeMLAccount(e.currentTarget.dataset.nick); }}); });
    }
    async function setActiveMLAccount(nickname, reloadList = true) {
        if (mlAccountStatusEl) {mlAccountStatusEl.textContent = `Ativando ${nickname}...`; mlAccountStatusEl.className = 'status-message info';}
        try {
            const response = await fetch('/api/ml/accounts/set-active', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nickname: nickname})});
            const result = await response.json();
            if (mlAccountStatusEl) {mlAccountStatusEl.textContent = result.message || result.error; mlAccountStatusEl.className = result.success ? 'status-message success' : 'status-message error';}
            if (result.success && result.active_account_details) { updateGlobalStatusWithActiveMLAccount(result.active_account_details); if (reloadList) loadMLAccounts();}
            else if (result.success) { updateGlobalStatusWithActiveMLAccount({nickname: nickname, shipping_mode: 'N/A', token_valid: false}); if (reloadList) loadMLAccounts();}
        } catch (error) { if (mlAccountStatusEl) {mlAccountStatusEl.textContent = `Erro ao ativar conta: ${error.message}`; mlAccountStatusEl.className = 'status-message error';}}
    }
    async function removeMLAccount(nickname) {
        if (mlAccountStatusEl) {mlAccountStatusEl.textContent = `Removendo ${nickname}...`; mlAccountStatusEl.className = 'status-message info';}
        try {
            const response = await fetch('/api/ml/accounts/remove', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nickname: nickname})});
            const result = await response.json();
            if (mlAccountStatusEl) {mlAccountStatusEl.textContent = result.message || result.error; mlAccountStatusEl.className = result.success ? 'status-message success' : 'status-message error';}
            if (result.success) { if (currentActiveMLAccountNickname === nickname) { updateGlobalStatusWithActiveMLAccount(null); } loadMLAccounts(); }
        } catch (error) { if (mlAccountStatusEl) {mlAccountStatusEl.textContent = `Erro ao remover conta: ${error.message}`; mlAccountStatusEl.className = 'status-message error';}}
    }
    if (addMLAccountBtn) { addMLAccountBtn.addEventListener('click', () => {
        if (mlAccountStatusEl) {mlAccountStatusEl.textContent = "Abrindo autorização ML..."; mlAccountStatusEl.className = 'status-message info';}
        const oauthWindow = window.open('/oauth/ml/start-auth', 'MercadoLivreAuth', 'width=800,height=650,scrollbars=yes,resizable=yes');
        if (oauthWindow) { oauthWindow.focus(); const timer = setInterval(() => { if (oauthWindow.closed) { clearInterval(timer); if (mlAccountStatusEl) {mlAccountStatusEl.textContent = "Autorização fechada. Verificando...";} setTimeout(loadMLAccounts, 1200);}}, 500);}
        else { if (mlAccountStatusEl) {mlAccountStatusEl.textContent = 'Falha ao abrir pop-up.'; mlAccountStatusEl.className = 'status-message error';}}
    });}

    // =================================================================================
    // --- LÓGICA PARA ABA "PRODUTO & SKU" (TINY, CATEGORIA, SKU CHECK) ---
    // =================================================================================
    if (mlTitleInput && mlTitleCharCount) {
        mlTitleInput.addEventListener('input', () => {
            const currentLength = mlTitleInput.value.length; const maxLength = parseInt(mlTitleInput.maxLength) || 60;
            mlTitleCharCount.textContent = `${currentLength}/${maxLength}`;
            if (currentLength > maxLength) mlTitleCharCount.style.color = 'red';
            else if (currentLength > maxLength - 10 && currentLength <=maxLength) mlTitleCharCount.style.color = 'orange';
            else mlTitleCharCount.style.color = '#777';
        });
    }

    // AQUI ESTÁ A LÓGICA PARA O BOTÃO BUSCAR
    if (fetchTinyProductBtn) {
        fetchTinyProductBtn.addEventListener('click', async () => {
            const sku = tinySkuInput ? tinySkuInput.value.trim() : '';
            const idTiny = tinyIdInput ? tinyIdInput.value.trim() : '';

            if (!sku && !idTiny) {
                if (tinyProductStatusEl) {
                    tinyProductStatusEl.textContent = 'Insira SKU ou ID Tiny.';
                    tinyProductStatusEl.className = 'status-message warning';
                }
                return;
            }

            // Mostra feedback de carregamento
            fetchTinyProductBtn.disabled = true;
            fetchTinyProductBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Buscando...';
            if (tinyProductStatusEl) {
                tinyProductStatusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando no Tiny...';
                tinyProductStatusEl.className = 'status-message info';
            }
            
            // Limpa campos relevantes antes de uma nova busca
            [mlTitleInput, mlSellerSkuInput, mlHandlingTimeInput].forEach(el => { if (el) el.value = ''; });
            if (mlTitleCharCount) mlTitleCharCount.textContent = '0/60';
            if (mlQuantityInput) mlQuantityInput.value = '0';
            if (mlLocalPickupCheckbox) mlLocalPickupCheckbox.checked = false;

            try {
                const params = new URLSearchParams();
                if (sku) params.append('sku', sku);
                if (idTiny) params.append('id', idTiny);

                const response = await fetch(`/api/tiny/product-details?${params.toString()}`);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error_message || `Erro do servidor: ${response.status}`);
                }
                
                // Preenche os campos da UI com os dados recebidos do backend
                if (mlTitleInput) mlTitleInput.value = result.nome_tiny || '';
                if (mlTitleInput) mlTitleInput.dispatchEvent(new Event('input')); 
                if (mlQuantityInput) mlQuantityInput.value = result.estoque_tiny !== undefined ? result.estoque_tiny : '0';
                if (mlSellerSkuInput) mlSellerSkuInput.value = result.codigo_tiny || '';
                if (mlHandlingTimeInput) mlHandlingTimeInput.value = result.dias_preparacao_tiny || '';
                if (mlLocalPickupCheckbox) mlLocalPickupCheckbox.checked = result.permite_retirada_tiny || false;

                let precoBaseParaCusto = 0.0;
                if (result.preco_promocional_tiny && parseFloat(result.preco_promocional_tiny) > 0) {
                    precoBaseParaCusto = parseFloat(result.preco_promocional_tiny);
                } else if (result.preco_venda_tiny) {
                    precoBaseParaCusto = parseFloat(result.preco_venda_tiny);
                }
                if (costPriceInput) costPriceInput.value = precoBaseParaCusto > 0 ? precoBaseParaCusto.toFixed(2) : '0.00';
                if (alturaInput) alturaInput.value = parseFloat(result.altura_embalagem_tiny || 0).toFixed(1);
                if (larguraInput) larguraInput.value = parseFloat(result.largura_embalagem_tiny || 0).toFixed(1);
                if (comprimentoInput) comprimentoInput.value = parseFloat(result.comprimento_embalagem_tiny || 0).toFixed(1);
                if (pesoInput) pesoInput.value = parseFloat(result.peso_bruto_tiny || 0).toFixed(3);

                if (tinyProductStatusEl) {
                    tinyProductStatusEl.textContent = `Produto "${result.nome_tiny}" carregado!`;
                    tinyProductStatusEl.className = 'status-message success';
                }
                
                lastTinyProductDataForAttributes = result; // Salva os dados para uso posterior
                if (typeof populateImagesFromTiny === "function") { populateImagesFromTiny(result.anexos_tiny); }
                if (mlDescriptionTextarea && result.descricao_complementar_tiny !== undefined) { mlDescriptionTextarea.value = result.descricao_complementar_tiny; }
                
                if (mlTitleInput.value && suggestMlCategoryBtn) { suggestMlCategoryBtn.click(); }
                if (mlSellerSkuInput.value) { checkMlSkuStatus(mlSellerSkuInput.value); }

            } catch (error) {
                console.error('Erro ao buscar produto no Tiny:', error);
                if (tinyProductStatusEl) {
                    tinyProductStatusEl.textContent = `Erro Tiny: ${error.message}`;
                    tinyProductStatusEl.className = 'status-message error';
                }
            } finally {
                fetchTinyProductBtn.disabled = false;
                fetchTinyProductBtn.innerHTML = 'Buscar';
            }
        });
    }

    async function checkMlSkuStatus(sku) {
        if (!sku) { if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p>SKU ML não fornecido.</p>'; return; }
        if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Verificando SKU ML...</p>';
        try {
            const response = await fetch('/api/ml/check-sku-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: sku }) });
            const results = await response.json(); if (!response.ok && results.error_message) { throw new Error(results.error_message); }
            if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = ''; if (Object.keys(results).length === 0) { mlSkuCheckResultsArea.innerHTML = '<p>Nenhuma conta ML ou resposta vazia.</p>'; return; }
            const table = document.createElement('table'); table.className = 'sku-check-results-table';
            let tableHtml = `<thead><tr><th>Conta ML</th><th>Status</th><th>Itens Encontrados (ID / Título / Tipo / Preço)</th></tr></thead><tbody>`;
            for (const nickname in results) {
                const res = results[nickname]; let itemsHtml = 'Nenhum item encontrado.';
                if (res.error) { itemsHtml = `<span class="error-text">${res.error}</span>`;
                } else if (res.found && res.items && res.items.length > 0) {
                    itemsHtml = '<ul>';
                    res.items.forEach(item => { itemsHtml += `<li><a href="${item.permalink}" target="_blank" title="${item.title}">${item.id}</a> - ${item.title.substring(0,40)}... (${item.listing_type_id||'N/A'}) St:${item.status} R$${parseFloat(item.price||0).toFixed(2)}</li>`; });
                    itemsHtml += '</ul>';
                }
                tableHtml += `<tr><td>${nickname}</td><td>${res.error ? 'Erro' : (res.found ? '<span class="status-ok">Encontrado</span>' : '<span class="status-not-found">Não Encontrado</span>')}</td><td>${itemsHtml}</td></tr>`;
            }
            tableHtml += `</tbody>`; table.innerHTML = tableHtml; mlSkuCheckResultsArea.appendChild(table);
        } catch (error) { if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = `<p class="error-message">Erro: ${error.message}</p>`; }
    }

    if (mlSellerSkuInput) {
        let skuCheckTimeout;
        mlSellerSkuInput.addEventListener('input', () => {
            clearTimeout(skuCheckTimeout); const currentMlSku = mlSellerSkuInput.value.trim();
            if (currentMlSku.length > 0) { skuCheckTimeout = setTimeout(() => { checkMlSkuStatus(currentMlSku); }, 1000);
            } else { if(mlSkuCheckResultsArea) mlSkuCheckResultsArea.innerHTML = '<p>Digite SKU ML para verificar.</p>';}
        });
    }

    window.setMLCategory = function(id, name, pathString = '') {
        if (mlCategoryIdHidden) mlCategoryIdHidden.value = id;
        if (mlCategoryDisplay) mlCategoryDisplay.value = name + (pathString ? ` (${pathString} - ID: ${id})` : ` (ID: ${id})`);
        if (mlCategoryStatus) { mlCategoryStatus.textContent = `Categoria definida: ${name}`; mlCategoryStatus.className = 'status-message success';}
        if (mlCategorySuggestionArea) mlCategorySuggestionArea.innerHTML = '';
        if (categoryBrowserModal) categoryBrowserModal.style.display = 'none';
        console.log(`Categoria ML definida: ID=${id}, Nome='${name}'`);
        loadMlAttributesForCategory(id);
    }

    if (suggestMlCategoryBtn) { suggestMlCategoryBtn.addEventListener('click', async () => {
        const title = mlTitleInput?.value.trim();
        if (!title) { if (mlCategoryStatus) {mlCategoryStatus.textContent = 'Insira título para sugerir.'; mlCategoryStatus.className = 'status-message warning';} return; }
        if (mlCategoryStatus) {mlCategoryStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sugerindo...'; mlCategoryStatus.className = 'status-message info';}
        if (mlCategorySuggestionArea) mlCategorySuggestionArea.innerHTML = '';
        try {
            const response = await fetch(`/api/ml/suggest-category?title=${encodeURIComponent(title)}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error_message || `Erro ${response.status}`);
            if (result.category_id) {
                if (mlCategorySuggestionArea) {
                    mlCategorySuggestionArea.innerHTML = `<p>Sugestão: <strong>${result.category_name}</strong> (ID: ${result.category_id}) <button id="useSuggestedCategoryBtn" class="button-secondary btn-small" style="margin-left:10px;">Usar</button></p><p><small>Caminho: ${result.path_from_root.map(p=>p.name).join(' > ')}</small></p>`;
                    document.getElementById('useSuggestedCategoryBtn').addEventListener('click', () => { setMLCategory(result.category_id, result.category_name, result.path_from_root.map(p=>p.name).join(' > '));});
                }
                if (mlCategoryStatus) mlCategoryStatus.textContent = 'Sugestão encontrada.';
            } else { if (mlCategorySuggestionArea) mlCategorySuggestionArea.innerHTML = '<p>Nenhuma sugestão encontrada.</p>'; if (mlCategoryStatus) mlCategoryStatus.textContent = 'Nenhuma sugestão.';}
        } catch (error) { if (mlCategoryStatus) {mlCategoryStatus.textContent = `Erro ao sugerir: ${error.message}`; mlCategoryStatus.className = 'status-message error';}}
    });}

    if (browseMlCategoryBtn) { browseMlCategoryBtn.addEventListener('click', () => {
        if (categoryBrowserModal) { categoryBrowserModal.style.display = 'block'; if (categoryListUl) categoryListUl.innerHTML = '<p>Use a busca ou carregue as categorias raiz.</p>'; if (categoryBrowserStatus) categoryBrowserStatus.textContent = ''; categorySearchInput.value = ''; categorySearchInput.focus();}
    });}
    if (closeCategoryBrowserModalBtn) { closeCategoryBrowserModalBtn.addEventListener('click', () => { if (categoryBrowserModal) categoryBrowserModal.style.display = 'none'; });}
    window.addEventListener('click', (event) => { if (event.target == categoryBrowserModal) categoryBrowserModal.style.display = "none";});

    // CORREÇÃO NA ÁRVORE DE CATEGORIAS
    async function fetchAndRenderMLCategories(parentId = null, parentLiElement = null, searchTerm = null) {
        const targetUl = parentLiElement ? parentLiElement.querySelector('ul') : categoryListUl;
        if (!targetUl) {
            console.error("Target UL for categories not found. Parent:", parentLiElement, "Root UL:", categoryListUl);
            if(categoryBrowserStatus) { categoryBrowserStatus.textContent = 'Erro interno ao renderizar categorias.'; categoryBrowserStatus.className = 'status-message error'; }
            return;
        }

        let url = '/api/ml/categories';
        const params = new URLSearchParams();
        if (parentId) {
            url = `/api/ml/categories/${parentId}`;
        } else if (searchTerm) {
            params.append('q', searchTerm);
            url = `/api/ml/categories/search`;
        }

        if(categoryBrowserStatus) {
            categoryBrowserStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando categorias...';
            categoryBrowserStatus.className = 'status-message info';
        }

        // Limpa o conteúdo apropriado antes de adicionar novos itens
        if (!parentLiElement && !searchTerm) { // Limpa tudo se for busca raiz ou nova busca por termo
            targetUl.innerHTML = '';
        } else if (parentLiElement && parentLiElement.querySelector('ul')) { // Limpa apenas os filhos do nó pai clicado
            parentLiElement.querySelector('ul').innerHTML = '';
        }

        try {
            const response = await fetch(searchTerm ? `${url}?${params.toString()}` : url);
            const result = await response.json();

            if (!response.ok) throw new Error(result.error_message || `Erro ${response.status} ao buscar categorias`);

            const categories = searchTerm ? result.results : (parentId ? result.categories : result.categories);

            if (!categories || categories.length === 0) {
                let message = 'Nenhuma subcategoria encontrada.';
                if (searchTerm) message = 'Nenhuma categoria encontrada para sua busca.';
                else if (!parentId) message = 'Nenhuma categoria raiz encontrada.';

                if (parentLiElement && !searchTerm) { // Se clicou para expandir e não veio nada
                    parentLiElement.classList.remove('has-children');
                    parentLiElement.classList.remove('open');
                    parentLiElement.classList.add('leaf-node'); // Agora é uma folha
                    parentLiElement.title = `Selecionar esta categoria: ${parentLiElement.dataset.name}`;
                    // Remove o listener de expansão antigo e adiciona de seleção de folha
                    // A forma mais segura de remover listeners antigos é clonar o nó
                    const newLi = parentLiElement.cloneNode(true); // Clona o conteúdo do LI
                    const oldSubUl = newLi.querySelector('ul'); // Acha o UL dentro do clone
                    if(oldSubUl) oldSubUl.remove(); // Remove o UL, pois não há filhos

                    // Substitui o listener antigo pelo de seleção de folha
                    newLi.replaceWith(...newLi.childNodes); // Remove o wrapper LI antigo se houver um, mantendo o texto
                                                            // Esta parte pode ser complicada, talvez mais fácil apenas mudar o comportamento
                    parentLiElement.innerHTML = newLi.innerHTML; // Copia o conteúdo interno
                    parentLiElement.onclick = function(e) { // Adiciona novo listener de clique
                        e.stopPropagation();
                        setMLCategory(this.dataset.id, this.dataset.name, this.dataset.path);
                    };

                    if (categoryBrowserStatus) categoryBrowserStatus.textContent = `"${parentLiElement.dataset.name}" não possui subcategorias. Clique para selecionar.`;
                } else { // Para busca raiz ou por termo sem resultados
                    targetUl.innerHTML = `<li><small>${message}</small></li>`;
                }
                if(categoryBrowserStatus && !parentLiElement) categoryBrowserStatus.textContent = message;
                return;
            }

            categories.forEach(cat => {
                const li = document.createElement('li');
                const catId = cat.id || cat.category_id;
                const catName = cat.name;

                if (!catId || !catName) {
                    console.warn("Categoria com ID ou Nome ausente na resposta:", cat);
                    return;
                }

                li.textContent = catName + ` (ID: ${catId})`;
                li.dataset.id = catId;
                li.dataset.name = catName;
                const path = cat.path_from_root ? cat.path_from_root.map(p=>p.name).join(' > ') : catName;
                li.dataset.path = path;

                let isLeaf;
                if (searchTerm) {
                    // A API de busca (/category_discovery/search) pode ou não ter `is_leaf`.
                    // Se tiver, usamos. Se não, assumimos que PODE ter filhos.
                    isLeaf = cat.is_leaf === true; // Confia no is_leaf se explicitamente true
                                                 // Se is_leaf for false ou undefined, tratamos como não-folha para busca
                                                 // para permitir que o usuário clique e verifique.
                    if (cat.is_leaf === undefined) isLeaf = false; // Se não tem a info, assume que não é folha para permitir clique
                } else { // Navegação normal (raiz ou filhos diretos)
                    if (cat.settings && typeof cat.settings.leaf === 'boolean') {
                        isLeaf = cat.settings.leaf;
                    } else {
                        // Se settings.leaf não existe, baseia-se na presença de children_categories
                        // A API /categories (raiz) não retorna children_categories para cada item da lista raiz.
                        // A API /categories/<id_pai> retorna os filhos em result.categories, e cada filho PODE ter children_categories (netos)
                        isLeaf = !(cat.children_categories && cat.children_categories.length > 0);
                        // Se children_categories for undefined (ex: categorias raiz), não podemos assumir que é folha,
                        // a menos que settings.leaf diga o contrário.
                        if (cat.children_categories === undefined && (cat.settings === undefined || cat.settings.leaf === undefined)) {
                           isLeaf = false; // Assume que pode ter filhos se nenhuma info definitiva de folha estiver presente
                        }
                    }
                }

                if (!isLeaf) {
                    li.classList.add('has-children');
                    const subUl = document.createElement('ul');
                    // subUl.style.display = 'none'; // Deixar o CSS lidar com isso via .open
                    li.appendChild(subUl);

                    li.addEventListener('click', function(event) {
                        event.stopPropagation(); // Impede que o clique no pai selecione a categoria se não for folha
                        if (this.classList.contains('open')) {
                            this.classList.remove('open');
                            // subUl.style.display = 'none'; // O CSS cuida disso
                        } else {
                            this.classList.add('open');
                            // subUl.style.display = 'block'; // O CSS cuida disso
                            // Carrega filhos somente se o subUl estiver vazio (ainda não carregados)
                            if (subUl.children.length === 0) {
                                fetchAndRenderMLCategories(this.dataset.id, this);
                            }
                        }
                    });
                } else {
                    li.classList.add('leaf-node');
                    li.title = `Selecionar: ${catName}`;
                    li.addEventListener('click', function(event) {
                        event.stopPropagation();
                        setMLCategory(this.dataset.id, this.dataset.name, this.dataset.path);
                    });
                }
                targetUl.appendChild(li);
            });
            if(categoryBrowserStatus) categoryBrowserStatus.textContent = 'Categorias carregadas. Clique para expandir ou selecionar.';
        } catch (error) {
            console.error("Erro ao buscar/renderizar categorias ML:", error);
            if(categoryBrowserStatus) {
                categoryBrowserStatus.textContent = `Erro ao carregar categorias: ${error.message}`;
                categoryBrowserStatus.className = 'status-message error';
            }
        }
    }// backend/static/js/dashboard.js (CONTINUAÇÃO FINAL)

    // =================================================================================
    // --- LÓGICA PARA ABA "IMAGENS" ---
    // =================================================================================
    function renderProductImages() {
        if (!imagePreviewContainer) return; imagePreviewContainer.innerHTML = '';
        if (productImages.length === 0) { imagePreviewContainer.innerHTML = '<p>Nenhuma imagem.</p>'; if(optimizeFirstImageBtn) optimizeFirstImageBtn.disabled = true; if(removeBgFirstImageBtn) removeBgFirstImageBtn.disabled = true; updateRemoveBgCreditsDisplay(); return; }
        const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}'); const hasImgurKey = !!appConfig.imgur_client_id; const hasRemoveBgKey = !!appConfig.removebg_api_key;
        if(optimizeFirstImageBtn) optimizeFirstImageBtn.disabled = !(productImages.length > 0 && hasImgurKey);
        if(removeBgFirstImageBtn) removeBgFirstImageBtn.disabled = !(productImages.length > 0 && hasRemoveBgKey && hasImgurKey);
        productImages.forEach((imgData, index) => { const imageUrl = imgData.source || imgData; const imageNote = imgData.note || ''; const isErrorPlaceholder = imageUrl.startsWith('placeholder_error_'); const block = document.createElement('div'); block.className = 'image-block'; const thumbDiv = document.createElement('div'); thumbDiv.className = 'image-block-thumbnail'; const thumbImg = document.createElement('img'); thumbImg.alt = `Prévia ${index + 1}`;
        thumbImg.src = imageUrl.startsWith('http') ? imageUrl : (document.getElementById('app-container') ? "{{ url_for('static', filename='images/placeholder.png') }}" : 'static/images/placeholder.png'); if (isErrorPlaceholder) thumbImg.style.opacity = '0.5'; thumbDiv.appendChild(thumbImg); const infoDiv = document.createElement('div'); infoDiv.className = 'image-block-info'; const urlLink = document.createElement('a'); urlLink.className = 'image-url'; urlLink.href = imageUrl.startsWith('http') ? imageUrl : '#'; urlLink.target = '_blank'; urlLink.textContent = `${index + 1}. ${imageUrl.length > 60 ? imageUrl.substring(0, 28) + '...' + imageUrl.substring(imageUrl.length - 28) : imageUrl}`; const resolutionSpan = document.createElement('span'); resolutionSpan.className = 'image-resolution'; resolutionSpan.textContent = 'Res: ...'; infoDiv.appendChild(urlLink); infoDiv.appendChild(resolutionSpan); if(imageNote){ const noteSpan = document.createElement('span'); noteSpan.className = 'image-source-note' + (isErrorPlaceholder ? ' error' : ''); noteSpan.textContent = imageNote; infoDiv.appendChild(noteSpan); } if (imageUrl.startsWith('http')) { const imgForDims = new Image(); imgForDims.onload = () => { resolutionSpan.textContent = `Res: ${imgForDims.naturalWidth}x${imgForDims.naturalHeight}`; }; imgForDims.onerror = () => { resolutionSpan.textContent = 'Res: Falha'; }; imgForDims.src = imageUrl;} else { resolutionSpan.textContent = 'Res: N/A';} const actionsDiv = document.createElement('div'); actionsDiv.className = 'image-block-actions'; const upBtn = document.createElement('button'); upBtn.className = 'button-secondary btn-icon'; upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>'; upBtn.title = "Mover cima"; upBtn.disabled = index === 0; upBtn.addEventListener('click', () => moveImage(index, -1)); const downBtn = document.createElement('button'); downBtn.className = 'button-secondary btn-icon'; downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>'; downBtn.title = "Mover baixo"; downBtn.disabled = index === productImages.length - 1; downBtn.addEventListener('click', () => moveImage(index, 1)); const removeBtn = document.createElement('button'); removeBtn.className = 'button-secondary btn-icon btn-remove-img'; removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; removeBtn.title = "Remover"; removeBtn.addEventListener('click', () => removeImage(index)); actionsDiv.appendChild(upBtn); actionsDiv.appendChild(downBtn); actionsDiv.appendChild(removeBtn); block.appendChild(thumbDiv); block.appendChild(infoDiv); block.appendChild(actionsDiv); imagePreviewContainer.appendChild(block); });
        updateRemoveBgCreditsDisplay();
    }
    function addImageToArray(url) { if (!url || !url.startsWith('http')) { if (imageAddStatusEl) {imageAddStatusEl.textContent = 'URL inválida.'; imageAddStatusEl.className = 'status-message error';} return;} if (productImages.length >= 12) { if (imageAddStatusEl) {imageAddStatusEl.textContent = 'Máx 12 imagens.'; imageAddStatusEl.className = 'status-message warning';} return;} productImages.push({ source: url }); renderProductImages(); if (newImageUrlInput) newImageUrlInput.value = ''; if (imageAddStatusEl) {imageAddStatusEl.textContent = 'Imagem adicionada.'; imageAddStatusEl.className = 'status-message success';}}
    function removeImage(index) { if (index >= 0 && index < productImages.length) {productImages.splice(index, 1); renderProductImages();}}
    function moveImage(index, direction) { if (index < 0 || index >= productImages.length) return; const newIndex = index + direction; if (newIndex < 0 || newIndex >= productImages.length) return; const item = productImages.splice(index, 1)[0]; productImages.splice(newIndex, 0, item); renderProductImages();}
    if (addImageUrlBtn) { addImageUrlBtn.addEventListener('click', () => { if (newImageUrlInput) addImageToArray(newImageUrlInput.value.trim()); });}
    if (newImageUrlInput) { newImageUrlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addImageToArray(newImageUrlInput.value.trim());}}); }

    if (optimizeFirstImageBtn) {
        optimizeFirstImageBtn.addEventListener('click', async () => {
            if (productImages.length === 0 || !productImages[0].source || !productImages[0].source.startsWith('http')) { alert("Nenhuma imagem válida para otimizar."); return; }
            const firstImageUrl = productImages[0].source; if (firstImageUrl.includes('_optimized_1000px') || firstImageUrl.includes('_rbg_processed')) { alert("Imagem já processada."); return; }
            const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}'); if (!appConfig.imgur_client_id) { alert("Client ID Imgur N/D."); if(imageAddStatusEl) {imageAddStatusEl.textContent = "Client ID Imgur N/D."; imageAddStatusEl.className = 'status-message error';} return; }
            if (imageAddStatusEl) { imageAddStatusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Otimizando...'; imageAddStatusEl.className = 'status-message info';} optimizeFirstImageBtn.disabled = true; if(removeBgFirstImageBtn) removeBgFirstImageBtn.disabled = true;
            try { const response = await fetch('/api/image/optimize', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ imageUrl: firstImageUrl }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error_message || 'Falha otimizar'); productImages[0] = { source: result.newUrl, note: `Otimizada (${result.service_used})` }; if (imageAddStatusEl) { imageAddStatusEl.textContent = '1ª imagem otimizada!'; imageAddStatusEl.className = 'status-message success'; }}
            catch (error) { if (imageAddStatusEl) { imageAddStatusEl.textContent = `Erro: ${error.message}`; imageAddStatusEl.className = 'status-message error'; }} finally { renderProductImages(); }
        });
    }
    if (removeBgFirstImageBtn) {
        removeBgFirstImageBtn.addEventListener('click', async () => {
            if (productImages.length === 0 || !productImages[0].source || !productImages[0].source.startsWith('http')) { alert("Nenhuma imagem válida."); return; } const firstImageUrl = productImages[0].source; if (firstImageUrl.includes('_rbg_processed')) { alert("Fundo já removido."); return; }
            const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}'); if (!appConfig.removebg_api_key) { alert("Chave Remove.bg N/D."); if(imageAddStatusEl) {imageAddStatusEl.textContent = "Chave Remove.bg N/D."; imageAddStatusEl.className = 'status-message error';} return; } if (!appConfig.imgur_client_id && !confirm("Client ID Imgur N/D. Continuar sem hospedar?")) { if(imageAddStatusEl) {imageAddStatusEl.textContent = "Cancelado."; imageAddStatusEl.className = 'status-message warning';} return; }
            if (imageAddStatusEl) { imageAddStatusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removendo fundo...'; imageAddStatusEl.className = 'status-message info';} if(optimizeFirstImageBtn) optimizeFirstImageBtn.disabled = true; removeBgFirstImageBtn.disabled = true;
            try { const response = await fetch('/api/image/remove-background', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ imageUrl: firstImageUrl }) }); const result = await response.json(); if (!response.ok && response.status !== 200) { throw new Error(result.error_message || `Falha API (Status: ${response.status})`);} let message = result.message || "Concluído."; let msgType = 'success';
                if (result.newUrl) { productImages.unshift({ source: result.newUrl, note: `Fundo Removido (${result.service_used})` }); message = `Fundo removido (${result.service_used}).`;}
                else if (result.error_message && result.service_used === "Local (Falha Upload)") { message = `Processada, mas falha upload: ${result.error_message}`; msgType = 'warning'; productImages.unshift({ source: `placeholder_error_rbg_${Date.now()}.png`, note: `RemoveBG OK, Upload Falhou (${result.credits_charged||0} créd.)` });}
                else if (result.error_message) { throw new Error(result.error_message); }
                else if (!result.newUrl && response.ok){ message = "Processado, mas sem nova URL (verif. créditos)."; msgType = 'warning';}
                if(productImages.length > 12) productImages.pop();
                if (imageAddStatusEl) { imageAddStatusEl.textContent = message; imageAddStatusEl.className = `status-message ${msgType}`; } if(result.credits_charged !== undefined && result.credits_charged > 0){ setTimeout(loadApiConfigs, 600); }
            } catch (error) { if (imageAddStatusEl) { imageAddStatusEl.textContent = `Erro: ${error.message}`; imageAddStatusEl.className = 'status-message error'; }}
            finally { renderProductImages(); }
        });
    }
    window.populateImagesFromTiny = function(anexosTiny) { productImages = []; if (anexosTiny && Array.isArray(anexosTiny)) { anexosTiny.forEach(anexo => { if (anexo && anexo.anexo) { if (productImages.length < 12) { productImages.push({ source: anexo.anexo, note: 'Tiny' });}}});} renderProductImages();}

    // =================================================================================
    // --- LÓGICA PARA ABA "FICHA & DESCRIÇÃO" ---
    // =================================================================================
    function createAttributeInput(attr) {
        const fg = document.createElement('div'); fg.className = 'form-group form-group-attribute'; const lbl = document.createElement('label'); lbl.htmlFor = `attr_input_${attr.id}`; lbl.textContent = `${attr.name}:`; if (attr.tags && (attr.tags.required || attr.tags.catalog_required)) { const star = document.createElement('span'); star.className = 'attribute-required-star'; star.textContent = ' *'; lbl.appendChild(star);} fg.appendChild(lbl); let inputEl; const inputId = `attr_input_${attr.id}`;
        if (attr.value_type === 'list' || (attr.values && attr.values.length > 0 && !['BRAND', 'MODEL'].includes(attr.id))) { inputEl = document.createElement('select'); inputEl.id = inputId; inputEl.name = attr.id; const emptyOpt = document.createElement('option'); emptyOpt.value = ""; emptyOpt.textContent = "-- Selecione --"; inputEl.appendChild(emptyOpt); (attr.values || []).forEach(v => {const opt = document.createElement('option'); opt.value = v.id || v.name; opt.textContent = v.name; inputEl.appendChild(opt);});
        } else if (attr.value_type === 'boolean') { inputEl = document.createElement('select'); inputEl.id = inputId; inputEl.name = attr.id; const opts = {'': '-- Selecione --'}; (attr.values || []).forEach(v => {if (v.id && v.name) opts[v.id] = v.name;}); if (Object.keys(opts).length <= 1) {opts['true_placeholder_id'] = 'Sim'; opts['false_placeholder_id'] = 'Não';} for (const valId in opts) {const opt = document.createElement('option'); opt.value = valId; opt.textContent = opts[valId]; inputEl.appendChild(opt);}}
        else if (attr.id === 'BRAND' || attr.id === 'MODEL') { inputEl = document.createElement('input'); inputEl.type = 'text'; inputEl.id = inputId; inputEl.name = attr.id; inputEl.setAttribute('list', `datalist_${attr.id}`); if(attr.value_max_length) inputEl.maxLength = attr.value_max_length; const dl = document.createElement('datalist'); dl.id = `datalist_${attr.id}`; (attr.values || []).forEach(v => {const opt = document.createElement('option'); opt.value = v.name; dl.appendChild(opt);}); fg.appendChild(dl);}
        else { inputEl = document.createElement('input'); inputEl.type = (attr.value_type === 'number' || attr.value_type === 'number_unit') ? 'text' : 'text'; inputEl.id = inputId; inputEl.name = attr.id; if(attr.value_max_length) inputEl.maxLength = attr.value_max_length; if(attr.default_unit && attr.value_type === 'number_unit') inputEl.placeholder = `(${attr.default_unit})`;}
        fg.appendChild(inputEl); return fg;
    }
    function applyTinyDataToMlAttributesUI(tinyData, attributesFromML) {
        if (!tinyData || !attributesFromML || !mlAttributesContainer) return; console.log("Aplicando dados Tiny aos atributos ML UI...");
        attributesFromML.forEach(attrML => { const inputEl = document.getElementById(`attr_input_${attrML.id}`); if (!inputEl) return; let valTiny = null; let fieldName = '';
        if (attrML.id === 'BRAND' && tinyData.marca_tiny) { valTiny = tinyData.marca_tiny; fieldName = 'marca_tiny';}
        else if (attrML.id === 'MODEL' && tinyData.modelo_tiny) { valTiny = tinyData.modelo_tiny; fieldName = 'modelo_tiny';}
        else if ((attrML.id === 'PART_NUMBER' || attrML.id === 'MANUFACTURER_PART_NUMBER') && tinyData.codigo_tiny) { valTiny = tinyData.codigo_tiny; fieldName = 'codigo_tiny (PartNumber)';}
        else if (attrML.id === 'GTIN' && tinyData.gtin_tiny) { valTiny = tinyData.gtin_tiny; fieldName = 'gtin_tiny';}
        else if (attrML.id === 'LINE' && tinyData.linha_tiny) { valTiny = tinyData.linha_tiny; fieldName = 'linha_tiny';} // Certifique-se que 'linha_tiny' é extraído em fetch_tiny_product_details_logic
        if (valTiny !== null && valTiny !== undefined) { if (inputEl.tagName === 'SELECT') { for (let i = 0; i < inputEl.options.length; i++) { if (inputEl.options[i].textContent.toLowerCase() === String(valTiny).toLowerCase() || inputEl.options[i].value.toLowerCase() === String(valTiny).toLowerCase()) { inputEl.selectedIndex = i; console.log(`  - '${attrML.name}' (SELECT) com '${valTiny}' do Tiny ('${fieldName}')`); break;}}} else { inputEl.value = valTiny; console.log(`  - '${attrML.name}' (INPUT) com '${valTiny}' do Tiny ('${fieldName}')`);}}});
    }
    async function loadMlAttributesForCategory(categoryId) {
        if (!categoryId) { if (mlAttributesContainer) mlAttributesContainer.innerHTML = '<p>Nenhuma categoria.</p>'; if (attributesStatusEl) attributesStatusEl.textContent = ''; currentMlCategoryIdForAttributes = null; return;}
        // Removido o if que impedia recarregar se a categoria fosse a mesma, para forçar reaplicação do Tiny
        // if (currentMlCategoryIdForAttributes === categoryId && mlAttributesContainer && mlAttributesContainer.querySelector('.form-group-attribute')) { if(lastTinyProductDataForAttributes){ const tempAttrs = Array.from(mlAttributesContainer.querySelectorAll('.form-group-attribute input, .form-group-attribute select')).map(inp => ({id: inp.name})); applyTinyDataToMlAttributesUI(lastTinyProductDataForAttributes, tempAttrs); } return; }
        currentMlCategoryIdForAttributes = categoryId; if (mlAttributesContainer) mlAttributesContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Carregando atributos...</p>'; if (attributesStatusEl) { attributesStatusEl.textContent = 'Carregando...'; attributesStatusEl.className = 'status-message info';}
        try {
            const r = await fetch(`/api/ml/category-attributes/${categoryId}`); const res = await r.json(); if (!r.ok) throw new Error(res.error_message || `Erro ${r.status}`); if (res.error_message && res.attributes === undefined) throw new Error(res.error_message);
            if (mlAttributesContainer) mlAttributesContainer.innerHTML = ''; let count = 0;
            if (res.attributes && res.attributes.length > 0) { const common = ['BRAND', 'MODEL', 'PART_NUMBER', 'GTIN', 'LINE', 'ITEM_CONDITION']; const ignore = ["SELLER_SKU"]; const req = []; const opt = []; res.attributes.forEach(attr => { if (ignore.includes(attr.id) || (attr.tags && attr.tags.hidden && !common.includes(attr.id))) return; if (attr.tags && (attr.tags.required || attr.tags.catalog_required || common.includes(attr.id))) req.push(attr); else opt.push(attr);}); req.forEach(attr => { mlAttributesContainer.appendChild(createAttributeInput(attr)); count++;}); if (opt.length > 0) { const sep = document.createElement('hr'); sep.className = 'section-divider'; mlAttributesContainer.appendChild(sep); const title = document.createElement('h4'); title.innerHTML = '<i class="fas fa-sliders-h icon"></i> Opcionais'; title.style.fontSize='1em'; mlAttributesContainer.appendChild(title); opt.forEach(attr => {mlAttributesContainer.appendChild(createAttributeInput(attr)); count++;});} if(attributesStatusEl) {attributesStatusEl.textContent = `${count} atributos.`; attributesStatusEl.className = 'status-message success';} if(lastTinyProductDataForAttributes){applyTinyDataToMlAttributesUI(lastTinyProductDataForAttributes, res.attributes);}}
            else { if (mlAttributesContainer) mlAttributesContainer.innerHTML = '<p>Nenhum atributo para esta categoria.</p>'; if (attributesStatusEl) {attributesStatusEl.textContent = 'Nenhum atributo.'; attributesStatusEl.className = 'status-message info';}}
        } catch (error) { if (mlAttributesContainer) mlAttributesContainer.innerHTML = `<p class="error-message">Erro: ${error.message}</p>`; if (attributesStatusEl) {attributesStatusEl.textContent = `Erro: ${error.message}`; attributesStatusEl.className = 'status-message error';}}
    }
    if (generateDescChatGptBtn) { generateDescChatGptBtn.addEventListener('click', async () => {
        const title = mlTitleInput?.value.trim(); const currentDesc = mlDescriptionTextarea ? mlDescriptionTextarea.value : '';
        if (!title) { if(descriptionStatusEl) {descriptionStatusEl.textContent = 'Título é necessário.'; descriptionStatusEl.className = 'status-message warning';} return;}
        const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}'); if (!appConfig.chatgpt_api_key) { if(descriptionStatusEl) {descriptionStatusEl.textContent = 'Chave ChatGPT N/D.'; descriptionStatusEl.className = 'status-message error';} return;}
        if(descriptionStatusEl) {descriptionStatusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando IA...'; descriptionStatusEl.className = 'status-message info';} generateDescChatGptBtn.disabled = true;
        try { const r = await fetch('/api/ml/generate-description-chatgpt', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title: title, current_description: currentDesc })}); const res = await r.json(); if (!r.ok) throw new Error(res.error_message || `Erro ${r.status}`); if (res.new_description_html && mlDescriptionTextarea) { mlDescriptionTextarea.value = res.new_description_html; if(descriptionStatusEl) {descriptionStatusEl.textContent = 'Descrição IA inserida!'; descriptionStatusEl.className = 'status-message success';}} else if (res.error_message) { throw new Error(res.error_message); } else { throw new Error('Resposta IA inesperada.');}}
        catch (error) { if(descriptionStatusEl) {descriptionStatusEl.textContent = `Erro IA: ${error.message}`; descriptionStatusEl.className = 'status-message error';}}
        finally { generateDescChatGptBtn.disabled = false; }
    });}

    // --- INICIALIZAÇÃO GERAL ---
    loadMLAccounts();
    loadApiConfigs();
    renderProductImages();
    console.log("Dashboard JS: Finalizado e pronto para uso, incluindo lógica de imagem e ficha/descrição.");
}); // Fim do DOMContentLoaded