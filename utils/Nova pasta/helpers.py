# backend/utils/helpers.py
import html
import re

def strip_html_tags_for_web(text_html):
    if not text_html:
        return ""
    try:
        # Decodifica entidades HTML (ex: &nbsp; -> espaço, &lt; -> <)
        processed_text = html.unescape(text_html)
    except Exception as e:
        print(f"Erro html.unescape: {e}. Usando texto original.")
        processed_text = text_html

    # Substitui <br> e </p> por quebras de linha reais
    processed_text = re.sub(r'<br\s*/?>', '\n', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'</p\s*>', '\n\n', processed_text, flags=re.IGNORECASE) # Duas quebras para parágrafo

    # Remove todas as outras tags HTML
    processed_text = re.sub(r'<[^>]+>', '', processed_text)

    # Normaliza múltiplos espaços e remove espaços no início/fim de cada linha
    lines = processed_text.split('\n')
    cleaned_lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in lines]

    # Junta as linhas, garantindo no máximo duas quebras de linha consecutivas
    plain_text = "\n".join(line for line in cleaned_lines if line) # Remove linhas vazias
    plain_text = re.sub(r'\n{3,}', '\n\n', plain_text) # Consolida múltiplas quebras

    return plain_text.strip()