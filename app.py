# backend/app.py

import os
import json
import time
import requests
import urllib.parse
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, send_file
from passlib.hash import sha256_crypt # Para hashing de senha
import io # Para o PDF
from datetime import timedelta # Para sessão permanente
from openai import OpenAI # Importação global para uso no endpoint

# backend/app.py - CORREÇÃO FINAL

# --- Configuração da Aplicação Flask ---
project_root = os.path.dirname(os.path.abspath(__file__))
template_folder = os.path.join(project_root, 'templates')
static_folder = os.path.join(project_root, 'static')

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'uma-chave-secreta-forte-e-aleatoria-aqui') # Use uma chave mais segura
app.permanent_session_lifetime = timedelta(days=7)

# --- FIM DA CORREÇÃO ---

# --- Importações dos Módulos de Lógica da pasta utils ---
from utils.config_manager import (
    load_app_config, save_app_config,
    load_ml_accounts, save_ml_accounts
)
from utils.auth_utils import (
    login_required, FIXED_USERNAME,
    FIXED_PASSWORD_HASH, verify_user_password
)
from utils.ml_api_helpers import get_ml_user_info, refresh_ml_token
from utils.ml_oauth_handler import exchange_ml_code_for_token

try:
    from utils.tiny_api_service import fetch_product_details_from_tiny
except ImportError:
    print("ERRO CRÍTICO: Módulo utils.tiny_api_service não encontrado.")
    def fetch_product_details_from_tiny(sku, product_id_tiny, token):
        return {"error_message": "Lógica Tiny não carregada."}

try:
    from utils.ml_api_service import (
        get_ml_category_suggestion_logic,
        get_ml_categories_logic,
        search_ml_categories_logic,
        get_ml_category_attributes_logic,
        check_sku_on_ml_account_logic
        # Adicionar outras funções de ml_api_service conforme são implementadas
    )
except ImportError:
    print("ERRO CRÍTICO: Módulo utils.ml_api_service não encontrado.")
    def get_ml_category_suggestion_logic(title, token): return {"error_message": "ml_api_service não carregado."}
    def get_ml_categories_logic(token, cat_id=None): return {"error_message": "ml_api_service não carregado."}
    def search_ml_categories_logic(query, token): return {"error_message": "ml_api_service não carregado."}
    def get_ml_category_attributes_logic(cat_id, token): return {"error_message": "ml_api_service não carregado.", "attributes":[]}
    def check_sku_on_ml_account_logic(sku, token, seller_id): return {"error": True, "found":False, "items":[], "message": "ml_api_service não carregado."}


try:
    from utils.image_processing_logic import process_optimize_image_logic, process_remove_background_logic
except ImportError:
    print("ERRO CRÍTICO: Módulo utils.image_processing_logic não encontrado.")
    def process_optimize_image_logic(url): return {"error": True, "message":"image_processing_logic não carregado", "image_bytes": None}
    def process_remove_background_logic(url, key): return {"error": True, "message":"image_processing_logic não carregado", "image_bytes": None, "credits_charged": 0}

try:
    from utils.openai_logic import generate_description_with_chatgpt
except ImportError:
    print("ERRO CRÍTICO: Módulo utils.openai_logic não encontrado.")
    def generate_description_with_chatgpt(title, desc, key, model): return {"error": True, "message": "openai_logic não carregado", "new_description_html": "Placeholder."}

try:
    from utils.pricing_logic import calculate_final_price_for_listing_type, simulate_ml_free_shipping_logic, get_ml_api_fees_for_type_logic
except ImportError:
    print("ERRO CRÍTICO: Módulo utils.pricing_logic não encontrado.")
    def calculate_final_price_for_listing_type(*args, **kwargs): return {"price": 0.0, "fees_info": "pricing_logic não carregado"}
    def simulate_ml_free_shipping_logic(*args, **kwargs): return {"error": True, "message": "pricing_logic não carregado", "cost": 9999.99}
    def get_ml_api_fees_for_type_logic(*args, **kwargs): return 0.19, 6.00, 0.0 # Fallback genérico


# --- Constantes Globais e Configuração do App Flask (do seu código original) ---
app.config['ML_CLIENT_ID'] = '3574022221088825' # Do seu Tkinter
app.config['ML_CLIENT_SECRET'] = os.environ.get('ML_CLIENT_SECRET_ENV', 'msLQzMKsrF0is2hyoBgaa4dqE47E1SXE') # Do seu Tkinter
# IMPORTANTE: Esta URI deve ser a que está configurada no seu app ML e para onde o NGROK (ou seu servidor público) aponta.
app.config['ML_REDIRECT_URI_CONFIG'] = os.environ.get('ML_REDIRECT_URI_ENV', 'https://api.meliunlocker.cc/oauth/ml/callback') # Do seu Tkinter
app.config['ML_AUTH_URL_TEMPLATE'] = 'https://auth.mercadolivre.com.br/authorization?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&state={state}'
app.config['ML_TOKEN_URL'] = 'https://api.mercadolibre.com/oauth/token'
app.config['ML_USER_INFO_URL'] = "https://api.mercadolibre.com/users/me"
app.config['ML_SITES_URL'] = "https://api.mercadolibre.com/sites"
app.config['ML_SITE_ID'] = "MLB" # Do seu Tkinter
app.config['ML_CATEGORY_ATTRIBUTES_URL_TEMPLATE'] = "https://api.mercadolibre.com/categories/{cat_id}/attributes" # Do seu Tkinter
app.config['APP_USER_AGENT'] = "MeliUnlockerWebApp/1.0.PyWeb" # Atualizado
app.config['CHATGPT_MODEL_NAME_APP'] = "gpt-4o-mini" # Do seu Tkinter


