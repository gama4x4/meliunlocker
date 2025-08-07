# backend/utils/image_processing_logic.py
import requests
import io
from PIL import Image, UnidentifiedImageError
import time

def _resize_image_to_target_logic(pil_image, target_w, target_h, add_bg=True, bg_color=(255,255,255), quality=90, img_format='JPEG'):
    """Redimensiona, adiciona fundo branco se necessário, e controla formato/qualidade."""
    try:
        # Converte modos problemáticos antes do processamento
        if pil_image.mode == 'P' or pil_image.mode == 'LA':
            pil_image = pil_image.convert("RGBA")
        elif pil_image.mode == 'CMYK':
             pil_image = pil_image.convert("RGB")
        elif pil_image.mode == 'RGBA' and img_format.upper() == 'JPEG':
            # Se for salvar como JPEG e tiver alfa, precisa de um fundo
            background_for_alpha = Image.new("RGB", pil_image.size, bg_color[:3])
            # Cola a imagem RGBA sobre o fundo RGB. O canal alfa da imagem RGBA será usado como máscara.
            background_for_alpha.paste(pil_image, (0, 0), pil_image)
            pil_image = background_for_alpha


        if add_bg:
            original_w, original_h = pil_image.size
            if original_w == 0 or original_h == 0:
                print("Aviso: Imagem original com dimensão zero.")
                return None

            ratio = min(target_w / original_w, target_h / original_h)
            new_w = int(original_w * ratio)
            new_h = int(original_h * ratio)
            if new_w == 0 or new_h == 0:
                print(f"Aviso: Novas dimensões calculadas são zero ({new_w}x{new_h}) para imagem original {original_w}x{original_h} e alvo {target_w}x{target_h}.")
                return None # Evita erro no resize

            resized_img = pil_image.resize((new_w, new_h), Image.Resampling.LANCZOS)

            final_img_mode = "RGB"
            actual_bg_color = bg_color[:3] # Default para JPEG

            if img_format.upper() == 'PNG':
                final_img_mode = "RGBA"
                if len(bg_color) == 4 and bg_color[3] == 0: # Fundo transparente para PNG
                    actual_bg_color = (255, 255, 255, 0)
                elif len(bg_color) == 4: # Usa a cor RGBA fornecida
                    actual_bg_color = bg_color
                else: # Converte RGB para RGBA opaco
                    actual_bg_color = (bg_color[0], bg_color[1], bg_color[2], 255)
            
            final_img = Image.new(final_img_mode, (target_w, target_h), actual_bg_color)
            paste_x = (target_w - new_w) // 2
            paste_y = (target_h - new_h) // 2

            if resized_img.mode == 'RGBA':
                if final_img.mode == 'RGBA':
                    final_img.paste(resized_img, (paste_x, paste_y), resized_img) # Usa canal alfa da imagem como máscara
                else: # final_img é RGB (para JPEG)
                    # Cria um fundo temporário da cor desejada, cola a imagem RGBA nele, depois cola esse resultado
                    temp_bg = Image.new("RGB", resized_img.size, actual_bg_color)
                    temp_bg.paste(resized_img, (0,0), resized_img)
                    final_img.paste(temp_bg, (paste_x, paste_y))
            else: # Imagem redimensionada não tem alfa
                # Converte para o modo da imagem final se for diferente
                final_img.paste(resized_img.convert(final_img_mode) if resized_img.mode != final_img_mode else resized_img, (paste_x, paste_y))
            return final_img
        else: # Apenas redimensiona, pode distorcer
            return pil_image.resize((target_w, target_h), Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"Erro severo em _resize_image_to_target_logic: {e}")
        return None

