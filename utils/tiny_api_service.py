# backend/utils/tiny_api_service.py
import requests
import json
from .helpers import strip_html_tags_for_web

# --- Constantes da API Tiny ---
TINY_API_V2_PRODUTO_OBTER_URL = "https://api.tiny.com.br/api2/produto.obter.php"
TINY_API_V2_PRODUTOS_PESQUISA_URL = "https://api.tiny.com.br/api2/produtos.pesquisa.php"
TINY_API_V2_PRODUTO_OBTER_ESTOQUE_URL = "https://api.tiny.com.br/api2/produto.obter.estoque.php"

def _make_tiny_api_request(api_url, params_specific, tiny_api_token):
    # ... (código como na versão anterior, com os prints de debug) ...
    if not tiny_api_token:
        return {"error": True, "status_code": 401, "message": "Token da API v2 do Tiny não está configurado."}

    all_params = {"token": tiny_api_token, "formato": "json", **params_specific}
    request_identifier = params_specific.get('id') or params_specific.get('pesquisa') or 'N/A'
    try:
        print(f"Tiny Request: URL={api_url}, Identifier='{request_identifier}'")
        response = requests.get(api_url, params=all_params, timeout=25)
        print(f"Tiny Response Status for {request_identifier}: {response.status_code}")
        try:
            print(f"Tiny Response Text for {request_identifier} (first 500 chars): {response.text[:500]}")
        except Exception:
            print(f"Tiny Response Text for {request_identifier}: Could not print text.")

        response.raise_for_status()
        data = response.json()

        retorno = data.get("retorno", {})
        status_processamento = retorno.get("status_processamento")
        status_retorno = retorno.get("status")

        if status_processamento == "3" and status_retorno == "OK":
            return {"error": False, "status_code": response.status_code, "data": data}
        elif status_retorno == "ERRO":
            erros_api = retorno.get("erros", [])
            if isinstance(erros_api, list) and erros_api:
                 error_messages = [str(err.get("erro", "Erro Tiny desconhecido") if isinstance(err, dict) else err) for err in erros_api]
                 full_error_message = "; ".join(error_messages)
            elif isinstance(erros_api, dict) and erros_api.get("erro"):
                full_error_message = str(erros_api.get("erro"))
            else:
                full_error_message = f"Erro retornado pela API Tiny: {json.dumps(retorno)}"
            print(f"Tiny API Error Response: {full_error_message}")
            return {"error": True, "status_code": retorno.get("codigo_erro", 400), "message": full_error_message}
        elif api_url == TINY_API_V2_PRODUTOS_PESQUISA_URL and status_retorno == "OK" and not retorno.get("produtos"):
            print(f"Tiny API Pesquisa: Status OK, mas nenhum produto encontrado para '{params_specific.get('pesquisa')}'.")
            return {"error": False, "status_code": response.status_code, "data": data}
        else:
            print(f"Tiny API Warning/Unexpected: StatusProc='{status_processamento}', StatusRet='{status_retorno}', RetornoData='{retorno}'")
            return {"error": True, "status_code": 200, "message": f"Resposta inesperada da API Tiny (StatusProc: {status_processamento}, Status: {status_retorno})."}

    except requests.exceptions.HTTPError as e:
        err_detail = e.response.text[:250] if hasattr(e, 'response') and e.response is not None else str(e)
        status_code_http = e.response.status_code if hasattr(e, 'response') and e.response is not None else 500
        print(f"Tiny HTTP Error: {status_code_http} - {err_detail}")
        return {"error": True, "status_code": status_code_http, "message": f"Erro HTTP API Tiny: {status_code_http} - {err_detail}"}
    except requests.exceptions.RequestException as e:
        print(f"Tiny Request Exception: {e}")
        return {"error": True, "status_code": 503, "message": f"Erro de conexão com API Tiny: {str(e)}"}
    except json.JSONDecodeError:
        resp_text = response.text[:250] if 'response' in locals() and hasattr(response, 'text') else "N/A (sem objeto response)"
        print(f"Tiny JSONDecodeError. Response: {resp_text}")
        return {"error": True, "status_code": 500, "message": f"Resposta da API Tiny não é JSON válido. Início: {resp_text}"}
    except Exception as e_gen:
        print(f"Tiny General Exception em _make_tiny_api_request: {type(e_gen).__name__} - {e_gen}")
        return {"error": True, "status_code": 500, "message": f"Erro geral na comunicação com API Tiny: {str(e_gen)}"}

def get_tiny_product_stock(product_id_tiny, tiny_api_token):
    if not product_id_tiny:
        print("get_tiny_product_stock: ID do produto Tiny não fornecido.")
        return 0
    response_wrapper = _make_tiny_api_request(
        TINY_API_V2_PRODUTO_OBTER_ESTOQUE_URL, {"id": product_id_tiny}, tiny_api_token
    )
    if not response_wrapper["error"]:
        stock_data_retorno = response_wrapper["data"].get("retorno", {})
        if stock_data_retorno.get("status") == "OK":
            produto_estoque_data = stock_data_retorno.get("produto", {})
            saldo = produto_estoque_data.get("saldo")
            if saldo is not None:
                try: return int(float(saldo))
                except (ValueError, TypeError):
                    print(f"Valor de saldo inválido do Tiny para ID {product_id_tiny}: '{saldo}'"); return 0
            else: print(f"Campo 'saldo' não encontrado para ID {product_id_tiny}."); return 0
        else: print(f"API Tiny de estoque não OK para ID {product_id_tiny}. Resp: {stock_data_retorno}"); return 0
    print(f"Erro ao obter estoque para ID Tiny {product_id_tiny}: {response_wrapper.get('message')}"); return 0

