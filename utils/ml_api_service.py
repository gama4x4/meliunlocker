# backend/utils/ml_api_service.py
import requests
import time
import json
from flask import current_app

def get_ml_category_suggestion_logic(title, access_token):
    if not title:
        return {"error": True, "message": "Título é obrigatório para sugestão de categoria."} # Erro da nossa app
    if not access_token:
        return {"error": True, "message": "Token de acesso ML não fornecido."} # Erro da nossa app

    sites_url = current_app.config.get('ML_SITES_URL', "https://api.mercadolibre.com/sites")
    site_id = current_app.config.get('ML_SITE_ID', "MLB")
    app_user_agent = current_app.config.get('APP_USER_AGENT')
    url = f"{sites_url}/{site_id}/category_predictor/predict"
    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent}
    params = {'title': title, 'limit': 1}

    try:
        print(f"ML_API_SERVICE (Suggest): Chamando URL: {url} com params: {params}")
        response = requests.get(url, headers=headers, params=params, timeout=10)
        print(f"ML_API_SERVICE (Suggest): Status da API ML: {response.status_code}")

        if response.status_code == 200:
            prediction = response.json()
            if prediction and prediction.get("id"):
                return {
                    "error": False, # Indica sucesso da nossa perspectiva
                    "category_id": prediction["id"],
                    "category_name": prediction["name"],
                    "path_from_root": prediction.get("path_from_root", [])
                }
            else:
                # API retornou 200 mas sem sugestão válida
                return {"error": False, "message": "Nenhuma sugestão de categoria encontrada pelo preditor do ML."}
        elif response.status_code == 404:
            # API do ML não encontrou nada para o título
            return {"error": False, "message": f"Nenhuma sugestão de categoria para o título (API ML: 404)."}
        else:
            # Outros erros HTTP da API ML
            response.raise_for_status() # Deixa outros erros serem capturados abaixo
            return {"error": True, "message": "Resposta inesperada do preditor de categoria ML."} # Fallback

    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:150] if hasattr(e_http, 'response') and e_http.response else str(e_http)
        status_code = e_http.response.status_code if hasattr(e_http, 'response') and e_http.response else 500
        print(f"ML_API_SERVICE (Suggest): Erro HTTP {status_code} da API ML - {err_detail}")
        return {"error": True, "message": f"Erro da API ML ao sugerir categoria ({status_code}): {err_detail}"}
    except requests.exceptions.RequestException as e:
        print(f"ML_API_SERVICE (Suggest): Erro de rede - {str(e)}")
        return {"error": True, "message": f"Erro de rede ao buscar sugestão de categoria ML: {str(e)}"}
    except Exception as e_gen:
        print(f"ML_API_SERVICE (Suggest): Erro inesperado - {str(e_gen)}")
        return {"error": True, "message": f"Erro inesperado na sugestão de categoria ML: {str(e_gen)}"}


def get_ml_categories_logic(access_token, category_id=None):
    # ... (esta função parecia estar ok, mas adicione logs similares se precisar depurar) ...
    if not access_token:
        return {"error": True, "message": "Token de acesso ML não fornecido."}
    sites_url = current_app.config.get('ML_SITES_URL', "https://api.mercadolibre.com/sites")
    site_id = current_app.config.get('ML_SITE_ID', "MLB")
    app_user_agent = current_app.config.get('APP_USER_AGENT')
    if category_id:
        url = f"https://api.mercadolibre.com/categories/{category_id}"
    else:
        url = f"{sites_url}/{site_id}/categories"
    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent}
    try:
        print(f"ML_API_SERVICE (GetCategories): Chamando URL: {url}")
        response = requests.get(url, headers=headers, timeout=10)
        print(f"ML_API_SERVICE (GetCategories): Status da API ML: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        categories_to_return = data.get("children_categories", []) if category_id else data
        if not isinstance(categories_to_return, list):
            categories_to_return = [] if categories_to_return is None else [categories_to_return]
        return {"error": False, "categories": categories_to_return}
    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:150] if hasattr(e_http, 'response') and e_http.response else str(e_http)
        status_code = e_http.response.status_code if hasattr(e_http, 'response') and e_http.response else 500
        print(f"ML_API_SERVICE (GetCategories): Erro HTTP {status_code} da API ML - {err_detail}")
        return {"error": True, "message": f"Erro da API ML ao buscar categorias ({status_code}): {err_detail}"}
    except Exception as e:
        print(f"ML_API_SERVICE (GetCategories): Erro - {str(e)}")
        return {"error": True, "message": f"Erro ao buscar categorias ML ({url}): {str(e)}"}