def process_optimize_image_logic(image_url):
    """Baixa, otimiza (1000x1000, fundo branco JPEG) e retorna bytes da imagem."""
    try:
        print(f"Image Processing: Baixando para otimizar: {image_url}")
        response = requests.get(image_url, timeout=20, stream=True)
        response.raise_for_status()
        MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024
        content_length = response.headers.get('content-length')
        if content_length and int(content_length) > MAX_IMAGE_SIZE_BYTES:
            return {"error": True, "message": "Imagem original excede 15MB."}
        image_bytes = response.content
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # Redimensionamento preliminar para imagens muito grandes para evitar consumo excessivo de memória
        MAX_INITIAL_PIXELS = 5000 * 5000 # Limite arbitrário
        if pil_image.width * pil_image.height > MAX_INITIAL_PIXELS:
             pil_image.thumbnail((4000,4000), Image.Resampling.LANCZOS) # Reduz antes de processar mais

        optimized_pil_image = _resize_image_to_target_logic(pil_image, 1000, 1000, add_bg=True, bg_color=(255,255,255), img_format='JPEG', quality=90)
        if not optimized_pil_image:
            return {"error": True, "message": "Falha ao redimensionar/otimizar imagem (imagem resultante nula)."}
        byte_arr = io.BytesIO()
        optimized_pil_image.save(byte_arr, format='JPEG', quality=90)
        print("Image Processing: Imagem otimizada para 1000x1000 JPEG.")
        return {"error": False, "image_bytes": byte_arr.getvalue()}
    except UnidentifiedImageError: return {"error": True, "message": "Formato de imagem não reconhecido ou arquivo corrompido."}
    except requests.exceptions.RequestException as e: return {"error": True, "message": f"Erro de rede ao baixar imagem: {str(e)}"}
    except IOError as e_io: return {"error": True, "message": f"Erro de I/O ao processar imagem (Pillow): {str(e_io)}"}
    except Exception as e: return {"error": True, "message": f"Erro inesperado durante otimização da imagem: {str(e)}"}

def process_remove_background_logic(image_url, removebg_api_key):
    """Baixa imagem, remove fundo usando Remove.bg API, redimensiona para PNG com transparência e retorna bytes."""
    if not removebg_api_key:
        return {"error": True, "message": "Chave API Remove.bg não fornecida."}
    try:
        print(f"Image Processing: Baixando para Remove.bg: {image_url}")
        response_orig = requests.get(image_url, timeout=20, stream=True); response_orig.raise_for_status()
        original_image_bytes = response_orig.content
        
        print("Image Processing: Enviando para API Remove.bg...")
        files = {'image_file': ('original_image', original_image_bytes)} # O nome do arquivo aqui não é crítico
        headers = {'X-Api-Key': removebg_api_key}
        data_payload = {'size': 'auto', 'format': 'png'} # Pede PNG para manter transparência
        response_rbg = requests.post('https://api.remove.bg/v1.0/removebg', files=files, data=data_payload, headers=headers, timeout=45)
        
        credits_charged_str = response_rbg.headers.get('X-Credits-Charged', "0")
        credits_charged = 0
        try:
            credits_charged = int(credits_charged_str)
        except ValueError:
            print(f"Aviso: X-Credits-Charged não é um inteiro válido: {credits_charged_str}")

        print(f"Remove.bg: Status {response_rbg.status_code}, Créditos cobrados: {credits_charged}")

        if response_rbg.status_code == requests.codes.ok:
            processed_bytes_png = response_rbg.content
            pil_image_no_bg = Image.open(io.BytesIO(processed_bytes_png))
            if pil_image_no_bg.mode != 'RGBA': # Garante que é RGBA para o processamento de transparência
                pil_image_no_bg = pil_image_no_bg.convert('RGBA')

            # Redimensiona para 1000x1000 mantendo transparência (add_bg=True, mas bg_color com alfa 0)
            final_pil_image = _resize_image_to_target_logic(pil_image_no_bg, 1000, 1000, add_bg=True, bg_color=(255,255,255,0), img_format='PNG')
            if not final_pil_image:
                 return {"error": True, "message": "Falha ao redimensionar imagem pós-Remove.bg.", "credits_charged": credits_charged}
            byte_arr = io.BytesIO()
            final_pil_image.save(byte_arr, format='PNG')
            print("Image Processing: Fundo removido e imagem ajustada para 1000x1000 PNG.")
            return {"error": False, "image_bytes": byte_arr.getvalue(), "credits_charged": credits_charged}
        else:
            error_text = f"Falha API Remove.bg (Status: {response_rbg.status_code})"
            try:
                error_details_json = response_rbg.json(); errors_list = error_details_json.get("errors")
                if errors_list and isinstance(errors_list, list) and errors_list[0].get("title"): error_text += f": {errors_list[0]['title']}"
                else: error_text += f" - {response_rbg.text[:150]}"
            except: error_text += f" - {response_rbg.text[:150]}"
            return {"error": True, "message": error_text, "credits_charged": credits_charged}
    except UnidentifiedImageError: return {"error": True, "message": "Formato de imagem não reconhecido ou corrompido para Remove.bg."}
    except requests.exceptions.RequestException as e: return {"error": True, "message": f"Erro de rede (Remove.bg): {str(e)}"}
    except IOError as e_io: return {"error": True, "message": f"Erro de I/O ao processar imagem pós-Remove.bg (Pillow): {str(e_io)}"}
    except Exception as e: return {"error": True, "message": f"Erro inesperado durante processo Remove.bg: {str(e)}"}