// backend/static/js/images_tab.js
import { optimizeImageAPI, removeBackgroundImageAPI } from './api.js';
import { displayStatusMessage, createSpinnerIcon } from './ui_helpers.js';

// --- Seletores de Elementos DOM para esta Aba ---
const newImageUrlInput = document.getElementById('newImageUrlInput');
const addImageUrlBtn = document.getElementById('addImageUrlBtn');
const imageAddStatusEl = document.getElementById('imageAddStatus'); // Status para adição de URL
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const optimizeFirstImageBtn = document.getElementById('optimizeFirstImageBtn');
const removeBgFirstImageBtn = document.getElementById('removeBgFirstImageBtn');
const removeBgCreditsTabImagensEl = document.getElementById('removeBgCreditsTabImagens'); // Para mostrar créditos aqui também

let productImagesInternal = []; // Array interno para gerenciar as imagens desta aba

// Função para atualizar a exibição dos créditos do Remove.bg nesta aba
function updateRemoveBgCreditsDisplayImagesTab() {
    if (!removeBgCreditsTabImagensEl) return;
    const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}');
    const keyPresent = !!appConfig.removebg_api_key;
    const used = appConfig.removebg_credits_used_month || 0;
    const total = 50;
    const remaining = Math.max(0, total - used);
    
    let text = 'Remove.bg Créditos: ';
    if (keyPresent) text += `${remaining}/${total}`;
    else text += 'Chave API N/D';
    
    removeBgCreditsTabImagensEl.textContent = text;
    removeBgCreditsTabImagensEl.className = 'api-status-text'; // Reset

    if (keyPresent) {
        if (remaining <= 0) removeBgCreditsTabImagensEl.classList.add('error');
        else if (remaining < 10) removeBgCreditsTabImagensEl.classList.add('warning');
        else removeBgCreditsTabImagensEl.classList.add('success');
    } else {
        removeBgCreditsTabImagensEl.classList.add('info');
    }
}


function updateImageActionButtonsState() {
    const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}');
    const hasImgurKey = !!appConfig.imgur_client_id;
    const hasRemoveBgKey = !!appConfig.removebg_api_key;
    const imagesPresent = productImagesInternal.length > 0;

    if (optimizeFirstImageBtn) {
        optimizeFirstImageBtn.disabled = !(imagesPresent && productImagesInternal[0].source.startsWith('http') && hasImgurKey && !productImagesInternal[0].source.includes('_optimized_1000px') && !productImagesInternal[0].source.includes('_rbg_processed'));
    }
    if (removeBgFirstImageBtn) {
        removeBgFirstImageBtn.disabled = !(imagesPresent && productImagesInternal[0].source.startsWith('http') && hasRemoveBgKey && hasImgurKey && !productImagesInternal[0].source.includes('_rbg_processed'));
    }
    updateRemoveBgCreditsDisplayImagesTab();
}

