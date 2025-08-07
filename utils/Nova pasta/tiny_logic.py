# backend/utils/tiny_logic.py
import requests
import json
import html
import re

# --- Constantes da API Tiny ---
TINY_API_V2_PRODUTO_OBTER_URL = "https://api.tiny.com.br/api2/produto.obter.php"
TINY_API_V2_PRODUTOS_PESQUISA_URL = "https://api.tiny.com.br/api2/produtos.pesquisa.php"
TINY_API_V2_PRODUTO_OBTER_ESTOQUE_URL = "https://api.tiny.com.br/api2/produto.obter.estoque.php"

# --- Função Auxiliar para Remover HTML ---
def strip_html_tags_for_web(text_html):
    # (COLE AQUI A FUNÇÃO strip_html_tags_for_web COMPLETA DA RESPOSTA ANTERIOR)
    # ... (a que começa com "if not text_html:" e termina com "return plain_text.strip()")
    if not text_html: return ""
    try: processed_text = html.unescape(str(text_html))
    except Exception as e: print(f"Erro html.unescape: {e}."); processed_text = str(text_html)
    processed_text = re.sub(r'<br\s*/?>', '\n', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'</p\s*>', '\n\n', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'<p\s*[^>]*>', '', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'<[^>]+>', '', processed_text)
    lines = processed_text.split('\n'); cleaned_lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in lines]
    temp_text = "\n".join(line for line in cleaned_lines if line or (len(cleaned_lines) > 1 and cleaned_lines.index(line) > 0 and cleaned_lines[cleaned_lines.index(line)-1]))
    plain_text = re.sub(r'\n{3,}', '\n\n', temp_text)
    return plain_text.strip()


def _make_tiny_api_v2_request_logic(api_url, params_specific, tiny_api_token):
    # (COLE AQUI A FUNÇÃO _make_tiny_api_v2_request_logic COMPLETA DA RESPOSTA ANTERIOR)
    if not tiny_api_token: return {"error": True, "status_code": 401, "message": "Token Tiny não configurado."}
    all_params = {"token": tiny_api_token, "formato": "json", **params_specific}
    try:
        print(f"Tiny Req: URL={api_url}, ParamsVal={params_specific.get('id') or params_specific.get('pesquisa') or 'N/A'}")
        response = requests.get(api_url, params=all_params, timeout=20); response.raise_for_status(); data = response.json()
        if data.get("retorno", {}).get("status_processamento") == "3" and data.get("retorno", {}).get("status") == "OK": return {"error": False, "status_code": response.status_code, "data": data}
        elif data.get("retorno", {}).get("status") == "ERRO":
            erros_api = data.get("retorno", {}).get("erros", []); msg = "; ".join([str(err.get("erro", "Erro Tiny") if isinstance(err, dict) else err) for err in (erros_api if isinstance(erros_api, list) else [erros_api])]) or "Erro API Tiny."; print(f"Tiny API Error: {msg}"); return {"error": True, "status_code": data.get("retorno",{}).get("codigo_erro", 400), "message": msg}
        else: status_proc = data.get("retorno", {}).get("status_processamento"); status_ret = data.get("retorno", {}).get("status"); print(f"Tiny Warn: StatusProc={status_proc}, StatusRet={status_ret}"); return {"error": True, "status_code": 200, "message": f"Resposta inesperada Tiny (Proc: {status_proc}, Ret: {status_ret})."}
    except requests.exceptions.HTTPError as e: err_detail = e.response.text[:250] if e.response else str(e); print(f"Tiny HTTP Err: {e.response.status_code if e.response else 'N/A'} - {err_detail}"); return {"error": True, "status_code": e.response.status_code if e.response else 500, "message": f"Erro HTTP Tiny: {e.response.status_code if e.response else 'N/A'} - {err_detail}"}
    except requests.exceptions.RequestException as e: print(f"Tiny Req Except: {e}"); return {"error": True, "status_code": 503, "message": f"Erro conexão Tiny: {e}"}
    except json.JSONDecodeError: print(f"Tiny JSONErr. Resp: {response.text[:250] if 'response' in locals() else 'N/A'}"); return {"error": True, "status_code": 500, "message": "Resposta Tiny não JSON."}
    except Exception as e_gen: print(f"Tiny Gen Except: {e_gen}"); return {"error": True, "status_code": 500, "message": f"Erro geral Tiny: {e_gen}"}

def get_tiny_product_stock_logic(product_id_tiny, tiny_api_token):
    # (COLE AQUI A FUNÇÃO get_tiny_product_stock_logic COMPLETA DA RESPOSTA ANTERIOR)
    if not product_id_tiny: return 0
    response_stock_wrapper = _make_tiny_api_v2_request_logic(TINY_API_V2_PRODUTO_OBTER_ESTOQUE_URL, {"id": product_id_tiny}, tiny_api_token)
    if not response_stock_wrapper["error"]:
        stock_data = response_stock_wrapper["data"]
        if stock_data.get("retorno", {}).get("status_processamento") == "3":
            produto_estoque_data = stock_data.get("retorno", {}).get("produto", {}); saldo = produto_estoque_data.get("saldo")
            if saldo is not None:
                try: return int(float(saldo))
                except: print(f"Saldo inválido Tiny ID {product_id_tiny}: {saldo}")
    print(f"Estoque não obtido Tiny ID {product_id_tiny}: {response_stock_wrapper.get('message')}")
    return 0

