// backend/static/js/auth_ml_accounts.js
import { fetchMLAccountsAPI, removeMLAccountAPI, setActiveMLAccountAPI } from './api.js';
import { displayStatusMessage, createSpinnerIcon, cleanElementListeners } from './ui_helpers.js';

// Seletores de Elementos DOM para esta Aba e globais relacionados
const addMLAccountBtn = document.getElementById('addMLAccountBtn');
const mlAccountsListDiv = document.getElementById('mlAccountsList');
const mlAccountStatusEl = document.getElementById('mlAccountStatus'); // Status específico da aba
const globalStatusElement = document.getElementById('globalStatus'); // Status global no header

let currentActiveMLNickGlobal = null; // Para rastrear no JS qual conta está "ativa"

function updateGlobalStatusUI(activeAccountDetails) {
    if (globalStatusElement) {
        if (activeAccountDetails && activeAccountDetails.nickname) {
            currentActiveMLNickGlobal = activeAccountDetails.nickname; // Atualiza a variável global do JS
            window.dashboardAppShared.currentActiveMLAccountNickname = activeAccountDetails.nickname; // Atualiza no objeto compartilhado

            const tokenStatusIcon = activeAccountDetails.token_valid
                ? '<i class="fas fa-shield-alt" style="color: green;" title="Token Válido"></i>'
                : '<i class="fas fa-exclamation-triangle" style="color: orange;" title="Token Inválido/Expirado. Tente reativar ou readicionar a conta."></i>';
            globalStatusElement.innerHTML = `Conta ML Ativa: <strong>${activeAccountDetails.nickname}</strong> (Envio: ${activeAccountDetails.shipping_mode ? activeAccountDetails.shipping_mode.toUpperCase() : 'N/A'}) ${tokenStatusIcon}`;
        } else {
            currentActiveMLNickGlobal = null;
            window.dashboardAppShared.currentActiveMLAccountNickname = null;
            globalStatusElement.innerHTML = '<i class="fas fa-plug"></i> Nenhuma conta ML ativa.';
        }
    }
}

async function loadAndRenderMLAccounts() {
    if (!mlAccountsListDiv) return;
    displayStatusMessage(mlAccountsListDiv, `${createSpinnerIcon()} Carregando contas ML...`, 'info', true);

    try {
        const accountsData = await fetchMLAccountsAPI(); // accountsData é o objeto {nick: {details}}
        mlAccountsListDiv.innerHTML = ''; // Limpa
        const ul = document.createElement('ul');
        ul.className = 'ml-accounts-list-ul';

        if (Object.keys(accountsData).length === 0) {
            mlAccountsListDiv.innerHTML = '<p>Nenhuma conta Mercado Livre configurada.</p>';
            updateGlobalStatusUI(null); // Nenhuma conta ativa
            return;
        }

        // Verifica se a conta ativa anteriormente ainda existe e é válida
        let activeAccountStillExistsAndValid = false;
        if (currentActiveMLNickGlobal && accountsData[currentActiveMLNickGlobal]) {
            const activeAccData = accountsData[currentActiveMLNickGlobal];
            if (activeAccData.token_valid) {
                activeAccountStillExistsAndValid = true;
                 // Garante que o status global reflita os dados mais recentes (pode ter havido refresh)
                updateGlobalStatusUI({
                    nickname: currentActiveMLNickGlobal,
                    shipping_mode: activeAccData.shipping_mode,
                    token_valid: activeAccData.token_valid,
                    seller_id: activeAccData.seller_id // Adicionar seller_id se precisar dele no objeto compartilhado
                });
            }
        }
        
        if (!activeAccountStillExistsAndValid) {
             // Se a conta ativa não é mais válida, ou foi removida, reseta.
            currentActiveMLNickGlobal = null; 
            window.dashboardAppShared.currentActiveMLAccountNickname = null;
            updateGlobalStatusUI(null);
        }


        for (const nickname in accountsData) {
            const acc = accountsData[nickname];
            const li = document.createElement('li');
            const isActive = nickname === currentActiveMLNickGlobal;

            li.className = isActive ? 'ml-account-item active-account' : 'ml-account-item';
            li.innerHTML = `
                <div class="account-info">
                    <span class="account-nick">${nickname}</span>
                    <span class="account-status ${acc.token_valid ? 'status-ok' : 'status-error'}">
                        <i class="fas ${acc.token_valid ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                        ${acc.token_valid ? 'Token Válido' : 'Token Inválido/Expirado'}
                    </span>
                    <span class="account-sellerid">Seller ID: ${acc.seller_id || 'N/A'}</span>
                    <span class="account-shipping">Modo Envio: ${acc.shipping_mode ? acc.shipping_mode.toUpperCase() : 'N/A'}</span>
                </div>
                <div class="account-actions">
                    <button class="btn-small btn-set-active" data-nick="${nickname}" ${isActive ? 'disabled' : ''} title="${isActive ? 'Esta conta já está ativa' : 'Ativar esta conta'}">
                        <i class="fas ${isActive ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> ${isActive ? 'Ativa' : 'Ativar'}
                    </button>
                    <button class="btn-small btn-remove-account" data-nick="${nickname}" title="Remover esta conta">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>`;
            ul.appendChild(li);
        }
        mlAccountsListDiv.appendChild(ul);
        attachAccountActionListeners(); // Adiciona listeners aos novos botões
        displayStatusMessage(mlAccountStatusEl, 'Lista de contas ML carregada.', 'success');

    } catch (error) {
        displayStatusMessage(mlAccountsListDiv, `Erro ao carregar contas ML: ${error.message}`, 'error', false);
        updateGlobalStatusUI(null); // Erro ao carregar, nenhuma conta ativa
    }
}

