# backend/utils/auth_utils.py
from functools import wraps
from flask import session, redirect, url_for, request
from passlib.hash import sha256_crypt

# Credenciais fixas para o login da aplicação
FIXED_USERNAME = "root@root"
FIXED_PASSWORD_HASH = '$5$rounds=535000$PQfcjLryj3RowncP$dnhFvr4gxwBMgDfBaQkbL87ekb/i19sgAatXpJiVSA1'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in_user' not in session:
            next_url_param = request.url_root.strip('/') + request.full_path
            # CORREÇÃO AQUI: Removido 'auth.'
            return redirect(url_for('login_route', next=next_url_param))
        return f(*args, **kwargs)
    return decorated_function

def verify_user_password(password_form, stored_hash):
    if password_form is None or stored_hash is None:
        return False
    try:
        return sha256_crypt.verify(password_form, stored_hash)
    except Exception as e:
        print(f"Erro durante a verificação de senha: {e}")
        return False