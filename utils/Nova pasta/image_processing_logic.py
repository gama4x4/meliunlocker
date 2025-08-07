# backend/utils/image_processing_logic.py
import requests
import io
from PIL import Image, UnidentifiedImageError
import time

def _resize_image_to_target_logic(pil_image, target_w, target_h, add_bg=True, bg_color=(255,255,255), quality=90, img_format='JPEG'):
    try:
        if pil_image.mode == 'P' or pil_image.mode == 'LA' or (pil_image.mode == 'RGBA' and img_format == 'JPEG'):
            if 'A' in pil_image.getbands() and img_format == 'JPEG':
                background_for_alpha = Image.new("RGB", pil_image.size, bg_color[:3])
                background_for_alpha.paste(pil_image, (0, 0), pil_image.split()[-1])
                pil_image = background_for_alpha
            else: pil_image = pil_image.convert("RGBA" if img_format == 'PNG' else "RGB")
        if add_bg:
            original_w, original_h = pil_image.size
            if original_w == 0 or original_h == 0: return None
            ratio = min(target_w / original_w, target_h / original_h)
            new_w = int(original_w * ratio); new_h = int(original_h * ratio)
            if new_w == 0 or new_h == 0: return None
            resized_img = pil_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
            final_img_mode = "RGB"; actual_bg_color = bg_color[:3]
            if img_format.upper() == 'PNG':
                final_img_mode = "RGBA"
                if len(bg_color) == 4 and bg_color[3] == 0: actual_bg_color = (255, 255, 255, 0)
                elif len(bg_color) == 4: actual_bg_color = bg_color
                else: actual_bg_color = (bg_color[0], bg_color[1], bg_color[2], 255)
            final_img = Image.new(final_img_mode, (target_w, target_h), actual_bg_color)
            paste_x = (target_w - new_w) // 2; paste_y = (target_h - new_h) // 2
            if resized_img.mode == 'RGBA':
                if final_img.mode == 'RGBA': final_img.paste(resized_img, (paste_x, paste_y), resized_img)
                else: temp_rgb_bg_for_paste = Image.new("RGB", resized_img.size, actual_bg_color); temp_rgb_bg_for_paste.paste(resized_img, (0,0), resized_img); final_img.paste(temp_rgb_bg_for_paste, (paste_x, paste_y))
            else: final_img.paste(resized_img.convert(final_img_mode) if resized_img.mode != final_img_mode else resized_img, (paste_x, paste_y))
            return final_img
        else: return pil_image.resize((target_w, target_h), Image.Resampling.LANCZOS)
    except Exception as e: print(f"Erro _resize_image_to_target_logic: {e}"); return None

def process_optimize_image_logic(image_url):
    try:
        response = requests.get(image_url, timeout=20, stream=True); response.raise_for_status()
        MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024
        content_length = response.headers.get('content-length')
        if content_length and int(content_length) > MAX_IMAGE_SIZE_BYTES: return {"error": True, "message": "Imagem > 15MB."}
        image_bytes = response.content; pil_image = Image.open(io.BytesIO(image_bytes))
        MAX_PIXELS = 4500 * 4500
        if pil_image.width * pil_image.height > MAX_PIXELS: pil_image.thumbnail((3500,3500), Image.Resampling.LANCZOS)
        optimized_pil_image = _resize_image_to_target_logic(pil_image, 1000, 1000, add_bg=True, bg_color=(255,255,255), img_format='JPEG', quality=90)
        if not optimized_pil_image: return {"error": True, "message": "Falha ao otimizar."}
        byte_arr = io.BytesIO(); optimized_pil_image.save(byte_arr, format='JPEG', quality=90)
        return {"error": False, "image_bytes": byte_arr.getvalue()}
    except UnidentifiedImageError: return {"error": True, "message": "Formato inválido."}
    except requests.exceptions.RequestException as e: return {"error": True, "message": f"Erro rede: {str(e)}"}
    except IOError as e_io: return {"error": True, "message": f"Erro Pillow: {str(e_io)}"}
    except Exception as e: return {"error": True, "message": f"Erro otimização: {str(e)}"}

def process_remove_background_logic(image_url, removebg_api_key):
    if not removebg_api_key: return {"error": True, "message": "Chave Remove.bg N/D."}
    try:
        response_orig = requests.get(image_url, timeout=20, stream=True); response_orig.raise_for_status()
        original_image_bytes = response_orig.content
        files = {'image_file': ('original_image', original_image_bytes)}; headers = {'X-Api-Key': removebg_api_key}
        data_payload = {'size': 'auto', 'format': 'png'}
        response_rbg = requests.post('https://api.remove.bg/v1.0/removebg', files=files, data=data_payload, headers=headers, timeout=45)
        credits_charged = 0; try: credits_charged = int(response_rbg.headers.get('X-Credits-Charged', "0")) except: pass
        if response_rbg.status_code == requests.codes.ok:
            processed_bytes_png = response_rbg.content; pil_image_no_bg = Image.open(io.BytesIO(processed_bytes_png))
            if pil_image_no_bg.mode != 'RGBA': pil_image_no_bg = pil_image_no_bg.convert('RGBA')
            final_pil_image = _resize_image_to_target_logic(pil_image_no_bg, 1000, 1000, add_bg=True, bg_color=(255,255,255,0), img_format='PNG')
            if not final_pil_image: return {"error": True, "message": "Falha resize pós-Remove.bg.", "credits_charged": credits_charged}
            byte_arr = io.BytesIO(); final_pil_image.save(byte_arr, format='PNG')
            return {"error": False, "image_bytes": byte_arr.getvalue(), "credits_charged": credits_charged}
        else:
            error_text = f"Falha API Remove.bg ({response_rbg.status_code})"; error_details_json = {};
            try: error_details_json = response_rbg.json(); errors_list = error_details_json.get("errors");
            if errors_list and isinstance(errors_list, list) and errors_list[0].get("title"): error_text += f": {errors_list[0]['title']}"
            else: error_text += f" - {response_rbg.text[:100]}"
            except: error_text += f" - {response_rbg.text[:100]}"
            return {"error": True, "message": error_text, "credits_charged": credits_charged}
    except Exception as e: return {"error": True, "message": f"Erro Remove.bg: {str(e)}"}