def fetch_product_details_from_tiny(sku_input, id_input, tiny_api_token):
    if not tiny_api_token: return {"error_message": "Token API Tiny não fornecido."}
    if not id_input and not sku_input: return {"error_message": "ID ou SKU Tiny são necessários."}

    id_to_fetch_details, product_found_by_search_name = None, None
    if id_input: id_to_fetch_details = id_input
    elif sku_input:
        search_wrapper = _make_tiny_api_request(TINY_API_V2_PRODUTOS_PESQUISA_URL, {"pesquisa": sku_input}, tiny_api_token)
        if search_wrapper["error"]: return {"error_message": f"Pesquisa Tiny: {search_wrapper['message']}"}
        retorno_pesquisa = search_wrapper["data"].get("retorno", {})
        if retorno_pesquisa.get("status") == "OK":
            produtos_list = retorno_pesquisa.get("produtos", [])
            if produtos_list:
                exact = next((p.get("produto") for p in produtos_list if isinstance(p, dict) and isinstance(p.get("produto"), dict) and p.get("produto", {}).get("codigo") == sku_input), None)
                if exact: id_to_fetch_details = exact.get("id")
                else:
                    first = produtos_list[0].get("produto") if isinstance(produtos_list[0], dict) else None
                    if first: id_to_fetch_details = first.get("id"); product_found_by_search_name = first.get("nome")
            else: return {"not_found": True, "message": f"Nenhum produto Tiny para pesquisa: '{sku_input}'"}
        else: return {"error_message": f"Erro pesquisa Tiny: {retorno_pesquisa.get('erros', [{'erro': 'Status não OK'}])[0].get('erro')}"}

    if not id_to_fetch_details: return {"error_message": "ID do produto Tiny não determinado."}

    detail_wrapper = _make_tiny_api_request(TINY_API_V2_PRODUTO_OBTER_URL, {"id": id_to_fetch_details}, tiny_api_token)
    if detail_wrapper["error"]: return {"error_message": f"Detalhes Tiny (ID: {id_to_fetch_details}): {detail_wrapper['message']}"}

    retorno_detalhe = detail_wrapper["data"].get("retorno", {})
    if retorno_detalhe.get("status") == "OK":
        product_details_raw = retorno_detalhe.get("produto")
        if product_details_raw:
            print("-" * 30)
            print(f"DEBUG (tiny_api_service): Dados brutos do produto ID {id_to_fetch_details} ANTES do processamento:")
            print(json.dumps(product_details_raw, indent=2, ensure_ascii=False))
            print("-" * 30)

            stock = get_tiny_product_stock(product_details_raw.get("id"), tiny_api_token)
            desc_plain = strip_html_tags_for_web(product_details_raw.get("descricao_complementar", ""))
            
            dias_prep = product_details_raw.get("dias_preparacao", "")
            retirada_str = product_details_raw.get("retiradaLocal", "N") 
            permite_retirada_bool = True if retirada_str == "S" else False
            
            anexos_raw = product_details_raw.get("anexos", [])
            anexos_formatados = []
            if isinstance(anexos_raw, list):
                for anexo_item in anexos_raw:
                    if isinstance(anexo_item, dict) and anexo_item.get("anexo"):
                        anexos_formatados.append({"anexo": anexo_item["anexo"]})
            
            def get_f_or_def(val_str, default=0.0):
                if val_str is None or str(val_str).strip() == "": return default
                try: return float(val_str)
                except: return default

            processed_product = {
                "id_tiny": product_details_raw.get("id"),
                "nome_tiny": product_details_raw.get("nome", ""),
                "codigo_tiny": product_details_raw.get("codigo", ""),
                "preco_venda_tiny": get_f_or_def(product_details_raw.get("preco")),
                "preco_promocional_tiny": get_f_or_def(product_details_raw.get("preco_promocional")),
                "estoque_tiny": stock,
                "unidade_tiny": product_details_raw.get("unidade", ""),
                "gtin_tiny": product_details_raw.get("gtin", product_details_raw.get("codigo_barras", "")),
                "marca_tiny": product_details_raw.get("marca", ""),
                "modelo_tiny": product_details_raw.get("modelo", ""),
                # CORREÇÃO AQUI:
                "linha_tiny": product_details_raw.get("linhaProduto", product_details_raw.get("linha", "")),
                "descricao_complementar_tiny": desc_plain,
                "peso_bruto_tiny": get_f_or_def(product_details_raw.get("peso_bruto")),
                "altura_embalagem_tiny": get_f_or_def(product_details_raw.get("alturaEmbalagem")),
                "largura_embalagem_tiny": get_f_or_def(product_details_raw.get("larguraEmbalagem")),
                "comprimento_embalagem_tiny": get_f_or_def(product_details_raw.get("comprimentoEmbalagem")),
                "anexos_tiny": anexos_formatados,
                "dias_preparacao_tiny": str(dias_prep) if dias_prep is not None else "",
                "permite_retirada_tiny": permite_retirada_bool,
                "product_found_by_search_name": product_found_by_search_name
            }
            print(f"DEBUG (tiny_api_service): Dados processados do Tiny para enviar ao frontend:\n{json.dumps(processed_product, indent=2, ensure_ascii=False)}")
            return {"product_data": processed_product}
        else:
            return {"error_message": f"Produto com ID '{id_to_fetch_details}' não encontrado na resposta de detalhes do Tiny (corpo do produto ausente)."}
    else:
        error_msg_detail = retorno_detalhe.get('erros', [{'erro':"Status da obtenção de detalhes Tiny não foi OK."}])[0].get('erro')
        return {"error_message": f"Erro na resposta ao obter detalhes do produto Tiny (ID: {id_to_fetch_details}): {error_msg_detail}"}