# --- Funções de Upload de Imagem --- (Mantidas aqui por enquanto)
def _upload_to_imgur(image_bytes, client_id):
    if not client_id: print("Imgur: Client ID não fornecido."); return None
    try:
        headers = {'Authorization': f'Client-ID {client_id}'}
        response = requests.post("https://api.imgur.com/3/image", headers=headers, files={'image': image_bytes}, timeout=45)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data', {}).get('link'): return data['data']['link']
        print(f"Imgur Upload Erro: {response.status_code} - {response.text[:200]}"); return None
    except Exception as e: print(f"Imgur Upload Exceção: {e}"); return None

def _upload_to_0x0st(image_bytes, filename="image.jpg"):
    try:
        response = requests.post("https://0x0.st", files={'file': (filename, image_bytes)}, timeout=30)
        response.raise_for_status()
        public_url = response.text.strip()
        return public_url if public_url.startswith("http") else None
    except Exception as e: print(f"0x0.st Upload Exceção: {e}"); return None

# --- Rotas de Autenticação ---
@app.before_request
def make_session_permanent(): session.permanent = True

@app.route('/login', methods=['GET', 'POST'])
def login_route():
    if 'logged_in_user' in session: return redirect(url_for('dashboard_route'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username'); password = request.form.get('password')
        if username == FIXED_USERNAME and verify_user_password(password, FIXED_PASSWORD_HASH):
            session['logged_in_user'] = username
            session['app_config'] = load_app_config()
            session['ml_accounts'] = load_ml_accounts()
            session['active_ml_account_nickname'] = None # Resetar conta ativa no login
            print(f"Usuário '{username}' logado."); next_url = request.args.get('next');
            return redirect(next_url or url_for('dashboard_route'))
        else: error = 'Credenciais inválidas.'; print(f"Login falhou para: {username}")
    return render_template('login.html', error=error)

@app.route('/logout')
def logout_route(): session.clear(); return redirect(url_for('login_route'))

# --- Rota Principal (Dashboard) ---
@app.route('/')
@login_required
def dashboard_route(): return render_template('dashboard.html', username=session.get('logged_in_user'))

# --- API Endpoints ---
# == Configurações da Aplicação ==
@app.route('/api/app-config', methods=['GET', 'POST'])
@login_required
def api_app_config_handler():
    # Garante que app_config na sessão está atualizado se o arquivo mudou externamente (pouco provável aqui)
    # Mas é bom para consistência.
    current_config_from_file = load_app_config()
    session_config = session.get('app_config', {}).copy()

    # Sincroniza sessão com arquivo, priorizando o arquivo se não for POST
    if request.method == 'GET':
        for key in current_config_from_file:
            if key not in session_config or session_config[key] != current_config_from_file[key]:
                 session_config[key] = current_config_from_file[key]
        session['app_config'] = session_config # Atualiza sessão
        return jsonify(session_config)

    elif request.method == 'POST':
        data = request.json;
        allowed_keys = ['tiny_api_v2_token', 'removebg_api_key', 'imgur_client_id', 'chatgpt_api_key']
        updated_config_for_save = current_config_from_file.copy() # Começa com o que está no arquivo
        session_updated = False

        for key in allowed_keys:
            if key in data:
                updated_config_for_save[key] = data[key] # Atualiza o dict que será salvo
                session_config[key] = data[key] # Atualiza o dict da sessão
                session_updated = True

        if session_updated: # Se algo foi realmente alterado pelo POST
            save_app_config(updated_config_for_save)
            session['app_config'] = session_config # Salva as alterações na sessão
            return jsonify({"success": True, "message": "Configurações salvas e sessão atualizada."})
        return jsonify({"error": "Nenhuma chave válida para atualizar ou valores são os mesmos."}), 400


# == Mercado Livre Contas & Auth ==
def _get_active_ml_token_from_session_and_refresh(for_api_call=True):
    active_nick = session.get('active_ml_account_nickname')
    ml_accounts_data_session_copy = session.get('ml_accounts', {}).copy()

    if not active_nick or active_nick not in ml_accounts_data_session_copy:
        return None, "Nenhuma conta ML ativa selecionada."

    account_data = ml_accounts_data_session_copy[active_nick]
    access_token = account_data.get('access_token')
    expires_at = account_data.get('expires_at', 0)
    seller_id = account_data.get('seller_id')

    token_needs_refresh = not access_token or time.time() >= expires_at

    if token_needs_refresh:
        print(f"Token para '{active_nick}' (Sessão) {'expirado/ausente' if for_api_call else 'precisa de refresh para UI'}, tentando refresh...")
        new_token_info = refresh_ml_token(account_data.get('refresh_token')) # Usa helper de ml_api_helpers
        if new_token_info:
            account_data.update(new_token_info)
            # Tenta obter/atualizar seller_id após refresh bem-sucedido
            if not account_data.get('seller_id') and new_token_info.get('access_token'):
                user_info = get_ml_user_info(new_token_info['access_token'])
                if user_info and user_info.get("id"):
                    account_data['seller_id'] = str(user_info.get("id"))
            
            all_ml_accounts_master = load_ml_accounts() # Carrega do arquivo para garantir que estamos atualizando a fonte da verdade
            all_ml_accounts_master[active_nick] = account_data # Atualiza a conta específica
            save_ml_accounts(all_ml_accounts_master) # Salva no arquivo
            session['ml_accounts'] = all_ml_accounts_master # Atualiza a sessão Flask com todas as contas
            
            access_token = account_data.get('access_token')
            seller_id = account_data.get('seller_id') # Atualiza seller_id
            print(f"Token para '{active_nick}' (Sessão) renovado.")
        else:
            return None, f"Falha ao renovar token para '{active_nick}'."
    
    if not access_token: return None, "Token de acesso inválido após tentativa de refresh."
    if for_api_call and not seller_id: # Se for para uma chamada de API que precisa de seller_id
        user_info_seller = get_ml_user_info(access_token)
        if user_info_seller and user_info_seller.get("id"):
            seller_id = str(user_info_seller.get("id"))
            all_ml_accounts_master_sid = load_ml_accounts()
            if active_nick in all_ml_accounts_master_sid:
                all_ml_accounts_master_sid[active_nick]['seller_id'] = seller_id
                save_ml_accounts(all_ml_accounts_master_sid)
                session['ml_accounts'] = all_ml_accounts_master_sid
            else: # Improvável, mas por segurança
                print(f"Aviso: conta {active_nick} não encontrada ao tentar salvar seller_id pós-fetch.")
        else:
            return None, f"Falha ao obter Seller ID para {active_nick} para chamada API."

    return access_token, seller_id, None # Retorna token, seller_id e None para erro


@app.route('/api/ml/accounts', methods=['GET'])
@login_required
def api_get_ml_accounts_handler():
    # Sempre carrega do arquivo para garantir dados frescos,
    # pois o refresh pode ter acontecido em outra requisição.
    ml_accounts_from_file = load_ml_accounts()
    session['ml_accounts'] = ml_accounts_from_file # Sincroniza sessão

    accounts_to_send = {}
    accounts_data_changed_by_refresh_during_list = False

    for nick, acc_data_loop in ml_accounts_from_file.items():
        temp_acc_data = acc_data_loop.copy() # Trabalha com cópia para cada conta
        token_expired_or_missing = not temp_acc_data.get('access_token') or \
                                   not temp_acc_data.get('expires_at') or \
                                   time.time() >= temp_acc_data['expires_at']

        if token_expired_or_missing and temp_acc_data.get('refresh_token'):
            print(f"API Listar Contas: Token para {nick} precisa de refresh, tentando...")
            new_token_data = refresh_ml_token(temp_acc_data.get('refresh_token'))
            if new_token_data:
                temp_acc_data.update(new_token_data)
                # Tenta garantir seller_id após refresh
                if not temp_acc_data.get('seller_id') and new_token_data.get('access_token'):
                    user_info = get_ml_user_info(new_token_data['access_token'])
                    if user_info and user_info.get("id"):
                        temp_acc_data['seller_id'] = str(user_info.get("id"))
                ml_accounts_from_file[nick] = temp_acc_data # Atualiza no dict principal que será salvo
                accounts_data_changed_by_refresh_during_list = True
                print(f"API Listar Contas: Token para {nick} renovado.")
            else:
                print(f"API Listar Contas: Falha ao renovar token para {nick} durante listagem.")
        
        # Prepara os dados para enviar ao frontend (sem tokens sensíveis, apenas info de validade)
        accounts_to_send[nick] = {
            "nickname": temp_acc_data.get("nickname"),
            "seller_id": temp_acc_data.get("seller_id"),
            "shipping_mode": temp_acc_data.get("shipping_mode", "me2"),
            "token_valid": bool(temp_acc_data.get('access_token') and \
                                temp_acc_data.get('expires_at') and \
                                time.time() < temp_acc_data.get('expires_at')),
            "expires_at_timestamp_for_display": temp_acc_data.get('expires_at') # Para debug no frontend
        }

    if accounts_data_changed_by_refresh_during_list:
        save_ml_accounts(ml_accounts_from_file) # Salva se houve alguma alteração
        session['ml_accounts'] = ml_accounts_from_file # Atualiza a sessão também

    return jsonify(accounts_to_send)


@app.route('/api/ml/accounts/remove', methods=['POST'])
@login_required
def api_remove_ml_account_handler():
    nickname_to_remove = request.json.get('nickname')
    # Sempre opera sobre os dados do arquivo como fonte da verdade
    ml_accounts_data_from_file = load_ml_accounts()
    if nickname_to_remove and nickname_to_remove in ml_accounts_data_from_file:
        del ml_accounts_data_from_file[nickname_to_remove]
        save_ml_accounts(ml_accounts_data_from_file)
        session['ml_accounts'] = ml_accounts_data_from_file # Atualiza sessão
        if session.get('active_ml_account_nickname') == nickname_to_remove:
            session['active_ml_account_nickname'] = None
        return jsonify({"success": True, "message": f"Conta {nickname_to_remove} removida."})
    return jsonify({"error": "Conta não encontrada para remoção."}), 400


@app.route('/api/ml/accounts/set-active', methods=['POST'])
@login_required
def api_set_active_ml_account_handler():
    nickname_to_set = request.json.get('nickname')
    # Sempre opera sobre os dados do arquivo como fonte da verdade
    ml_accounts_data_from_file = load_ml_accounts()

    if nickname_to_set and nickname_to_set in ml_accounts_data_from_file:
        acc_data_to_activate = ml_accounts_data_from_file[nickname_to_set].copy()
        token_needs_refresh = not acc_data_to_activate.get('access_token') or \
                              not acc_data_to_activate.get('expires_at') or \
                              time.time() >= acc_data_to_activate.get('expires_at', 0)

        if token_needs_refresh and acc_data_to_activate.get('refresh_token'):
            print(f"API Set Active: Token para '{nickname_to_set}' precisa de refresh, tentando...")
            new_token_info = refresh_ml_token(acc_data_to_activate.get('refresh_token'))
            if new_token_info:
                acc_data_to_activate.update(new_token_info)
                if not acc_data_to_activate.get('seller_id') and new_token_info.get('access_token'):
                    user_info = get_ml_user_info(new_token_info['access_token'])
                    if user_info and user_info.get("id"):
                        acc_data_to_activate['seller_id'] = str(user_info.get("id"))
                ml_accounts_data_from_file[nickname_to_set] = acc_data_to_activate # Atualiza no dict
                save_ml_accounts(ml_accounts_data_from_file) # Salva todas as contas no arquivo
                session['ml_accounts'] = ml_accounts_data_from_file # Atualiza a sessão com todas
            else:
                # Token não pôde ser renovado, mas a conta ainda pode ser "ativa" na UI,
                # embora as chamadas de API falharão.
                # O frontend deve mostrar o status de token inválido.
                session['active_ml_account_nickname'] = nickname_to_set # Seta como ativa
                session['ml_accounts'] = ml_accounts_data_from_file # Garante que a sessão tem os dados mais recentes do arquivo
                return jsonify({
                    "warning": f"Conta {nickname_to_set} ativada, mas FALHA ao renovar token. API calls podem falhar.",
                    "active_account_details": {
                        "nickname": nickname_to_set,
                        "seller_id": acc_data_to_activate.get('seller_id'),
                        "shipping_mode": acc_data_to_activate.get('shipping_mode', 'me2'),
                        "token_valid": False # Indica que o token não é válido
                    }
                }), 200 # Retorna 200 mas com aviso
        
        session['active_ml_account_nickname'] = nickname_to_set
        session['ml_accounts'] = ml_accounts_data_from_file # Garante que a sessão tem os dados mais recentes do arquivo

        return jsonify({
            "success": True,
            "message": f"Conta {nickname_to_set} ativada.",
            "active_account_details": {
                "nickname": nickname_to_set,
                "seller_id": acc_data_to_activate.get('seller_id'),
                "shipping_mode": acc_data_to_activate.get('shipping_mode', 'me2'),
                "token_valid": bool(acc_data_to_activate.get('access_token') and \
                                    acc_data_to_activate.get('expires_at') and \
                                    time.time() < acc_data_to_activate.get('expires_at',0))
            }
        })
    return jsonify({"error": "Nickname inválido ou conta não encontrada para ativar."}), 400

# ... (Rotas OAuth Start e Callback permanecem as mesmas) ...
@app.route('/oauth/ml/start-auth')
@login_required
def oauth_ml_start_auth_route():
    session['oauth_ml_state'] = os.urandom(16).hex() # Gera um estado único para segurança
    auth_url = app.config['ML_AUTH_URL_TEMPLATE'].format(
        client_id=app.config['ML_CLIENT_ID'],
        redirect_uri=urllib.parse.quote_plus(app.config['ML_REDIRECT_URI_CONFIG']), # Garante URL encoding
        state=session['oauth_ml_state']
    )
    return redirect(auth_url)

@app.route('/oauth/ml/callback', methods=['GET'])
def oauth_ml_callback_route():
    auth_code = request.args.get('code')
    returned_state = request.args.get('state')
    error_oauth = request.args.get('error')

    # Verificação de estado (CSRF protection)
    # if 'oauth_ml_state' not in session or session.pop('oauth_ml_state', None) != returned_state:
    #     return "Erro de estado OAuth. A tentativa de autenticação pode ter sido comprometida.", 403
    # Comentado porque a sessão pode ser diferente se o usuário demorar muito ou abrir em outra aba.
    # Para apps de servidor para servidor, o state é mais crítico. Para fluxo web onde o user clica, é menos propenso
    # a CSRF se o redirect_uri for bem controlado.

    if error_oauth:
        error_desc = request.args.get('error_description', error_oauth)
        return f"Erro retornado pelo Mercado Livre: {error_desc}", 400

    if not auth_code:
        return "Código de autorização não recebido do Mercado Livre.", 400

    # Troca o código pelo token
    result = exchange_ml_code_for_token(auth_code, app.config['ML_REDIRECT_URI_CONFIG'])

    if result.get("error"):
        return result.get("message", "Erro desconhecido durante a troca de código por token."), 500

    new_account_info = result.get("account_data")
    if new_account_info and new_account_info.get("nickname"):
        # Carrega contas existentes, adiciona/atualiza a nova, e salva
        ml_accounts = load_ml_accounts() # Carrega do arquivo
        ml_accounts[new_account_info['nickname']] = new_account_info
        save_ml_accounts(ml_accounts)

        # Se o usuário estiver logado na aplicação Flask, atualiza a sessão Flask
        if 'logged_in_user' in session:
            session['ml_accounts'] = ml_accounts
            # Opcional: definir esta nova conta como ativa na sessão
            # session['active_ml_account_nickname'] = new_account_info['nickname']
        
        return render_template("oauth_success.html", account_name=new_account_info['nickname'])
    else:
        return "Falha ao processar os dados da nova conta Mercado Livre após obter tokens.", 500


# == Tiny ERP ==
@app.route('/api/tiny/product-details', methods=['GET'])
@login_required
def api_tiny_product_details_route():
    sku = request.args.get('sku'); product_id_tiny_str = request.args.get('id')
    app_cfg = session.get('app_config', {}); tiny_api_token = app_cfg.get('tiny_api_v2_token')
    if not tiny_api_token: return jsonify({"error_message": "Token Tiny API não configurado."}), 400
    
    result = fetch_product_details_from_tiny(sku, product_id_tiny_str, tiny_api_token)
    
    if result.get("error_message"): return jsonify(result), result.get("status_code", 400)
    elif result.get("not_found"): return jsonify(result), 404
    elif result.get("product_data"): return jsonify(result.get("product_data")) # Retorna apenas os dados do produto
    
    return jsonify({"error_message": "Resposta Tiny inesperada ou produto não encontrado."}), 500


# == Mercado Livre - Categorias e Atributos ==
@app.route('/api/ml/suggest-category', methods=['GET'])
@login_required
def api_ml_suggest_category_route():
    title = request.args.get('title');
    if not title: return jsonify({"error_message": "Título é obrigatório para sugestão."}), 400
    
    access_token, _, error_token = _get_active_ml_token_from_session_and_refresh()
    if error_token: return jsonify({"error_message": error_token}), 401
    
    result = get_ml_category_suggestion_logic(title, access_token)
    # result agora pode ter {"error": True, "message": "..."} ou {"error": False, "message": "Nenhuma sugestão..."} ou dados
    if result.get("error"): # Erro real da nossa lógica ou erro da API ML que não foi 404
        return jsonify({"error_message": result.get("message")}), 500
    return jsonify(result) # Envia o resultado, que pode ser a sugestão ou a mensagem de "nenhuma sugestão"

@app.route('/api/ml/categories', methods=['GET'])
@app.route('/api/ml/categories/<category_id>', methods=['GET'])
@login_required
def api_ml_get_categories_route(category_id=None):
    print(f"API_ROUTE: /api/ml/categories - ID: {category_id}") # LOG
    access_token, _, error_token = _get_active_ml_token_from_session_and_refresh()
    if error_token: return jsonify({"error_message": error_token}), 401
    
    result = get_ml_categories_logic(access_token, category_id)
    if result.get("error"): # Se a lógica de serviço retornou um erro
        return jsonify({"error_message": result.get("message"), "categories": []}), 500 # Retorna erro e lista vazia
    return jsonify(result.get("categories", []))

@app.route('/api/ml/categories/search', methods=['GET'])
@login_required
def api_ml_search_categories_route():
    query = request.args.get('q')
    if not query or len(query) < 3: return jsonify({"error_message": "Busca deve ter > 2 chars."}), 400
    
    access_token, _, error_token = _get_active_ml_token_from_session_and_refresh()
    if error_token: return jsonify({"error_message": error_token}), 401
    
    result = search_ml_categories_logic(query, access_token)
    if result.get("error"): # Se a lógica de serviço retornou um erro (ex: 403 da API ML)
        return jsonify({"error_message": result.get("message"), "results": []}), 500
    return jsonify(result.get("results", []))


# backend/app.py
# ...
@app.route('/api/ml/category-attributes/<category_id>', methods=['GET'])
@login_required
def api_ml_get_category_attributes_route(category_id):
    access_token, _, error_token = _get_active_ml_token_from_session_and_refresh()
    if error_token: return jsonify({"error_message": error_token, "attributes": []}), 401 # Envia lista vazia em erro de token
    
    result = get_ml_category_attributes_logic(category_id, access_token) # de utils/ml_api_service.py
    
    # LOG PARA VER O QUE get_ml_category_attributes_logic RETORNOU
    print(f"DEBUG APP.PY - Resultado de get_ml_category_attributes_logic para {category_id}: {json.dumps(result, indent=2, ensure_ascii=False)}")

    if result.get("error_message"): 
        return jsonify({"error_message": result.get("error_message"), "attributes": []}), 500
    
    # Garante que sempre retorna uma lista de atributos no campo 'attributes'
    # A função get_ml_category_attributes_logic já deve retornar {"error": False, "attributes": attributes_data}
    return jsonify(result.get("attributes", [])), 200 # Retorna a lista diretamente


# == OpenAI (ChatGPT) ==
@app.route('/api/ml/generate-description-chatgpt', methods=['POST'])
@login_required
def api_ml_generate_description_chatgpt_route():
    data = request.json; title = data.get('title'); current_description = data.get('current_description', '')
    if not title: return jsonify({"error_message": "Título é necessário."}), 400
    
    app_cfg = session.get('app_config', {}); openai_api_key = app_cfg.get('chatgpt_api_key')
    if not openai_api_key: return jsonify({"error_message": "Chave API OpenAI não configurada."}), 400
    
    model_to_use = current_app.config.get('CHATGPT_MODEL_NAME_APP', 'gpt-4o-mini') # Pega do app.config
    result = generate_description_with_chatgpt(title, current_description, openai_api_key, model_to_use)
    
    if result.get("error"): return jsonify({"error_message": result.get("message")}), 500
    return jsonify({"new_description_html": result.get("new_description_html")})

# == Mercado Livre - SKU Check ==
@app.route('/api/ml/check-sku-status', methods=['POST'])
@login_required
def api_ml_check_sku_status_route():
    data = request.json; sku_to_check = data.get('sku')
    if not sku_to_check: return jsonify({"error_message": "SKU não fornecido."}), 400
    
    ml_accounts_session_copy = session.get('ml_accounts', {}).copy();
    sku_check_results = {};
    accounts_data_changed_by_refresh = False # Flag para salvar ml_accounts se houver refresh

    if not ml_accounts_session_copy:
        return jsonify({"message": "Nenhuma conta ML configurada para verificação."})

    for nickname, acc_data_orig in ml_accounts_session_copy.items():
        access_token_for_sku_check = acc_data_orig.get('access_token');
        seller_id_for_sku_check = acc_data_orig.get('seller_id')
        token_expired_or_missing = not access_token_for_sku_check or \
                                   time.time() >= acc_data_orig.get('expires_at', 0)

        if token_expired_or_missing and acc_data_orig.get('refresh_token'):
            print(f"API SKU Check: Token para {nickname} expirado, tentando refresh...")
            new_token_info = refresh_ml_token(acc_data_orig.get('refresh_token'))
            if new_token_info:
                acc_data_orig.update(new_token_info)
                if not acc_data_orig.get('seller_id') and new_token_info.get('access_token'):
                    user_info = get_ml_user_info(new_token_info['access_token'])
                    if user_info and user_info.get("id"):
                        acc_data_orig['seller_id'] = str(user_info.get("id"))
                
                # Atualiza a cópia principal que será salva no final
                ml_accounts_session_copy[nickname] = acc_data_orig
                access_token_for_sku_check = acc_data_orig.get('access_token')
                seller_id_for_sku_check = acc_data_orig.get('seller_id')
                accounts_data_changed_by_refresh = True
            else:
                sku_check_results[nickname] = {"error": "Falha ao renovar token."}; continue
        
        if not seller_id_for_sku_check and access_token_for_sku_check : # Se ainda não tem seller_id e tem token válido
            user_info_data = get_ml_user_info(access_token_for_sku_check)
            if user_info_data and user_info_data.get("id"):
                seller_id_for_sku_check = str(user_info_data.get("id"))
                ml_accounts_session_copy[nickname]['seller_id'] = seller_id_for_sku_check
                accounts_data_changed_by_refresh = True
            else:
                sku_check_results[nickname] = {"error": "Falha ao obter Seller ID."}; continue
        
        if not access_token_for_sku_check or not seller_id_for_sku_check:
            sku_check_results[nickname] = {"error": "Token ou Seller ID ausente para esta conta."}; continue

        sku_check_results[nickname] = check_sku_on_ml_account_logic(sku_to_check, access_token_for_sku_check, seller_id_for_sku_check)
        time.sleep(0.1) # Pequena pausa entre chamadas de API para diferentes contas

    if accounts_data_changed_by_refresh:
        save_ml_accounts(ml_accounts_session_copy) # Salva no arquivo
        session['ml_accounts'] = ml_accounts_session_copy # Atualiza a sessão Flask

    return jsonify(sku_check_results)

# == Processamento de Imagem ==
@app.route('/api/image/optimize', methods=['POST'])
@login_required
def api_image_optimize_route():
    data = request.json; image_url = data.get('imageUrl')
    if not image_url: return jsonify({"error_message": "URL da imagem não fornecida."}), 400
    
    app_cfg = session.get('app_config', {}); imgur_client_id = app_cfg.get('imgur_client_id')
    # result_processing já é um dict com "error", "message", "image_bytes"
    result_processing = process_optimize_image_logic(image_url)
    
    if result_processing.get("error"):
        return jsonify({"error_message": result_processing["message"]}), 500

    optimized_bytes = result_processing.get("image_bytes"); public_url = None; service_used = "N/A"
    if optimized_bytes:
        if imgur_client_id:
            public_url = _upload_to_imgur(optimized_bytes, imgur_client_id)
        if public_url:
            service_used = "Imgur"
        else: # Fallback para 0x0.st
            public_url = _upload_to_0x0st(optimized_bytes, f"opt_{int(time.time())}.jpg")
            service_used = "0x0.st" if public_url else "Falha Upload"
        
        if public_url:
            return jsonify({"success": True, "newUrl": public_url, "service_used": service_used})
        return jsonify({"error_message": "Imagem otimizada, mas falha ao hospedar."}), 500 # Erro se upload falhou
    
    return jsonify({"error_message": "Falha ao obter bytes otimizados da imagem."}), 500


@app.route('/api/image/remove-background', methods=['POST'])
@login_required
def api_image_remove_background_route():
    data = request.json; image_url = data.get('imageUrl')
    if not image_url: return jsonify({"error_message": "URL da imagem não fornecida."}), 400
    
    app_cfg_session_copy = session.get('app_config', {}).copy() # Trabalha com cópia
    removebg_api_key = app_cfg_session_copy.get('removebg_api_key')
    imgur_client_id = app_cfg_session_copy.get('imgur_client_id')

    if not removebg_api_key:
        return jsonify({"error_message": "Chave API Remove.bg não configurada."}), 400
    
    # Verifica créditos ANTES de chamar a API externa, se possível
    # (A lógica de crédito no Remove.bg pode ser mais complexa, esta é uma simplificação)
    current_credits_used = app_cfg_session_copy.get('removebg_credits_used_month', 0)
    if current_credits_used >= 50: # Limite mensal gratuito
        return jsonify({"error_message": "Créditos Remove.bg esgotados para este mês.", "credits_charged": 0}), 429 # Too Many Requests

    result_processing = process_remove_background_logic(image_url, removebg_api_key)
    credits_charged_api = result_processing.get("credits_charged", 0)

    if credits_charged_api > 0:
        app_cfg_session_copy['removebg_credits_used_month'] = app_cfg_session_copy.get('removebg_credits_used_month', 0) + credits_charged_api
        current_month_year_str = time.strftime("%m-%Y")
        if app_cfg_session_copy.get('removebg_last_reset_month_year') != current_month_year_str:
            app_cfg_session_copy['removebg_credits_used_month'] = credits_charged_api # Reseta se mudou o mês
            app_cfg_session_copy['removebg_last_reset_month_year'] = current_month_year_str
        save_app_config(app_cfg_session_copy) # Salva no arquivo
        session['app_config'] = app_cfg_session_copy # Atualiza sessão

    if result_processing.get("error"):
        return jsonify({"error_message": result_processing["message"], "credits_charged": credits_charged_api}), 500

    processed_bytes = result_processing.get("image_bytes"); public_url = None; service_used = "N/A"
    if processed_bytes:
        if imgur_client_id:
            public_url = _upload_to_imgur(processed_bytes, imgur_client_id)
        if public_url:
            service_used = "Imgur"
        else: # Fallback para 0x0.st
            public_url = _upload_to_0x0st(processed_bytes, f"rbg_processed_{int(time.time())}.png") # Salva como PNG
            service_used = "0x0.st" if public_url else "Falha Upload"
        
        if public_url:
            return jsonify({"success": True, "newUrl": public_url, "service_used": service_used, "credits_charged": credits_charged_api})
        # Se o upload falhou, mas o processamento RemoveBG funcionou
        return jsonify({
            "error_message": "Fundo removido, mas falha ao hospedar.",
            "service_used": "Local (Upload Falhou)", # Indica que o processamento local (RemoveBG) funcionou
            "credits_charged": credits_charged_api,
            # "image_data_b64": base64.b64encode(processed_bytes).decode('utf-8') # Opcional: enviar bytes para o frontend exibir localmente
        }), 200 # Retorna 200 OK, mas com um status que o frontend pode interpretar
    
    return jsonify({"error_message": "Falha ao obter bytes processados do Remove.bg."}), 500


# == Mercado Livre - Cálculo de Preços ==
@app.route('/api/ml/calculate-prices', methods=['POST'])
@login_required
def api_ml_calculate_prices_route():
    data_from_frontend = request.json
    print(f"API Calculate Prices: Recebido: {json.dumps(data_from_frontend, indent=2)}")

    required_fields = ['cost_price', 'desired_profit', 'profit_type', 'product_category_id', 'selected_ml_accounts']
    for field in required_fields:
        if field not in data_from_frontend or data_from_frontend[field] is None:
             if field == 'desired_profit' and data_from_frontend.get(field) == 0: pass
             else: return jsonify({"error_message": f"Campo obrigatório ausente ou inválido: {field}"}), 400
    if not data_from_frontend['selected_ml_accounts']:
        return jsonify({"error_message": "Nenhuma conta ML selecionada para cálculo."}), 400

    all_results = {}
    # Trabalhar com cópias da sessão para evitar modificar a sessão diretamente durante o loop
    ml_accounts_session_copy = session.get('ml_accounts', {}).copy()
    app_config_data = session.get('app_config', {}) # Usado para taxa de antecipação

    cost_price_base = float(data_from_frontend['cost_price'])
    if data_from_frontend.get('apply_discount_10'):
        cost_price_base *= 0.90

    for acc_nick in data_from_frontend['selected_ml_accounts']:
        if acc_nick not in ml_accounts_session_copy:
            all_results[acc_nick] = {"error": "Conta ML não encontrada na sessão."}
            continue

        account_data_loop = ml_accounts_session_copy[acc_nick].copy() # Cópia dos dados da conta
        access_token = account_data_loop.get('access_token')
        seller_id = account_data_loop.get('seller_id')
        shipping_mode = account_data_loop.get('shipping_mode', 'me2')
        token_expired_loop = not access_token or time.time() >= account_data_loop.get('expires_at', 0)

        if token_expired_loop and account_data_loop.get('refresh_token'):
            print(f"Calculo Preços: Token para {acc_nick} expirado, tentando refresh...")
            new_token_info_loop = refresh_ml_token(account_data_loop.get('refresh_token'))
            if new_token_info_loop:
                account_data_loop.update(new_token_info_loop)
                if not account_data_loop.get('seller_id') and new_token_info_loop.get('access_token'):
                    user_info_loop = get_ml_user_info(new_token_info_loop['access_token'])
                    if user_info_loop and user_info_loop.get("id"):
                        account_data_loop['seller_id'] = str(user_info_loop.get("id"))
                
                # Atualiza o dict principal que será salvo no arquivo e na sessão depois do loop
                ml_accounts_session_copy[acc_nick] = account_data_loop
                access_token = account_data_loop.get('access_token')
                seller_id = account_data_loop.get('seller_id')
            else:
                all_results[acc_nick] = {"error": f"Falha ao renovar token para {acc_nick}."}
                continue
        
        if not seller_id and access_token : # Se ainda não tem seller_id e tem token válido
            user_info_sid_loop = get_ml_user_info(access_token)
            if user_info_sid_loop and user_info_sid_loop.get("id"):
                seller_id = str(user_info_sid_loop.get("id"))
                ml_accounts_session_copy[acc_nick]['seller_id'] = seller_id
            else:
                 all_results[acc_nick] = {"error": f"Falha ao obter Seller ID para {acc_nick}."}
                 continue
        
        if not access_token or not seller_id: # Checagem final pós-refresh/fetch de seller_id
             all_results[acc_nick] = {"error": f"Token ou Seller ID inválido para {acc_nick} após tentativas."}
             continue


        acc_result_calc = {
            "account_shipping_mode": shipping_mode, "shipping_final_cost": 0.0,
            "shipping_list_cost_api": 0.0, "shipping_promoted_amount_api": 0.0, "shipping_api_discount_rate": 0.0,
            "classic_price": 0.0, "classic_fees_info": "Não calculado",
            "premium_price": 0.0, "premium_fees_info": "Não calculado",
            "error": None
        }

        shipping_cost_for_seller_calc = 0.0
        if data_from_frontend.get('offer_free_shipping') and shipping_mode == 'me2':
            dims_calc = data_from_frontend.get('dimensions', {})
            dims_str_calc = None
            if all(dims_calc.get(k, 0) > 0 for k in ['height', 'width', 'length', 'weight_kg']):
                dims_str_calc = f"{int(dims_calc['height'])}x{int(dims_calc['width'])}x{int(dims_calc['length'])},{int(dims_calc['weight_kg'] * 1000)}"
            
            zip_calc = data_from_frontend.get('origin_zip')
            if dims_str_calc and zip_calc:
                # Estimativa de preço para simulação de frete (melhorada)
                profit_val_for_est = float(data_from_frontend['desired_profit'])
                if data_from_frontend['profit_type'] == 'PERCENT':
                     profit_val_for_est = cost_price_base * (profit_val_for_est / 100.0)
                
                est_price_for_ship_sim_calc = (cost_price_base + profit_val_for_est + 25.0 + 6.0) / 0.83 # Denom. para Premium aprox.
                if est_price_for_ship_sim_calc <= 0: est_price_for_ship_sim_calc = cost_price_base + profit_val_for_est + 5.0


                shipping_sim_result_calc = simulate_ml_free_shipping_logic(
                    access_token, seller_id, est_price_for_ship_sim_calc,
                    "gold_pro", # Simula com premium para custo seguro
                    data_from_frontend['product_category_id'],
                    dims_str_calc, zip_calc
                )
                if not shipping_sim_result_calc.get("error"):
                    shipping_cost_for_seller_calc = shipping_sim_result_calc.get("cost", 0.0)
                    acc_result_calc.update({
                        "shipping_final_cost": shipping_cost_for_seller_calc,
                        "shipping_list_cost_api": shipping_sim_result_calc.get("list_cost_api"),
                        "shipping_promoted_amount_api": shipping_sim_result_calc.get("promoted_amount_api"),
                        "shipping_api_discount_rate": shipping_sim_result_calc.get("rate_api")
                    })
                else:
                    acc_result_calc["error"] = f"Falha frete: {shipping_sim_result_calc.get('message')}"
                    all_results[acc_nick] = acc_result_calc; continue
            elif data_from_frontend.get('offer_free_shipping'):
                 acc_result_calc["error"] = "Frete grátis sel., mas dims/CEP ausentes."
                 all_results[acc_nick] = acc_result_calc; continue
        
        # Calcular para Clássico
        if data_from_frontend.get('publish_classic', True):
            classic_calc_res = calculate_final_price_for_listing_type(
                cost_price_base, float(data_from_frontend['desired_profit']),
                data_from_frontend['profit_type'] == 'PERCENT',
                shipping_cost_for_seller_calc, data_from_frontend['product_category_id'],
                'gold_special', access_token,
                data_from_frontend.get('include_anticipation_fee', False)
            )
            acc_result_calc["classic_price"] = classic_calc_res["price"]
            acc_result_calc["classic_fees_info"] = classic_calc_res["fees_info"]

        # Calcular para Premium
        if data_from_frontend.get('publish_premium', True):
            premium_calc_res = calculate_final_price_for_listing_type(
                cost_price_base, float(data_from_frontend['desired_profit']),
                data_from_frontend['profit_type'] == 'PERCENT',
                shipping_cost_for_seller_calc, data_from_frontend['product_category_id'],
                'gold_pro', access_token,
                data_from_frontend.get('include_anticipation_fee', False)
            )
            acc_result_calc["premium_price"] = premium_calc_res["price"]
            acc_result_calc["premium_fees_info"] = premium_calc_res["fees_info"]
        
        all_results[acc_nick] = acc_result_calc
        time.sleep(0.15)

    # Após o loop, se alguma conta foi atualizada devido a refresh de token, salva no arquivo e na sessão.
    if any(ml_accounts_session_copy[nick] != session.get('ml_accounts',{}).get(nick) for nick in ml_accounts_session_copy):
        save_ml_accounts(ml_accounts_session_copy)
        session['ml_accounts'] = ml_accounts_session_copy

    return jsonify(all_results)


# --- Bloco Principal de Execução ---
if __name__ == '__main__':
    # Cria a pasta 'config' se não existir, ANTES de tentar usá-la
    config_dir_main = os.path.abspath(os.path.join(os.path.dirname(__file__), 'config'))
    os.makedirs(config_dir_main, exist_ok=True)
    
    redirect_uri_for_print = app.config.get('ML_REDIRECT_URI_CONFIG', 'N/D')
    base_url_for_print = redirect_uri_for_print.split('/oauth')[0] if '/oauth' in redirect_uri_for_print else redirect_uri_for_print
    print(f"Servidor Flask iniciando. Acesse em http://localhost:8080 ou sua URL pública como {base_url_for_print}")
    print(f"ML Redirect URI configurada para: {redirect_uri_for_print}")
    print(f"Pasta de configuração esperada em: {config_dir_main}")
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))