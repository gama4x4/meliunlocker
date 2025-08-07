# backend/utils/ml_auth_logic.py
import requests
import time
import json # Para debug
from .ml_api_helpers import get_ml_user_info # Importa da mesma pasta utils

# Idealmente, estas constantes viriam de um config.py central
# ML_CLIENT_ID = '1931577999730520'
# ML_CLIENT_SECRET = 'jBPhOAkYEUxriV5HFMUa7YYjfMww5xIw'
# ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'
# APP_USER_AGENT = "MeliUnlockerWebApp/1.0"
# ML_USER_INFO_URL = "https://api.mercadolibre.com/users/me"


def exchange_ml_code_for_token(auth_code, redirect_uri, client_id, client_secret, token_url, app_user_agent):
    """Troca o código de autorização do ML por tokens de acesso e refresh."""
    if not auth_code:
        return {"error": True, "message": "Código de autorização não fornecido."}

    payload = {
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'code': auth_code,
        'redirect_uri': redirect_uri
    }
    headers = {'Accept': 'application/json', 'User-Agent': app_user_agent}

    try:
        print(f"OAuth ML: Trocando código por token. redirect_uri usada: {redirect_uri}")
        response = requests.post(token_url, data=payload, headers=headers, timeout=30)
        response.raise_for_status() # Levanta erro para status HTTP ruins
        token_data = response.json()

        access_token = token_data.get('access_token')
        refresh_token = token_data.get('refresh_token')
        expires_in = token_data.get('expires_in', 21600) # 6 horas por padrão
        user_id_ml_from_token = str(token_data.get('user_id')) if token_data.get('user_id') else None

        if not access_token or not refresh_token:
            print(f"OAuth ML: Erro ao obter tokens do ML. Resposta: {token_data}")
            return {"error": True, "message": "Falha ao processar tokens do Mercado Livre."}

        # Obter nickname e seller_id (que é o mesmo user_id_ml para vendedores)
        # Precisamos passar ML_USER_INFO_URL aqui se não for global neste módulo
        # Para este exemplo, vamos assumir que get_ml_user_info pode acessar suas constantes necessárias
        # ou que elas são passadas para ele.
        # Vamos ajustar get_ml_user_info para receber ml_user_info_url e app_user_agent
        from flask import current_app # Acessa o app Flask atual para pegar config
        user_info = get_ml_user_info(access_token, current_app.config['APP_USER_AGENT'], current_app.config['ML_USER_INFO_URL'])

        if not user_info or not user_info.get("nickname") or not user_info.get("id"):
            print(f"OAuth ML: Erro ao obter informações do usuário ML. Resposta: {user_info}")
            return {"error": True, "message": "Não foi possível obter informações da conta Mercado Livre."}

        nickname = user_info["nickname"]
        seller_id = str(user_info["id"]) # Garante que é string

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
        error_message = f"Erro de comunicação com o Mercado Livre ao processar autorização: {e}"
        if hasattr(e, 'response') and e.response is not None:
            error_message += f" - Detalhe API: {e.response.text[:300]}"
        print(error_message)
        return {"error": True, "message": error_message}
    except Exception as e_gen:
        print(f"Erro inesperado no fluxo de token OAuth ML: {e_gen}")
        return {"error": True, "message": f"Ocorreu um erro inesperado: {str(e_gen)}"}