def search_ml_categories_logic(query, access_token):
    if not query or len(query) < 3:
        return {"error": True, "message": "Termo de busca deve ter pelo menos 3 caracteres."}
    if not access_token:
        return {"error": True, "message": "Token de acesso ML não fornecido."}

    site_id = current_app.config.get('ML_SITE_ID', "MLB")
    app_user_agent = current_app.config.get('APP_USER_AGENT')
    url = f"https://api.mercadolibre.com/sites/{site_id}/category_discovery/search"
    params = {'q': query, 'limit': 30}
    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent}
    try:
        print(f"ML_API_SERVICE (SearchCategories): Chamando URL: {url} com params: {params}")
        response = requests.get(url, headers=headers, params=params, timeout=15)
        print(f"ML_API_SERVICE (SearchCategories): Status da API ML: {response.status_code}")
        # Tratar 403 especificamente ou deixar raise_for_status pegar
        if response.status_code == 403:
             print(f"ML_API_SERVICE (SearchCategories): API ML retornou 403 Forbidden. Verificar token/escopos.")
             return {"error": True, "message": "Acesso negado pela API do Mercado Livre para busca de categorias (403). Verifique as permissões do token."}
        response.raise_for_status()
        search_results_raw = response.json()
        # ... (resto da lógica de formatação dos resultados como antes) ...
        formatted_results = []
        if isinstance(search_results_raw, list):
            for item_raw in search_results_raw:
                if isinstance(item_raw, dict):
                    formatted_item = {
                        "id": item_raw.get("category_id"),
                        "name": item_raw.get("name"),
                        "path_from_root": item_raw.get("path_from_root", []),
                        "settings": {"leaf": item_raw.get("is_leaf", False)}
                    }
                    if formatted_item["id"] and formatted_item["name"]:
                         formatted_results.append(formatted_item)
        return {"error": False, "results": formatted_results}
    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:250] if hasattr(e_http, 'response') and e_http.response else str(e_http)
        status_code = e_http.response.status_code if hasattr(e_http, 'response') and e_http.response else 500
        print(f"ML_API_SERVICE (SearchCategories): Erro HTTP {status_code} da API ML - {err_detail}")
        return {"error": True, "message": f"Erro HTTP ({status_code}) na busca de categorias ML: {err_detail}"}
    except Exception as e:
        print(f"ML_API_SERVICE (SearchCategories): Erro - {str(e)}")
        return {"error": True, "message": f"Erro na busca de categorias ML: {str(e)}"}

# ... (get_ml_category_attributes_logic e check_sku_on_ml_account_logic como antes, mas adicione logs se necessário) ...
def get_ml_category_attributes_logic(category_id, access_token):
    if not category_id or not access_token:
        return {"error_message": "ID da categoria ou token de acesso ausente para buscar atributos."}
    ml_attributes_url_template = current_app.config['ML_CATEGORY_ATTRIBUTES_URL_TEMPLATE']
    app_user_agent = current_app.config['APP_USER_AGENT']
    url = ml_attributes_url_template.format(cat_id=category_id)
    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent}
    try:
        print(f"ML_API_SERVICE (GetAttributes): Chamando URL: {url}")
        response = requests.get(url, headers=headers, timeout=15)
        print(f"ML_API_SERVICE (GetAttributes): Status da API ML: {response.status_code}")
        response.raise_for_status()
        attributes_data = response.json()
        print(f"DEBUG ML_API_SERVICE - Atributos BRUTOS da API ML para {category_id}: {json.dumps(attributes_data, indent=2, ensure_ascii=False)}")
        if not isinstance(attributes_data, list):
            print(f"ML_API_SERVICE - AVISO: Resposta de atributos para {category_id} NÃO é uma lista. Tipo: {type(attributes_data)}")
            return {"error_message": "Resposta da API de atributos ML não é uma lista.", "attributes": []}
        return {"error": False, "attributes": attributes_data}
        return {"error": False, "attributes": attributes_data}
    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:150] if hasattr(e_http, 'response') and e_http.response else str(e_http)
        status_code = e_http.response.status_code if hasattr(e_http, 'response') and e_http.response else 500
        print(f"ML_API_SERVICE (GetAttributes): Erro HTTP {status_code} - {err_detail}")
        return {"error_message": f"Erro HTTP atributos ML ({status_code}): {err_detail}", "attributes": []}
    except Exception as e:
        print(f"ML_API_SERVICE (GetAttributes): Erro - {str(e)}")
        return {"error_message": f"Erro ao buscar atributos ML: {str(e)}", "attributes": []}


