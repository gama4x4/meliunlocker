# DENTRO DE: generate_hash.py (arquivo temporário)

from passlib.hash import sha256_crypt
import getpass

# Pede para você digitar a nova senha de forma segura, sem mostrá-la na tela
nova_senha = getpass.getpass("Digite a sua NOVA senha: ")
confirm_senha = getpass.getpass("Confirme a NOVA senha: ")

if nova_senha != confirm_senha:
    print("\n[ERRO] As senhas não coincidem. Tente novamente.")
elif not nova_senha:
    print("\n[ERRO] A senha não pode ser vazia.")
else:
    # Gera o hash da nova senha
    novo_hash = sha256_crypt.hash(nova_senha)
    
    print("\n--- HASH GERADO COM SUCESSO! ---")
    print("Copie toda a linha abaixo (incluindo as aspas) e cole no seu arquivo 'auth_utils.py'")
    print("\n")
    # Imprime o hash em um formato pronto para ser copiado
    print(f"FIXED_PASSWORD_HASH = '{novo_hash}'")
    print("\n-------------------------------------")