export function renderProductImagesJS() { // Renomeada para evitar conflito e exportada
    if (!imagePreviewContainer) return;
    imagePreviewContainer.innerHTML = ''; // Limpa visualizações antigas

    if (productImagesInternal.length === 0) {
        imagePreviewContainer.innerHTML = '<p style="text-align:center; color:#777; padding:20px;">Nenhuma imagem adicionada.</p>';
        updateImageActionButtonsState();
        return;
    }

    productImagesInternal.forEach((imgData, index) => {
        const imageUrl = typeof imgData === 'string' ? imgData : imgData.source; // Pode ser string ou objeto
        const imageNote = typeof imgData === 'object' ? (imgData.note || '') : '';
        const isProcessedPlaceholder = imageUrl.includes('_optimized_1000px') || imageUrl.includes('_rbg_processed') || imageUrl.includes('placeholder_error_');
        const isTinyNote = imageNote.toLowerCase() === 'tiny';

        const block = document.createElement('div');
        block.className = 'image-block';

        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'image-block-thumbnail';
        const thumbImg = document.createElement('img');
        thumbImg.alt = `Prévia ${index + 1}`;
        
        if (imageUrl.startsWith('http')) {
            thumbImg.src = imageUrl;
        } else { // Placeholder para URLs não HTTP (ex: upload falhou)
            thumbImg.src = document.getElementById('app-container') ? "/static/images/placeholder_error.png" : 'static/images/placeholder_error.png'; // Ajuste o caminho se necessário
            thumbImg.style.opacity = '0.6';
        }
        thumbDiv.appendChild(thumbImg);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'image-block-info';

        const urlLink = document.createElement('a');
        urlLink.className = 'image-url';
        urlLink.href = imageUrl.startsWith('http') ? imageUrl : '#';
        urlLink.target = '_blank';
        urlLink.textContent = `${index + 1}. ${imageUrl.length > 60 ? imageUrl.substring(0, 28) + '...' + imageUrl.substring(imageUrl.length - 28) : imageUrl}`;
        if (imageUrl.includes('placeholder_error_')) urlLink.style.color = '#d9534f';


        const resolutionSpan = document.createElement('span');
        resolutionSpan.className = 'image-resolution';
        resolutionSpan.textContent = 'Res: Carregando...';

        infoDiv.appendChild(urlLink);
        infoDiv.appendChild(resolutionSpan);

        if (imageNote) {
            const noteSpan = document.createElement('span');
            noteSpan.className = 'image-source-note';
            noteSpan.textContent = imageNote;
            if (isTinyNote) noteSpan.style.color = '#5bc0de'; // Azul para Tiny
            else if (isProcessedPlaceholder && !imageUrl.includes('placeholder_error_')) noteSpan.style.color = '#5cb85c'; // Verde para processado ok
            else if (imageUrl.includes('placeholder_error_')) noteSpan.style.color = '#d9534f'; // Vermelho para erro
            infoDiv.appendChild(noteSpan);
        }


        if (imageUrl.startsWith('http')) {
            const imgForDims = new Image();
            imgForDims.onload = () => { resolutionSpan.textContent = `Res: ${imgForDims.naturalWidth}x${imgForDims.naturalHeight}`; };
            imgForDims.onerror = () => { resolutionSpan.textContent = 'Res: Falha ao carregar'; };
            imgForDims.src = imageUrl;
        } else {
            resolutionSpan.textContent = 'Res: N/A (URL Local/Inválida)';
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'image-block-actions';

        const upBtn = document.createElement('button');
        upBtn.className = 'button-secondary btn-icon';
        upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        upBtn.title = "Mover para cima";
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => handleMoveImage(index, -1));

        const downBtn = document.createElement('button');
        downBtn.className = 'button-secondary btn-icon';
        downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
        downBtn.title = "Mover para baixo";
        downBtn.disabled = index === productImagesInternal.length - 1;
        downBtn.addEventListener('click', () => handleMoveImage(index, 1));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'button-secondary btn-icon btn-remove-img'; // Adicionei btn-remove-img para possível estilização específica
        removeBtn.innerHTML = '<i class="fas fa-trash-alt" style="color: #c0392b;"></i>';
        removeBtn.title = "Remover imagem";
        removeBtn.addEventListener('click', () => handleRemoveImage(index));

        actionsDiv.appendChild(upBtn);
        actionsDiv.appendChild(downBtn);
        actionsDiv.appendChild(removeBtn);

        block.appendChild(thumbDiv);
        block.appendChild(infoDiv);
        block.appendChild(actionsDiv);
        imagePreviewContainer.appendChild(block);
    });
    updateImageActionButtonsState();
}

function handleAddImageToArray(url) {
    if (!url || !url.startsWith('http')) {
        displayStatusMessage(imageAddStatusEl, 'URL de imagem inválida. Deve começar com http:// ou https://', 'warning');
        return;
    }
    if (productImagesInternal.length >= 12) {
        displayStatusMessage(imageAddStatusEl, 'Limite máximo de 12 imagens atingido.', 'warning');
        return;
    }
    productImagesInternal.push({ source: url, note: 'Nova' }); // Adiciona como objeto
    renderProductImagesJS();
    if (newImageUrlInput) newImageUrlInput.value = '';
    displayStatusMessage(imageAddStatusEl, 'Imagem adicionada à lista.', 'success');
}

function handleRemoveImage(index) {
    if (index >= 0 && index < productImagesInternal.length) {
        productImagesInternal.splice(index, 1);
        renderProductImagesJS();
        displayStatusMessage(imageAddStatusEl, 'Imagem removida.', 'info');
    }
}

function handleMoveImage(index, direction) {
    if (index < 0 || index >= productImagesInternal.length) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= productImagesInternal.length) return;

    const item = productImagesInternal.splice(index, 1)[0];
    productImagesInternal.splice(newIndex, 0, item);
    renderProductImagesJS();
}

