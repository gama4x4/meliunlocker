# backend/utils/pricing_logic.py
import requests
import time # Para possível refresh de token dentro desta lógica
from flask import current_app # Para acessar app.config com constantes ML

# Importar helpers de API ML se o refresh de token for feito aqui
# ou assumir que o token passado já está válido.
# Para simplificar, vamos assumir que o token passado para as funções de cálculo
# já foi validado/refrescado pelo endpoint no app.py.
from .ml_api_helpers import get_ml_user_info, refresh_ml_token # Para garantir que temos seller_id e token válido

# Função para buscar taxas do ML (adaptada do seu código Tkinter)
def get_ml_api_fees_for_type_logic(category_id, sell_price, listing_type_id, access_token):
    """Busca as taxas de venda do Mercado Livre para um tipo de anúncio e preço."""
    if not all([category_id, listing_type_id, access_token]):
        print("Pricing Logic (get_fees): Parâmetros ausentes.")
        return 0.19, 6.00, (sell_price * 0.19) + 6.00 # Fallback MUITO genérico se falhar

    # Constantes que viriam do app.config
    ml_site_listing_prices_url = f"https://api.mercadolibre.com/sites/{current_app.config['ML_SITE_ID']}/listing_prices"
    app_user_agent = current_app.config['APP_USER_AGENT']
    ml_site_id_const = current_app.config['ML_SITE_ID']


    params = {
        "category_id": category_id,
        "price": round(float(sell_price), 2),
        "listing_type_id": listing_type_id
    }
    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': app_user_agent, 'Accept': 'application/json'}
    
    fee_rate_api, fixed_fee_api, sale_fee_total_from_api = 0.0, 0.0, 0.0
    print(f"Pricing Logic (get_fees): Buscando taxas para Cat:{category_id}, Preço:{sell_price}, Tipo:{listing_type_id}")

    try:
        response = requests.get(ml_site_listing_prices_url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        pricing_info = None
        if isinstance(data, list) and data:
            # A API pode retornar múltiplas entradas se o preço estiver na fronteira de uma regra.
            # Procuramos a que corresponde ao listing_type_id exato.
            pricing_info = next((item for item in data if item.get("listing_type_id") == listing_type_id), None)
            if not pricing_info: pricing_info = data[0] # Fallback para o primeiro se não achar exato
        elif isinstance(data, dict): # Às vezes retorna um objeto único
            pricing_info = data

        if pricing_info:
            sale_fee_total_from_api = float(pricing_info.get("sale_fee_amount", 0.0))
            details = pricing_info.get("sale_fee_details")
            if details and isinstance(details, dict): # Ajustado para verificar se é dict
                fee_rate_api = float(details.get("percentage_fee", 0.0)) / 100.0
                fixed_fee_api = float(details.get("fixed_fee", 0.0))
            
            # Lógica de taxa fixa para MLB (Brasil)
            if fixed_fee_api == 0.0 and ml_site_id_const == "MLB" and \
               float(sell_price) < 79.00 and listing_type_id in ['gold_special', 'gold_pro']:
                fixed_fee_api = 6.00 # Taxa fixa padrão do ML Brasil para itens < R$79

            # Tenta inferir a taxa percentual se a API não a retornou claramente mas retornou a taxa total
            if fee_rate_api == 0.0 and float(sell_price) > 0 and sale_fee_total_from_api > fixed_fee_api:
                fee_rate_api = (sale_fee_total_from_api - fixed_fee_api) / float(sell_price)
            
            print(f"  Pricing Logic (get_fees): Retornado da API -> Rate:{fee_rate_api:.4f}, Fixed:{fixed_fee_api:.2f}, TotalFeeAPI:{sale_fee_total_from_api:.2f}")
        else:
            print(f"  Pricing Logic (get_fees): Nenhuma informação de preço encontrada para os parâmetros.")
            # Fallback para taxas altas se a API falhar em retornar dados
            fee_rate_api = 0.19 if listing_type_id == 'gold_pro' else 0.15
            fixed_fee_api = 6.00
            sale_fee_total_from_api = (float(sell_price) * fee_rate_api) + fixed_fee_api
            print(f"  Pricing Logic (get_fees): Usando fallback -> Rate:{fee_rate_api:.4f}, Fixed:{fixed_fee_api:.2f}, TotalFeeAPI:{sale_fee_total_from_api:.2f}")

    except requests.exceptions.RequestException as e:
        print(f"  Pricing Logic (get_fees): Erro na requisição API de taxas: {e}")
        fee_rate_api = 0.19 if listing_type_id == 'gold_pro' else 0.15 # Fallback
        fixed_fee_api = 6.00 # Fallback
        sale_fee_total_from_api = (float(sell_price) * fee_rate_api) + fixed_fee_api
    
    return fee_rate_api, fixed_fee_api, sale_fee_total_from_api


def simulate_ml_free_shipping_logic(access_token, seller_id, item_price, listing_type_id, category_id, dimensions_str, origin_zip):
    """Simula o custo de frete grátis do ML para o vendedor."""
    if not all([access_token, seller_id, listing_type_id, category_id]):
        return {"error": True, "message": "Parâmetros ausentes para simulação de frete.", "cost": 9999.99}
    
    if not dimensions_str and origin_zip: # Precisa de dimensões e CEP se não for usar um item_id existente
         return {"error": True, "message": "Dimensões ou CEP de origem ausentes para simulação de frete.", "cost": 9999.99}


    url = f"https://api.mercadolibre.com/users/{seller_id}/shipping_options/free"
    params = {
        "item_price": round(float(item_price), 2),
        "listing_type_id": listing_type_id,
        "category_id": category_id,
        "condition": "new", # Assumindo novo
        "mode": "me2",      # Assumindo Mercado Envios 2
        "logistic_type": "drop_off", # Ou cross_docking, etc.
        "verbose": "true", # Para obter promoted_amount e rate
        "currency_id": "BRL" # Assumindo BRL
    }
    if dimensions_str: params["dimensions"] = dimensions_str
    if origin_zip: params["zip_code"] = origin_zip

    headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': current_app.config['APP_USER_AGENT']}
    print(f"Pricing Logic (simulate_shipping): Params: {params}")

    try:
        response = requests.get(url, params=params, headers=headers, timeout=20)
        response.raise_for_status()
        data = response.json()
        print(f"Pricing Logic (simulate_shipping): Resposta API: {data}")

        coverage = data.get("coverage", {})
        all_country_coverage = coverage.get("all_country", {})
        list_cost_api_val = all_country_coverage.get("list_cost") # Custo real para o vendedor
        
        discount_data = coverage.get("discount", {})
        rate_api_val = float(discount_data.get("rate", 0.0))
        promoted_amount_api_val = discount_data.get("promoted_amount")

        if list_cost_api_val is None: # Se não houver custo (ex: frete não aplicável ou erro na API)
            # Pode ser que a categoria não permita ME2, ou o preço seja muito baixo
            # A API costuma retornar 404 ou erro se não puder calcular.
            # Se chegou aqui com 200 OK e sem list_cost, algo está estranho ou não há custo.
            print("  Pricing Logic (simulate_shipping): 'list_cost' não encontrado na resposta. Assumindo R$0 ou erro.")
            # Para itens onde frete grátis não se aplica (ex: abaixo de R$79), a API pode não retornar custo.
            # Vamos retornar um objeto mais completo
            return {
                "error": False, # Não necessariamente um erro da nossa parte se a API não deu custo
                "message": "Custo de frete não aplicável ou não retornado pela API.",
                "cost": 0.0, # Custo final para o vendedor
                "list_cost_api": 0.0,
                "promoted_amount_api": 0.0,
                "rate_api": 0.0
            }

        final_cost_for_seller = float(list_cost_api_val)
        
        return {
            "error": False,
            "cost": round(final_cost_for_seller, 2),
            "list_cost_api": round(float(list_cost_api_val), 2),
            "promoted_amount_api": round(float(promoted_amount_api_val if promoted_amount_api_val is not None else list_cost_api_val), 2),
            "rate_api": rate_api_val
        }

    except requests.exceptions.HTTPError as e_http:
        err_detail = e_http.response.text[:150] if hasattr(e_http, 'response') and e_http.response else str(e_http)
        status_code = e_http.response.status_code if hasattr(e_http, 'response') and e_http.response else 500
        print(f"Pricing Logic (simulate_shipping): Erro HTTP {status_code} - {err_detail}")
        return {"error": True, "message": f"Erro API Frete ({status_code}): {err_detail}", "cost": 9999.99}
    except Exception as e:
        print(f"Pricing Logic (simulate_shipping): Exceção: {e}")
        return {"error": True, "message": f"Erro ao simular frete: {str(e)}", "cost": 9999.99}


def calculate_final_price_for_listing_type(
    cost_price_adjusted, desired_profit, profit_type_is_percent,
    shipping_cost_for_seller, category_id, listing_type_id,
    access_token, include_anticipation_fee=False
):
    """Calcula o preço final iterativamente para um tipo de anúncio."""
    
    base_for_profit_calc = cost_price_adjusted + shipping_cost_for_seller
    actual_desired_profit_value = 0
    if profit_type_is_percent:
        actual_desired_profit_value = base_for_profit_calc * (desired_profit / 100.0)
    else:
        actual_desired_profit_value = desired_profit

    # Estimativa inicial de taxas
    current_ml_fee_rate, current_ml_fixed_fee, _ = get_ml_api_fees_for_type_logic(
        category_id, 100, listing_type_id, access_token # Usa um preço de R$100 para estimativa inicial de taxa
    )
    if current_ml_fee_rate < 0 or current_ml_fee_rate >= 1: # Fallback se taxa inválida
        current_ml_fee_rate = 0.19 if listing_type_id == 'gold_pro' else 0.15
        print(f"  Aviso: Taxa percentual da API inválida ({current_ml_fee_rate}), usando fallback.")


    calculated_price = 0.0
    # Iteração para convergir o preço
    for i in range(5): # Iterar algumas vezes para estabilizar
        denominator = 1.0 - current_ml_fee_rate
        if include_anticipation_fee:
            denominator -= 0.038 # Exemplo de taxa de antecipação

        if denominator <= 0.05: # Evita divisão por zero ou margens muito pequenas
            print(f"Erro: Denominador muito baixo ou negativo ({denominator}) no cálculo de preço para {listing_type_id}.")
            return {"price": 0.00, "fees_info": "Erro no cálculo (denominador inválido)", "final_sale_fee":0, "anticipation_value":0}

        price_before_fees = cost_price_adjusted + actual_desired_profit_value + shipping_cost_for_seller + current_ml_fixed_fee
        new_price = price_before_fees / denominator

        if abs(new_price - calculated_price) < 0.01 and i > 0 : # Convergiu
            calculated_price = new_price
            break
        calculated_price = new_price
        # Re-busca taxas com o novo preço estimado para a próxima iteração
        current_ml_fee_rate, current_ml_fixed_fee, _ = get_ml_api_fees_for_type_logic(
            category_id, calculated_price, listing_type_id, access_token
        )
        if current_ml_fee_rate < 0 or current_ml_fee_rate >= 1: # Fallback
             current_ml_fee_rate = 0.19 if listing_type_id == 'gold_pro' else 0.15


    final_price = round(calculated_price, 2)
    if final_price <=0: final_price = 0.01 # Preço mínimo

    # Obter taxas finais com o preço calculado
    final_fee_rate, final_fixed_fee, final_total_sale_fee_api = get_ml_api_fees_for_type_logic(
        category_id, final_price, listing_type_id, access_token
    )
    # Recalcula a taxa de venda com os valores obtidos, para consistência, ou usa o da API se disponível e confiável
    calculated_sale_fee = (final_price * final_fee_rate) + final_fixed_fee
    display_sale_fee = final_total_sale_fee_api if abs(final_total_sale_fee_api - calculated_sale_fee) < 0.05 else calculated_sale_fee


    anticipation_value = final_price * 0.038 if include_anticipation_fee else 0.0

    fees_info_str = f"Tarifa ML: R${display_sale_fee:.2f} ({final_fee_rate*100:.1f}% + R${final_fixed_fee:.2f})"
    if include_anticipation_fee:
        fees_info_str += f" + Antec. R${anticipation_value:.2f}"

    return {
        "price": final_price,
        "fees_info": fees_info_str,
        "final_sale_fee": round(display_sale_fee,2),
        "anticipation_value": round(anticipation_value,2)
    }