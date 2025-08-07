# backend/utils/helpers.py
import html
import re

def strip_html_tags_for_web(text_html):
    if not text_html:
        return ""
    try:
        processed_text = html.unescape(str(text_html))
    except Exception as e:
        print(f"Erro html.unescape em strip_html_tags_for_web: {e}. Usando texto original.")
        processed_text = str(text_html)

    processed_text = re.sub(r'<br\s*/?>', '\n', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'</p\s*>', '\n\n', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'<p\s*[^>]*>', '', processed_text, flags=re.IGNORECASE)
    processed_text = re.sub(r'<[^>]+>', '', processed_text) # Remove todas as outras tags
    lines = processed_text.split('\n')
    cleaned_lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in lines]
    # Junta as linhas, mas evita múltiplas linhas em branco excessivas.
    # Permite no máximo uma linha em branco entre blocos de texto (que vieram de <p>).
    final_text = []
    for i, line in enumerate(cleaned_lines):
        if line:
            final_text.append(line)
        elif i > 0 and cleaned_lines[i-1]: # Adiciona uma linha em branco se a anterior não era
            final_text.append("")
    
    plain_text = "\n".join(final_text)
    plain_text = re.sub(r'\n{3,}', '\n\n', plain_text) # Garante no máximo duas quebras (uma linha em branco)

    return plain_text.strip()