# backend/utils/ml_logic.py
import requests
import json
from openai import OpenAI # Mova para cá se for usar apenas aqui

# Supondo que estas constantes são passadas ou acessadas via current_app.config
# ML_SITES_URL, ML_SITE_ID, APP_USER_AGENT, CHATGPT_MODEL_NAME_APP

def get_ml_category_attributes_logic(category_id, access_token, ml_attributes_url_template, app_user_agent):
    if not category_id or not access_token:
        return {"error_message": "ID da categoria ou token de acesso ausente para buscar atributos."}
    url = ml_attributes_url_template.format(cat_id=category_id) # Ex: https://api.mercadolibre.com/categories/{cat_id}/attributes
    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        attributes_data = response.json()
        if not isinstance(attributes_data, list):
            return {"error_message": "Resposta da API de atributos ML não é uma lista."}
        return {"attributes": attributes_data}
    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:150] if e_http.response else str(e_http)
        return {"error_message": f"Erro HTTP atributos ML ({e_http.response.status_code if e_http.response else 'N/A'}): {err_detail}"}
    except Exception as e:
        return {"error_message": f"Erro ao buscar atributos ML: {str(e)}"}

def generate_description_with_chatgpt_logic(title, current_description, api_key_openai, model_name):
    if not api_key_openai: return {"error_message": "Chave API OpenAI não fornecida."}
    if not title: return {"error_message": "Título do produto necessário."}
    try:
        client = OpenAI(api_key=api_key_openai)
        system_message = "Você é um especialista em copywriting para e-commerce, focado em criar descrições que vendem para anúncios no Mercado Livre."
        user_message_content = f"""
        Título do Produto: "{title}"
        Descrição Atual (pode ser vazia ou HTML): "{current_description}"
        Tarefa:
        1. Analise o título e a descrição atual.
        2. Crie uma nova descrição de produto otimizada para vendas no Mercado Livre em HTML SIMPLES.
        3. Use SOMENTE as tags: <p>, <br>, <b>, <i>, <ul>, <li> (máximo 2 níveis de <ul>).
        4. Destaque benefícios e características. Linguagem clara e vendedora.
        5. NÃO inclua <html>, <head>, <body>. Apenas o conteúdo HTML da descrição.
        6. Se a descrição atual for boa, refine-a e formate adequadamente.
        Nova Descrição em HTML:
        """
        completion = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": system_message}, {"role": "user", "content": user_message_content}],
            temperature=0.7,
        )
        enhanced_description_html = completion.choices[0].message.content.strip() if completion.choices and completion.choices[0].message else ""
        if enhanced_description_html:
            return {"new_description_html": enhanced_description_html}
        else:
            return {"error_message": "ChatGPT não retornou uma descrição válida."}
    except Exception as e:
        return {"error_message": f"Erro ao chamar API do ChatGPT: {str(e)}"}