async function handleOptimizeFirstImage() {
    if (productImagesInternal.length === 0 || !productImagesInternal[0].source || !productImagesInternal[0].source.startsWith('http')) {
        displayStatusMessage(imageAddStatusEl, "Nenhuma imagem válida para otimizar.", 'warning');
        return;
    }
    const firstImageUrl = productImagesInternal[0].source;
    if (firstImageUrl.includes('_optimized_1000px') || firstImageUrl.includes('_rbg_processed')) {
        displayStatusMessage(imageAddStatusEl, "A primeira imagem já parece ter sido processada.", 'info');
        return;
    }

    const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}');
    if (!appConfig.imgur_client_id) {
        displayStatusMessage(imageAddStatusEl, "Client ID do Imgur não configurado nas Configurações API.", 'error');
        return;
    }

    displayStatusMessage(imageAddStatusEl, `${createSpinnerIcon()} Otimizando primeira imagem...`, 'info', true);
    if(optimizeFirstImageBtn) optimizeFirstImageBtn.disabled = true;
    if(removeBgFirstImageBtn) removeBgFirstImageBtn.disabled = true;

    try {
        const result = await optimizeImageAPI(firstImageUrl); // Chama API de otimização
        productImagesInternal[0] = { source: result.newUrl, note: `Otimizada (${result.service_used})` };
        displayStatusMessage(imageAddStatusEl, `Primeira imagem otimizada e hospedada em ${result.service_used}!`, 'success');
    } catch (error) {
        productImagesInternal[0] = { source: `placeholder_error_optimize_${Date.now()}.png`, note: `Falha Otimizar: ${error.message.substring(0,30)}...` };
        displayStatusMessage(imageAddStatusEl, `Erro ao otimizar: ${error.message}`, 'error');
    } finally {
        renderProductImagesJS(); // Re-renderiza para mostrar a URL nova ou o placeholder de erro
    }
}

async function handleRemoveBgFirstImage() {
    if (productImagesInternal.length === 0 || !productImagesInternal[0].source || !productImagesInternal[0].source.startsWith('http')) {
        displayStatusMessage(imageAddStatusEl, "Nenhuma imagem válida para remover fundo.", 'warning');
        return;
    }
    const firstImageUrl = productImagesInternal[0].source;
     if (firstImageUrl.includes('_rbg_processed')) {
        displayStatusMessage(imageAddStatusEl, "O fundo da primeira imagem já parece ter sido removido.", 'info');
        return;
    }

    const appConfig = JSON.parse(sessionStorage.getItem('appConfigCache') || '{}');
    if (!appConfig.removebg_api_key) {
        displayStatusMessage(imageAddStatusEl, "Chave API do Remove.bg não configurada.", 'error'); return;
    }
    if (!appConfig.imgur_client_id) {
        if (!confirm("Client ID do Imgur não configurado. A imagem processada não será hospedada automaticamente. Deseja continuar apenas com o processamento do Remove.bg?")) {
            displayStatusMessage(imageAddStatusEl, "Operação cancelada pelo usuário.", 'warning'); return;
        }
    }
     const currentCreditsUsed = appConfig.removebg_credits_used_month || 0;
    if (currentCreditsUsed >= 50) {
        displayStatusMessage(imageAddStatusEl, "Créditos Remove.bg esgotados para este mês.", 'error');
        updateImageActionButtonsState(); // Atualiza estado do botão
        return;
    }


    displayStatusMessage(imageAddStatusEl, `${createSpinnerIcon()} Removendo fundo da primeira imagem...`, 'info', true);
    if(optimizeFirstImageBtn) optimizeFirstImageBtn.disabled = true;
    if(removeBgFirstImageBtn) removeBgFirstImageBtn.disabled = true;

    try {
        const result = await removeBackgroundImageAPI(firstImageUrl); // Chama API
        let message = result.message || "Processamento Remove.bg concluído.";
        let msgType = 'success';

        if (result.newUrl) {
            // Adiciona a nova imagem processada no início da lista
            productImagesInternal.unshift({ source: result.newUrl, note: `Fundo Removido (${result.service_used}, ${result.credits_charged} créd.)` });
            message = `Fundo removido e imagem hospedada em ${result.service_used}. Créditos usados: ${result.credits_charged}.`;
        } else if (result.error_message && result.service_used === "Local (Upload Falhou)") {
            // Se RemoveBG funcionou mas upload falhou, ainda adiciona um placeholder
            message = `Processada, mas falha no upload: ${result.error_message}. Créditos usados: ${result.credits_charged}.`;
            msgType = 'warning';
            productImagesInternal.unshift({ source: `placeholder_error_rbg_${Date.now()}.png`, note: `RemoveBG OK, Upload Falhou (${result.credits_charged} créd.)` });
        } else if (result.error_message) { // Erro direto do RemoveBG ou da nossa lógica
            throw new Error(result.error_message);
        } else if (!result.newUrl && result.credits_charged !== undefined ) { // RemoveBG pode ter funcionado mas sem URL (ex: erro de hospedagem não tratado)
            message = `Processamento Remove.bg concluído (Créditos: ${result.credits_charged}), mas sem nova URL. Verifique o console do servidor.`;
            msgType = 'warning';
        }

        if (productImagesInternal.length > 12) {
            productImagesInternal.pop(); // Remove a última se exceder o limite
        }
        displayStatusMessage(imageAddStatusEl, message, msgType);
        
        // Atualizar créditos na UI se eles foram cobrados
        if (result.credits_charged !== undefined && result.credits_charged > 0) {
            // Recarregar configs para atualizar contagem de créditos de forma centralizada
            const configApiModule = await import('./config_api.js');
            configApiModule.loadApiConfigsJS();
        }

    } catch (error) {
        // Se o erro foi do RemoveBG e ele ainda retornou créditos, exibe
        const creditsInError = error.credits_charged !== undefined ? ` (Créditos usados: ${error.credits_charged})` : '';
        displayStatusMessage(imageAddStatusEl, `Erro ao remover fundo: ${error.message}${creditsInError}`, 'error');
         // Atualizar créditos na UI mesmo em erro se a API retornou a info
        if (error.credits_charged !== undefined && error.credits_charged > 0) {
            const configApiModule = await import('./config_api.js');
            configApiModule.loadApiConfigsJS();
        }
    } finally {
        renderProductImagesJS(); // Re-renderiza para mostrar a nova imagem ou placeholder
    }
}


