# backend/utils/openai_logic.py
from openai import OpenAI # Importe aqui

# CHATGPT_MODEL_NAME_APP seria idealmente passado como parâmetro ou pego de app.config
# from flask import current_app

def generate_description_with_chatgpt(title, current_description, api_key_openai, model_name):
    """
    Gera uma descrição de produto usando a API da OpenAI.
    """
    if not api_key_openai:
        return {"error": True, "message": "Chave API da OpenAI (ChatGPT) não fornecida."}
    if not title:
        return {"error": True, "message": "Título do produto é necessário para gerar a descrição."}

    try:
        client = OpenAI(api_key=api_key_openai)

        system_message = "Você é um especialista em copywriting para e-commerce, focado em criar descrições que vendem para anúncios no Mercado Livre."
        user_message_content = f"""
        Analise o seguinte produto:
        Título do Produto: "{title}"

        Descrição Atual (pode estar vazia, ser um rascunho, ou já ser HTML):
        "{current_description}"

        Sua Tarefa:
        1. Com base no título e na descrição atual, crie uma nova descrição de produto otimizada para vendas no Mercado Livre.
        2. A descrição deve ser persuasiva, destacar os principais benefícios e características do produto de forma concisa e atrativa.
        3. Formate a descrição EXCLUSIVAMENTE em HTML simples, utilizando APENAS as seguintes tags: <p>, <br>, <b>, <i>, <ul>, <li>.
           - Use <p> para parágrafos distintos.
           - Use <br> para quebras de linha simples DENTRO de parágrafos ou para adicionar um pequeno espaço vertical extra (use com moderação).
           - Use <b> para dar ênfase a palavras-chave importantes ou títulos de seções pequenas.
           - Use <i> para itálico, se apropriado estilisticamente.
           - Use <ul> e <li> para listas de características, especificações ou benefícios (evite listas muito longas ou complexas; máximo 2 níveis de profundidade se realmente necessário).
        4. NÃO inclua tags <html>, <head>, ou <body>. A resposta deve ser apenas o fragmento HTML da descrição.
        5. Se a descrição atual já for muito boa, apenas a refine e garanta que está formatada corretamente com o HTML simples permitido.
        6. O objetivo é aumentar o interesse, clareza e conversão. Mantenha um tom profissional, mas vendedor e direto ao ponto.
        7. Evite excesso de exclamações, jargões técnicos complexos (a menos que o público-alvo seja técnico), e linguagem excessivamente informal.
        8. A descrição deve ser bem estruturada e fácil de ler.

        Forneça a Nova Descrição em HTML:
        """

        print(f"OpenAI Logic: Chamando API para título: '{title}', Modelo: {model_name}")
        completion = client.chat.completions.create(
            model=model_name, # Ex: "gpt-4o-mini" ou "gpt-3.5-turbo"
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message_content}
            ],
            temperature=0.7, # Um bom equilíbrio entre criatividade e consistência
            # max_tokens pode ser útil para controlar o tamanho da resposta, se necessário
        )

        enhanced_description_html = ""
        if completion.choices and completion.choices[0].message and completion.choices[0].message.content:
            enhanced_description_html = completion.choices[0].message.content.strip()
            # Pequena limpeza para remover possíveis ```html no início e ``` no final
            if enhanced_description_html.startswith("```html"):
                enhanced_description_html = enhanced_description_html[7:]
            if enhanced_description_html.endswith("```"):
                enhanced_description_html = enhanced_description_html[:-3]
            enhanced_description_html = enhanced_description_html.strip()

        if enhanced_description_html:
            print("OpenAI Logic: Descrição HTML gerada com sucesso.")
            return {"error": False, "new_description_html": enhanced_description_html}
        else:
            print("OpenAI Logic: ChatGPT não retornou uma descrição válida.")
            return {"error": True, "message": "ChatGPT não retornou uma descrição válida."}

    except Exception as e:
        print(f"OpenAI Logic: Erro ao chamar API do ChatGPT: {type(e).__name__} - {str(e)}")
        return {"error": True, "message": f"Erro na comunicação com a API do ChatGPT: {str(e)}"}