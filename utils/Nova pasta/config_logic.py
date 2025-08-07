# backend/utils/config_logic.py
import os
import json
import time

BASE_DIR_CONFIG = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'config'))
APP_CONFIG_FILE = os.path.join(BASE_DIR_CONFIG, 'app_config.json')
ACCOUNTS_FILE = os.path.join(BASE_DIR_CONFIG, 'ml_accounts.json')

# Garante que o diretório de configuração existe ao carregar o módulo
os.makedirs(BASE_DIR_CONFIG, exist_ok=True)

def load_app_config_from_file():
    """Carrega app_config.json do servidor."""
    default_config = {
        'tiny_api_v2_token': '',
        'removebg_api_key': '',
        'imgur_client_id': '',
        'chatgpt_api_key': '',
        'removebg_credits_used_month': 0,
        'removebg_last_reset_month_year': time.strftime("%m-%Y")
    }
    if os.path.exists(APP_CONFIG_FILE):
        try:
            with open(APP_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # Garante que todas as chaves default existam no arquivo carregado
                for key, value in default_config.items():
                    config.setdefault(key, value)
                return config
        except (IOError, json.JSONDecodeError) as e:
            print(f"Erro ao carregar {APP_CONFIG_FILE}: {e}. Usando/recriando com defaults.")
    # Se o arquivo não existe ou está corrompido, cria/recria com defaults
    save_app_config_to_file(default_config)
    return default_config

def save_app_config_to_file(config_data):
    """Salva app_config.json no servidor."""
    try:
        with open(APP_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2)
        print(f"Configuração da aplicação salva em {APP_CONFIG_FILE}")
    except IOError as e:
        print(f"Erro ao salvar configuração da aplicação em {APP_CONFIG_FILE}: {e}")

def load_ml_accounts_from_file():
    """Carrega ml_accounts.json do servidor."""
    if os.path.exists(ACCOUNTS_FILE):
        try:
            with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (IOError, json.JSONDecodeError) as e:
            print(f"Erro ao carregar {ACCOUNTS_FILE}: {e}. Retornando dicionário vazio.")
            return {}
    return {}

def save_ml_accounts_to_file(accounts_data):
    """Salva ml_accounts.json no servidor."""
    try:
        with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(accounts_data, f, indent=2)
        print(f"Contas Mercado Livre salvas em {ACCOUNTS_FILE}")
    except IOError as e:
        print(f"Erro ao salvar contas Mercado Livre em {ACCOUNTS_FILE}: {e}")