# backend/utils/ml_api_helpers.py
import requests
import time
import json
from flask import current_app # Para acessar config do Flask

def get_ml_user_info(access_token):
    """Busca informações do usuário ML (nickname, ID) usando o access_token."""
    if not access_token:
        print("get_ml_user_info: access_token não fornecido.")
        return None
    
    ml_user_info_url = current_app.config.get('ML_USER_INFO_URL')
    app_user_agent = current_app.config.get('APP_USER_AGENT')

    if not ml_user_info_url or not app_user_agent:
        print("get_ml_user_info: Configurações ML_USER_INFO_URL ou APP_USER_AGENT não encontradas no app Flask.")
        return None

    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent}
    try:
        response = requests.get(ml_user_info_url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Erro ao buscar info do usuário ML: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Detalhe API (get_ml_user_info): Status {e.response.status_code}, Texto: {e.response.text[:200]}")
        return None

def refresh_ml_token(refresh_token_value):
    """
    Tenta renovar um access token do ML usando um refresh token.
    Retorna um dicionário com os novos tokens e tempo de expiração ou None em caso de falha.
    """
    if not refresh_token_value:
        print("refresh_ml_token: refresh_token_value não fornecido.")
        return None

    client_id = current_app.config.get('ML_CLIENT_ID')
    client_secret = current_app.config.get('ML_CLIENT_SECRET')
    token_url = current_app.config.get('ML_TOKEN_URL')
    app_user_agent = current_app.config.get('APP_USER_AGENT')

    if not all([client_id, client_secret, token_url, app_user_agent]):
        print("refresh_ml_token: Configurações ML ausentes no app Flask.")
        return None

    payload = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': refresh_token_value
    }
    headers = {'Accept': 'application/json', 'User-Agent': app_user_agent}
    try:
        print(f"Refresh ML Token: Tentando renovar com refresh_token: ...{refresh_token_value[-6:]}")
        res = requests.post(token_url, data=payload, headers=headers, timeout=20)
        res.raise_for_status()
        token_data = res.json()

        new_at = token_data.get('access_token')
        # O refresh token pode ou não ser retornado. Se não for, reutilize o antigo.
        new_rt = token_data.get('refresh_token', refresh_token_value)
        new_exp_in = token_data.get('expires_in', 21600) # Default 6 horas
        user_id_from_token = str(token_data.get('user_id')) if token_data.get('user_id') else None

        if new_at:
            print(f"Refresh ML Token: Token renovado com sucesso.")
            return {
                'access_token': new_at,
                'refresh_token': new_rt,
                'expires_at': time.time() + new_exp_in,
                'user_id_from_token': user_id_from_token
            }
        else:
            print(f"Refresh ML Token: Falha - access_token não recebido. Data: {token_data}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Refresh ML Token: Erro na requisição: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Detalhe API (refresh_ml_token): Status {e.response.status_code}, Texto: {e.response.text[:300]}")
        return None
    except Exception as e_gen:
        print(f"Refresh ML Token: Erro geral: {e_gen}")
        return None