# backend/utils/auth_helpers.py
from functools import wraps
from flask import session, redirect, url_for, request
from passlib.hash import sha256_crypt

FIXED_USERNAME = "root@root"
FIXED_PASSWORD_HASH = "$5$rounds=535000$G0EbaKkOwlgIqEyn$QCH3gaidyrS/7K2ajhcYgFnt/QzjCcLbwOjDLkStcT2" # SEU HASH

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in_user' not in session:
            # Armazena a URL que o usuário tentou acessar para redirecionar após o login
            # Usa request.url_root para obter a base da URL e request.full_path para o caminho completo
            next_url_param = request.url_root.strip('/') + request.full_path
            return redirect(url_for('auth.login_route', next=next_url_param)) # Assume que login_route está em um blueprint 'auth'
        return f(*args, **kwargs)
    return decorated_function

def verify_password(password_form, stored_hash):
    """Verifica a senha fornecida contra o hash armazenado."""
    if password_form is None or stored_hash is None:
        return False
    try:
        return sha256_crypt.verify(password_form, stored_hash)
    except Exception as e:
        print(f"Erro durante a verificação de senha: {e}")
        return False