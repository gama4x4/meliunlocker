# backend/utils/config_manager.py
import os
import json
import time

# Ajuste para garantir que o diretório 'config' seja criado DENTRO da pasta 'backend'
# se esta estrutura for desejada, ou um nível acima se 'config' for na raiz do projeto.
# Assumindo que 'config' está no mesmo nível que 'app.py' (dentro de 'backend').
CONFIG_DIR_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config')
os.makedirs(CONFIG_DIR_PATH, exist_ok=True) # Cria o diretório se não existir

APP_CONFIG_FILE = os.path.join(CONFIG_DIR_PATH, 'app_config.json')
ACCOUNTS_FILE = os.path.join(CONFIG_DIR_PATH, 'ml_accounts.json')


def _init_default_file(filepath, default_content_generator):
    """Cria um arquivo com conteúdo padrão se ele não existir."""
    if not os.path.exists(filepath):
        print(f"Arquivo {filepath} não encontrado. Criando com conteúdo padrão.")
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(default_content_generator(), f, indent=2)
        except IOError as e:
            print(f"Erro ao criar arquivo padrão {filepath}: {e}")


def get_default_app_config():
    return {
        'tiny_api_v2_token': '',
        'removebg_api_key': '',
        'imgur_client_id': '',
        'chatgpt_api_key': '',
        'removebg_credits_used_month': 0,
        'removebg_last_reset_month_year': time.strftime("%m-%Y")
    }

def get_default_ml_accounts():
    return {}

# Inicializa os arquivos se não existirem ao carregar o módulo
_init_default_file(APP_CONFIG_FILE, get_default_app_config)
_init_default_file(ACCOUNTS_FILE, get_default_ml_accounts)


def load_app_config():
    """Carrega app_config.json do servidor."""
    try:
        with open(APP_CONFIG_FILE, 'r', encoding='utf-8') as f:
            config_from_file = json.load(f)
            # Garante que todas as chaves default existam e adiciona se faltar
            default_conf = get_default_app_config()
            updated = False
            for key, value in default_conf.items():
                if key not in config_from_file:
                    config_from_file[key] = value
                    updated = True
            if updated:
                save_app_config(config_from_file) # Salva se adicionou chaves default
            return config_from_file
    except (IOError, json.JSONDecodeError) as e:
        print(f"Erro ao carregar {APP_CONFIG_FILE}: {e}. Recriando com defaults.")
        default_config = get_default_app_config()
        save_app_config(default_config)
        return default_config

def save_app_config(config_data):
    """Salva app_config.json no servidor."""
    try:
        with open(APP_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2)
        print(f"Configuração da aplicação salva em {APP_CONFIG_FILE}")
    except IOError as e:
        print(f"Erro ao salvar configuração da aplicação em {APP_CONFIG_FILE}: {e}")

def load_ml_accounts():
    """Carrega ml_accounts.json do servidor."""
    try:
        with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError) as e:
        print(f"Erro ao carregar {ACCOUNTS_FILE}: {e}. Retornando dicionário vazio e recriando arquivo.")
        default_accounts = get_default_ml_accounts()
        save_ml_accounts(default_accounts) # Recria o arquivo se estiver corrompido
        return default_accounts


def save_ml_accounts(accounts_data):
    """Salva ml_accounts.json no servidor."""
    try:
        with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(accounts_data, f, indent=2)
        print(f"Contas Mercado Livre salvas em {ACCOUNTS_FILE}")
    except IOError as e:
        print(f"Erro ao salvar contas Mercado Livre em {ACCOUNTS_FILE}: {e}")