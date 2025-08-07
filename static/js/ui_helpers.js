// backend/static/js/ui_helpers.js

/**
 * Exibe uma mensagem de status em um elemento HTML especificado.
 * @param {HTMLElement} element O elemento onde a mensagem será exibida.
 * @param {string} message A mensagem a ser exibida (pode conter HTML se allowHTML for true).
 * @param {'info' | 'success' | 'warning' | 'error'} type O tipo de mensagem (para estilização CSS).
 * @param {boolean} allowHTML Se true, a mensagem será inserida como innerHTML; caso contrário, textContent.
 */
export function displayStatusMessage(element, message, type = 'info', allowHTML = true) {
    if (element) {
        if (allowHTML) {
            element.innerHTML = message;
        } else {
            element.textContent = message;
        }
        // Garante que a classe base 'status-message' esteja presente e as outras de tipo sejam removidas antes de adicionar a nova.
        element.className = 'status-message'; // Reseta para a classe base
        if (type) {
            element.classList.add(type); // Adiciona a classe de tipo específica
        }
    } else {
        console.warn("displayStatusMessage: Tentativa de exibir mensagem em elemento nulo:", message, "Tipo:", type);
    }
}

/**
 * Cria um spinner de carregamento Font Awesome.
 * @returns {string} HTML string para o ícone de spinner.
 */
export function createSpinnerIcon() {
    return '<i class="fas fa-spinner fa-spin"></i>';
}

/**
 * Limpa todos os listeners de um elemento clonando-o.
 * Útil antes de adicionar novos listeners para evitar duplicidade.
 * @param {HTMLElement} oldElement O elemento a ser limpo.
 * @returns {HTMLElement} O novo elemento clonado e limpo.
 */
export function cleanElementListeners(oldElement) {
    if (!oldElement) return null;
    const newElement = oldElement.cloneNode(true);
    oldElement.parentNode.replaceChild(newElement, oldElement);
    return newElement;
}

/**
 * Formata um número para exibição como moeda (BRL).
 * @param {number} amount O valor numérico.
 * @returns {string} String formatada como R$ XX,XX.
 */
export function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        return "R$ --,--";
    }
    return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}

// Adicione mais helpers de UI conforme necessário (ex: para modais, tooltips genéricos, etc.)
console.log("ui_helpers.js loaded");