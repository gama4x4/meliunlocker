import requests
import time
import json
from .config_manager import load_app_config, save_app_config

# Constantes da API Tiny v3
TINY_V3_TOKEN_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token"
TINY_V3_API_BASE_URL = "https://api.tiny.com.br/public-api/v3"

def _refresh_tiny_v3_token():
    """Tenta renovar o token de acesso Tiny v3."""
    config = load_app_config()
    refresh_token = config.get('tiny_v3_refresh_token')
    client_id = config.get('tiny_v3_client_id')
    client_secret = config.get('tiny_v3_client_secret')

    if not all([refresh_token, client_id, client_secret]):
        print("TINY REFRESH: Faltam credenciais para renovar o token.")
        return None

    payload = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': refresh_token
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    try:
        response = requests.post(TINY_V3_TOKEN_URL, data=payload, headers=headers, timeout=15)
        response.raise_for_status()
        token_data = response.json()
        
        config['tiny_v3_access_token'] = token_data['access_token']
        if 'refresh_token' in token_data:
            config['tiny_v3_refresh_token'] = token_data['refresh_token']
        config['tiny_v3_expires_at'] = time.time() + token_data['expires_in'] - 60
        
        save_app_config(config)
        print("TINY REFRESH: Token atualizado com sucesso.")
        return config['tiny_v3_access_token']
    except requests.RequestException as e:
        print(f"TINY REFRESH: Erro ao tentar renovar token: {e}")
        return None

def _get_tiny_v3_access_token():
    """Retorna um token v3 válido, tentando refresh se necessário."""
    config = load_app_config()
    token = config.get('tiny_v3_access_token')
    expires_at = float(config.get('tiny_v3_expires_at', 0))

    if not token or time.time() >= expires_at:
        return _refresh_tiny_v3_token()
    return token

def _tiny_api_v3_request(method, endpoint, params=None, json_data=None):
    """Função central para fazer requisições à API v3 do Tiny."""
    access_token = _get_tiny_v3_access_token()
    if not access_token:
        return {"error": True, "message": "Não autenticado com a API v3 do Tiny."}

    headers = {'Authorization': f'Bearer {access_token}'}
    if json_data:
        headers['Content-Type'] = 'application/json'
    
    url = f"{TINY_V3_API_BASE_URL}{endpoint}"
    try:
        response = requests.request(method.upper(), url, headers=headers, params=params, json=json_data, timeout=25)
        response.raise_for_status()
        return response.json() if response.content else {"success": True}
    except requests.exceptions.HTTPError as e:
        error_text = e.response.text
        try: error_text = e.response.json()
        except: pass
        return {"error": True, "status_code": e.response.status_code, "message": error_text}
    except requests.exceptions.RequestException as e:
        return {"error": True, "message": f"Erro de conexão com a API Tiny: {e}"}

def _get_tiny_product_id_by_sku(sku):
    """Busca o ID de um produto no Tiny pelo SKU via API v3."""
    response = _tiny_api_v3_request('GET', '/produtos', params={'codigo': sku, 'limit': 1})
    if response and not response.get("error") and response.get("itens"):
        return response["itens"][0].get("id")
    return None

def fetch_product_details_from_tiny(sku=None, product_id_tiny=None, token_v2=None):
    """
    Busca os detalhes de um produto no Tiny. Lógica principal portada do desktop.
    Retorna um dicionário com os dados do produto ou uma mensagem de erro.
    """
    if not sku and not product_id_tiny:
        return {"error_message": "SKU ou ID do produto são necessários.", "status_code": 400}
        
    try:
        # Lógica de busca por ID (prioriza o ID se fornecido)
        tiny_product_id = product_id_tiny
        if not tiny_product_id and sku:
            tiny_product_id = _get_tiny_product_id_by_sku(sku)

        if not tiny_product_id:
            return {"not_found": True, "message": f"Produto com SKU '{sku}' não encontrado no Tiny."}

        # Busca os detalhes completos do produto
        prod_detail = _tiny_api_v3_request('GET', f'/produtos/{tiny_product_id}')
        if not prod_detail or prod_detail.get("error"):
            return {"error_message": f"Falha ao obter detalhes: {prod_detail.get('message', 'Erro desconhecido')}"}

        # Busca o estoque
        estoque_detail = _tiny_api_v3_request('GET', f'/estoque/{tiny_product_id}')
        saldo_disponivel = 0
        if estoque_detail and not estoque_detail.get("error"):
            saldo_disponivel = float(estoque_detail.get("saldoDisponivel", 0))

        # Monta o dicionário de resposta para o frontend
        dimensoes = prod_detail.get("dimensoes", {})
        precos = prod_detail.get("precos", {})
        
        response_data = {
            "nome_tiny": prod_detail.get("descricao"),
            "codigo_tiny": prod_detail.get("sku", prod_detail.get("codigo")),
            "estoque_tiny": saldo_disponivel,
            "preco_venda_tiny": precos.get("preco"),
            "preco_promocional_tiny": precos.get("precoPromocional"),
            "dias_preparacao_tiny": prod_detail.get("estoque", {}).get("diasPreparacao"),
            "permite_retirada_tiny": prod_detail.get("retirarPessoalmente"),
            "altura_embalagem_tiny": dimensoes.get("altura"),
            "largura_embalagem_tiny": dimensoes.get("largura"),
            "comprimento_embalagem_tiny": dimensoes.get("comprimento"),
            "peso_bruto_tiny": dimensoes.get("pesoBruto"),
            "descricao_complementar_tiny": prod_detail.get("descricaoComplementar", ""),
            "anexos_tiny": prod_detail.get("anexos", []),
            "product_data": prod_detail # Retorna o objeto completo também
        }
        return response_data

    except Exception as e:
        return {"error_message": f"Erro interno no serviço Tiny: {e}", "status_code": 500}