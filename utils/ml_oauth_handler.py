# backend/utils/ml_oauth_handler.py
import requests
import time
import urllib.parse
from flask import current_app # Para acessar config do Flask
from .ml_api_helpers import get_ml_user_info # Importa da mesma pasta utils

def exchange_ml_code_for_token(auth_code, redirect_uri_used_for_auth):
    """Troca o código de autorização do ML por tokens de acesso e refresh."""
    if not auth_code:
        return {"error": True, "message": "Código de autorização não fornecido."}

    client_id = current_app.config['ML_CLIENT_ID']
    client_secret = current_app.config['ML_CLIENT_SECRET']
    token_url = current_app.config['ML_TOKEN_URL']
    app_user_agent = current_app.config['APP_USER_AGENT']

    payload = {
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'code': auth_code,
        'redirect_uri': redirect_uri_used_for_auth # Crucial que seja a mesma usada no início
    }
    headers = {'Accept': 'application/json', 'User-Agent': app_user_agent}

    try:
        print(f"OAuth ML: Trocando código por token. redirect_uri usada na troca: {redirect_uri_used_for_auth}")
        response = requests.post(token_url, data=payload, headers=headers, timeout=30)
        response.raise_for_status()
        token_data = response.json()

        access_token = token_data.get('access_token')
        refresh_token = token_data.get('refresh_token')
        expires_in = token_data.get('expires_in', 21600)
        user_id_ml_from_token = str(token_data.get('user_id')) if token_data.get('user_id') else None

        if not access_token or not refresh_token:
            print(f"OAuth ML: Erro ao obter tokens. Resposta: {token_data}")
            return {"error": True, "message": "Falha ao processar tokens do Mercado Livre."}

        user_info_data = get_ml_user_info(access_token) # get_ml_user_info agora usa config do app

        if not user_info_data or not user_info_data.get("nickname") or not user_info_data.get("id"):
            print(f"OAuth ML: Erro ao obter informações do usuário. Resposta: {user_info_data}")
            return {"error": True, "message": "Não foi possível obter informações da conta Mercado Livre."}

        nickname = user_info_data["nickname"]
        seller_id = str(user_info_data["id"])

        new_account_data = {
            'nickname': nickname,
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_at': time.time() + expires_in,
            'seller_id': seller_id,
            'user_id_from_token': user_id_ml_from_token,
            'shipping_mode': 'me2' # Default, pode ser configurado depois
        }
        return {"error": False, "account_data": new_account_data}

    except requests.exceptions.RequestException as e:
        error_message = f"Erro de comunicação com o ML ao trocar código: {e}"
        if hasattr(e, 'response') and e.response is not None:
            error_message += f" - Detalhe API: {e.response.text[:300]}"
        print(error_message)
        return {"error": True, "message": error_message}
    except Exception as e_gen:
        print(f"Erro inesperado no fluxo de token OAuth ML: {e_gen}")
        return {"error": True, "message": f"Ocorreu um erro inesperado no OAuth: {str(e_gen)}"}