def fetch_tiny_product_details_logic(sku_input, id_input, tiny_api_token):
    # (COLE AQUI A FUNÇÃO fetch_tiny_product_details_logic COMPLETA DA RESPOSTA ANTERIOR,
    #  CERTIFICANDO-SE QUE USA OS NOMES CORRIGIDOS DOS CAMPOS CAMELCASE PARA DIMENSÕES/PESO/ETC.)
    if not tiny_api_token: return {"error_message": "Token API Tiny não fornecido."}
    if not id_input and not sku_input: return {"error_message": "ID ou SKU Tiny são necessários."}
    id_to_fetch_details = None; product_found_by_search_name = None
    if id_input: id_to_fetch_details = id_input
    elif sku_input:
        search_params = {"pesquisa": sku_input}; search_response_wrapper = _make_tiny_api_v2_request_logic(TINY_API_V2_PRODUTOS_PESQUISA_URL, search_params, tiny_api_token)
        if search_response_wrapper["error"]: return {"error_message": f"Erro pesquisa Tiny: {search_response_wrapper['message']}"}
        search_data_retorno = search_response_wrapper["data"].get("retorno", {})
        if search_data_retorno.get("status_processamento") == "3":
            found_products_list = search_data_retorno.get("produtos", [])
            if found_products_list:
                exact_match_product = next((p.get("produto") for p in found_products_list if p.get("produto", {}).get("codigo") == sku_input), None)
                if exact_match_product: id_to_fetch_details = exact_match_product.get("id")
                else: first_product = found_products_list[0].get("produto", {}); id_to_fetch_details = first_product.get("id"); product_found_by_search_name = first_product.get("nome", "Desconhecido")
            else: return {"not_found": True, "message": f"Nenhum produto Tiny para: '{sku_input}'"}
        else: return {"error_message": f"Erro pesquisa Tiny: {search_data_retorno.get('erros') or 'Status proc. inválido'}"}
    if not id_to_fetch_details: return {"error_message": "ID do produto Tiny não determinado."}
    detail_params = {"id": id_to_fetch_details}; detail_response_wrapper = _make_tiny_api_v2_request_logic(TINY_API_V2_PRODUTO_OBTER_URL, detail_params, tiny_api_token)
    if detail_response_wrapper["error"]: return {"error_message": f"Erro detalhes Tiny (ID: {id_to_fetch_details}): {detail_response_wrapper['message']}"}
    detail_data_retorno = detail_response_wrapper["data"].get("retorno", {})
    if detail_data_retorno.get("status_processamento") == "3":
        product_details_raw = detail_data_retorno.get("produto")
        if product_details_raw:
            stock_value = get_tiny_product_stock_logic(product_details_raw.get("id"), tiny_api_token)
            descricao_plain_text = strip_html_tags_for_web(product_details_raw.get("descricaoComplementar", "")) # camelCase
            dias_preparacao_tiny = product_details_raw.get("diasPreparacao", product_details_raw.get("dias_expedicao", ""))
            permite_retirada_tiny_str = product_details_raw.get("permiteRetirada", product_details_raw.get("retiradaLocal", "N"))
            permite_retirada_tiny = True if permite_retirada_tiny_str == "S" else False
            processed_product = {
                "id_tiny": product_details_raw.get("id"), "nome_tiny": product_details_raw.get("nome", ""), "codigo_tiny": product_details_raw.get("codigo", ""),
                "preco_venda_tiny": product_details_raw.get("preco"), "preco_promocional_tiny": product_details_raw.get("precoPromocional"),
                "estoque_tiny": stock_value, "unidade_tiny": product_details_raw.get("unidade", ""), "gtin_tiny": product_details_raw.get("gtin", ""),
                "marca_tiny": product_details_raw.get("marca", ""), "modelo_tiny": product_details_raw.get("modelo", ""),
                "descricao_complementar_tiny": descricao_plain_text,
                "peso_bruto_tiny": product_details_raw.get("pesoBruto", 0.0), "altura_embalagem_tiny": product_details_raw.get("alturaEmbalagem", 0.0),
                "largura_embalagem_tiny": product_details_raw.get("larguraEmbalagem", 0.0), "comprimento_embalagem_tiny": product_details_raw.get("comprimentoEmbalagem", 0.0),
                "anexos_tiny": product_details_raw.get("anexos", []), "dias_preparacao_tiny": str(dias_preparacao_tiny),
                "permite_retirada_tiny": permite_retirada_tiny, "product_found_by_search_name": product_found_by_search_name}
            return {"product_data": processed_product}
        else: return {"error_message": f"Produto ID '{id_to_fetch_details}' não encontrado (detalhes Tiny)."}
    else: return {"error_message": f"Erro detalhes Tiny (ID: {id_to_fetch_details}): {detail_data_retorno.get('erros') or 'Status proc. inválido'}"}