// --- Funções Exportadas ---
export function initImagesTab() {
    if (addImageUrlBtn && newImageUrlInput) {
        addImageUrlBtn.addEventListener('click', () => handleAddImageToArray(newImageUrlInput.value.trim()));
        newImageUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAddImageToArray(newImageUrlInput.value.trim());}
        });
    }
    if (optimizeFirstImageBtn) {
        optimizeFirstImageBtn.addEventListener('click', handleOptimizeFirstImage);
    }
    if (removeBgFirstImageBtn) {
        removeBgFirstImageBtn.addEventListener('click', handleRemoveBgFirstImage);
    }

    renderProductImagesJS(); // Renderiza inicialmente (lista vazia ou com dados anteriores se persistidos)
    console.log("Images Tab Initialized");
}

export function populateImagesFromTinyData(anexosTiny) {
    productImagesInternal = []; // Limpa imagens existentes
    if (anexosTiny && Array.isArray(anexosTiny)) {
        anexosTiny.forEach(anexo => {
            if (anexo && typeof anexo.anexo === 'string' && anexo.anexo.startsWith('http')) {
                if (productImagesInternal.length < 12) {
                    productImagesInternal.push({ source: anexo.anexo, note: 'Tiny' });
                }
            }
        });
    }
    renderProductImagesJS(); // Re-renderiza com as imagens do Tiny
    if(imageAddStatusEl) displayStatusMessage(imageAddStatusEl, `${productImagesInternal.length} imagens carregadas do Tiny.`, 'info');
}

export function clearProductImages() {
    productImagesInternal = [];
    // Não precisa chamar renderProductImagesJS() aqui, pois o chamador (clearProductRelatedFieldsOnTab)
    // já tem uma chamada a renderProductImages() em images_tab.js que será feita indiretamente.
    // Ou, para ser mais explícito:
    if (imagePreviewContainer) {
        imagePreviewContainer.innerHTML = '<p style="text-align:center; color:#777; padding:20px;">Nenhuma imagem adicionada.</p>';
    }
    updateImageActionButtonsState();
    console.log("Product images cleared (images_tab.js).");
}

// Para obter as imagens atuais para publicação ou outras abas
export function getCurrentProductImages() {
    return productImagesInternal.map(imgData => ({ source: (typeof imgData === 'string' ? imgData : imgData.source) }));
}