function attachAccountActionListeners() {
    document.querySelectorAll('.btn-set-active').forEach(btn => {
        const newBtn = cleanElementListeners(btn); // Limpa listeners antigos
        if (newBtn) {
            newBtn.addEventListener('click', async (e) => {
                await handleSetActiveMLAccount(e.currentTarget.dataset.nick);
            });
        }
    });
    document.querySelectorAll('.btn-remove-account').forEach(btn => {
        const newBtn = cleanElementListeners(btn);
        if (newBtn) {
            newBtn.addEventListener('click', async (e) => {
                if (confirm(`Tem certeza que deseja remover a conta ML "${e.currentTarget.dataset.nick}"? Esta ação não pode ser desfeita.`)) {
                    await handleRemoveMLAccount(e.currentTarget.dataset.nick);
                }
            });
        }
    });
}

async function handleSetActiveMLAccount(nickname) {
    displayStatusMessage(mlAccountStatusEl, `${createSpinnerIcon()} Ativando conta ${nickname}...`, 'info', true);
    try {
        const result = await setActiveMLAccountAPI(nickname); // Chama a API
        if (result.success) {
            displayStatusMessage(mlAccountStatusEl, result.message || `Conta ${nickname} ativada.`, 'success');
            if (result.active_account_details) {
                updateGlobalStatusUI(result.active_account_details); // Atualiza o status global
            }
            loadAndRenderMLAccounts(); // Recarrega a lista para refletir o estado ativo
        } else {
            // Se a API retornou um 'warning' mas ativou (ex: token não pôde ser renovado)
            if (result.warning && result.active_account_details) {
                displayStatusMessage(mlAccountStatusEl, result.warning, 'warning');
                updateGlobalStatusUI(result.active_account_details);
                loadAndRenderMLAccounts();
            } else {
                throw new Error(result.error || "Erro desconhecido ao ativar conta.");
            }
        }
    } catch (error) {
        displayStatusMessage(mlAccountStatusEl, `Erro ao ativar conta ${nickname}: ${error.message}`, 'error');
        // Poderia tentar recarregar a lista mesmo em erro para refletir o estado anterior
        loadAndRenderMLAccounts();
    }
}

async function handleRemoveMLAccount(nickname) {
    displayStatusMessage(mlAccountStatusEl, `${createSpinnerIcon()} Removendo conta ${nickname}...`, 'info', true);
    try {
        const result = await removeMLAccountAPI(nickname); // Chama a API
        if (result.success) {
            displayStatusMessage(mlAccountStatusEl, result.message || `Conta ${nickname} removida.`, 'success');
            if (currentActiveMLNickGlobal === nickname) { // Se a conta removida era a ativa
                currentActiveMLNickGlobal = null;
                window.dashboardAppShared.currentActiveMLAccountNickname = null;
                updateGlobalStatusUI(null);
            }
            loadAndRenderMLAccounts(); // Recarrega a lista
        } else {
            throw new Error(result.error || "Erro desconhecido ao remover conta.");
        }
    } catch (error) {
        displayStatusMessage(mlAccountStatusEl, `Erro ao remover conta ${nickname}: ${error.message}`, 'error');
    }
}

export function initAuthMLAccounts() {
    if (addMLAccountBtn) {
        addMLAccountBtn.addEventListener('click', () => {
            displayStatusMessage(mlAccountStatusEl, "Abrindo janela de autorização do Mercado Livre...", 'info');
            const oauthWindow = window.open('/oauth/ml/start-auth', 'MercadoLivreAuth', 'width=800,height=650,scrollbars=yes,resizable=yes,status=yes');
            if (oauthWindow) {
                oauthWindow.focus();
                // Monitora o fechamento da janela popup
                const timer = setInterval(() => {
                    if (oauthWindow.closed) {
                        clearInterval(timer);
                        displayStatusMessage(mlAccountStatusEl, "Janela de autorização fechada. Verificando status e atualizando lista...", 'info');
                        setTimeout(loadAndRenderMLAccounts, 1500); // Dá um tempo para o callback do backend processar
                    }
                }, 500);
            } else {
                displayStatusMessage(mlAccountStatusEl, 'Falha ao abrir a janela de pop-up. Verifique as configurações do seu navegador.', 'error');
            }
        });
    }
    loadAndRenderMLAccounts(); // Carrega contas ao inicializar a aba
    console.log("Auth & ML Accounts Tab Initialized");
}

// Para ser chamado pelo dashboard.js quando a aba de Contas ML é ativada
export function loadMLAccountsJS() {
    loadAndRenderMLAccounts();
}

// Para permitir que outros módulos acessem o nickname ativo de forma segura
export function getCurrentActiveMLAccountNickname() {
    return currentActiveMLNickGlobal;
}

// Exportar updateGlobalStatusUI para que o dashboard principal possa chamá-la se necessário
export { updateGlobalStatusUI as updateGlobalStatusWithActiveMLAccountJS };