def check_sku_on_ml_account_logic(sku_to_check, access_token, seller_id):
    # ... (código como na sua última versão) ...
    if not sku_to_check or not access_token or not seller_id:
        return {"error": True, "message": "Dados insuficientes para verificar SKU (SKU, token ou seller_id ausente)."} # Mudado para error:True

    search_url = f"https://api.mercadolibre.com/users/{seller_id}/items/search"
    params_sku = {'seller_sku': sku_to_check, 'status': 'active,paused', 'limit': 50} 
    headers_ml = {'Authorization': f'Bearer {access_token}', 'User-Agent': current_app.config['APP_USER_AGENT']}
    found_items_for_account = []

    try:
        print(f"  ML SKU Check Logic: Buscando SKU '{sku_to_check}' para vendedor '{seller_id}'")
        response = requests.get(search_url, headers=headers_ml, params=params_sku, timeout=20)
        response.raise_for_status()
        search_data = response.json()
        item_ids_found_initial = search_data.get("results", [])
        print(f"    ML SKU Check Logic: IDs da busca inicial por seller_sku: {item_ids_found_initial}")

        if item_ids_found_initial:
            ids_to_fetch_details = item_ids_found_initial[:20] 
            if ids_to_fetch_details:
                multiget_url = f"https://api.mercadolibre.com/items"
                multiget_params = {
                    'ids': ",".join(ids_to_fetch_details),
                    'attributes': 'id,title,permalink,listing_type_id,status,price,seller_custom_field,attributes,sold_quantity'
                }
                mg_response = requests.get(multiget_url, headers=headers_ml, params=multiget_params, timeout=25)
                mg_response.raise_for_status()
                mg_data = mg_response.json()

                for item_result_wrapper in mg_data:
                    if isinstance(item_result_wrapper, dict) and item_result_wrapper.get('code') == 200:
                        item_body = item_result_wrapper.get('body', {})
                        if not item_body: continue
                        item_seller_sku_attr_val = None
                        attributes_list_check = item_body.get('attributes', [])
                        for attr_check in attributes_list_check:
                            if attr_check.get('id') == 'SELLER_SKU':
                                item_seller_sku_attr_val = attr_check.get('value_name'); break
                        item_custom_field_val = item_body.get('seller_custom_field')
                        sku_matches_exactly = False
                        if item_seller_sku_attr_val and sku_to_check.strip().lower() == item_seller_sku_attr_val.strip().lower():
                            sku_matches_exactly = True
                        elif not item_seller_sku_attr_val and item_custom_field_val and sku_to_check.strip().lower() == item_custom_field_val.strip().lower():
                            sku_matches_exactly = True
                        
                        if sku_matches_exactly:
                            found_items_for_account.append({
                                "id": item_body.get("id"), "title": item_body.get("title", "N/A")[:70],
                                "permalink": item_body.get("permalink"), "status": item_body.get("status"),
                                "listing_type_id": item_body.get("listing_type_id"), "price": item_body.get("price"),
                                "sold_quantity": item_body.get("sold_quantity", 0)
                            })
        return {"error": False, "found": bool(found_items_for_account), "items": found_items_for_account}
    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:100] if hasattr(e_http,'response') and e_http.response else str(e_http)
        status_code = e_http.response.status_code if hasattr(e_http,'response') and e_http.response else 500
        return {"error": True, "found": False, "items": [], "message": f"Erro HTTP {status_code} ao verificar SKU: {err_detail}"}
    except requests.exceptions.RequestException as e_req:
        return {"error": True, "found": False, "items": [], "message": f"Erro de rede ao verificar SKU: {str(e_req)[:100]}"}
    except Exception as e_gen:
        return {"error": True, "found": False, "items": [], "message": f"Erro inesperado ao verificar SKU: {str(e_gen)[:100]}"}