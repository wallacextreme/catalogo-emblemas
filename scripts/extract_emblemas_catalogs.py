#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/extract_emblemas_catalogs.py
Pipeline Híbrido de Engenharia Reversa para os 6 Catálogos de Emblemas:
1) EMBLEMAS DE CALOTA.docx (OpenXML com variantes de diâmetro por linha)
2) EMBLEMAS FIAT.doc (OLE2 -> docx -> células individuais)
3) EMBLEMAS FORD.doc (OLE2 -> docx -> células individuais)
4) EMBLEMAS GM...doc (OLE2 -> docx -> células individuais)
5) EMBLEMAS IMPORTADOS.doc (OLE2 -> docx -> células individuais)
6) EMBLEMAS VW.doc (OLE2 -> docx -> células individuais)

Salva catálogo mestre em `src/data/catalog-master-seed.json` e
imagens processadas em `public/catalog-images/{categoria_slug}/`.
"""

import os
import re
import sys
import json
import io
import shutil
import glob
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import docx
from PIL import Image

# Importa o conversor webp de estúdio
sys.path.insert(0, str(Path(__file__).parent))
from webp_studio_converter import convert_bytes_to_studio_webp

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_IMG_DIR = ROOT_DIR / "public" / "catalog-images"
SRC_DATA_DIR = ROOT_DIR / "src" / "data"
TEMP_CONVERTED = ROOT_DIR / "temp_converted"

# Regex para parsing de caixas, códigos, medidas e posições
RE_CAIXA = re.compile(r'(?:CAIXA\s*[-–—:]*\s*|CX\.?\s*[-–—:]*\s*)([0-9]+[A-Z0-9\-_/]*)', re.IGNORECASE)
RE_CAIXA_SUFFIX = re.compile(r'\b([0-9]+\s*(?:GRADE|MALA|CAPO|CAPÔ|LATERAL))\b', re.IGNORECASE)
RE_MEDIDA = re.compile(r'(\d+[\.,]?\d*\s*[xX]\s*\d+[\.,]?\d*(?:\s*[xX]\s*\d+[\.,]?\d*)?\s*(?:MM|mm)?|\d+[\.,]?\d*\s*(?:MM|mm))')
RE_MARCON = re.compile(r'MAR[CÇ]ON\s*([0-9]{4,6})', re.IGNORECASE)
RE_JULIJAC = re.compile(r'JULIJAC\s*([0-9A-Z]+)', re.IGNORECASE)
RE_CAL = re.compile(r'\b(CAL\s*[0-9]+[A-Z]?)\b', re.IGNORECASE)
RE_POSICAO = re.compile(r'\b(GRADE|MALA|CAPÔ|CAPO|LATERAL|CALOTA|RODA)\b', re.IGNORECASE)
RE_ACABAMENTO = re.compile(r'\b(CROMADO|PRETO|AZUL|VERMELHO|RESINADO|CURVO|RETO|OVAL|ADESIVO|ADESSIVO|DOURADO)\b', re.IGNORECASE)

KNOWN_VEHICLES = [
    "Fiorino", "Uno", "Palio", "Siena", "Strada", "Doblo", "Doblò", "Idea", "Argo", "Cronos", "Ducato", "Mobi", "Toro", "Pulse", "Fastback", "Tempra", "Tipo", "Marea", "Bravo", "Punto", "Linea", "Stilo", "147", "Elba", "Premio",
    "Fiesta", "Escort", "Zetec", "Courier", "Ka", "Ecosport", "EcoSport", "Ranger", "Focus", "Fusion", "Mondeo", "Corcel", "Del Rey", "Belina", "Pampa", "Verona", "Royale", "Versailles", "F1000", "F250",
    "Omega", "Vectra", "Opala", "Corsa", "Classic", "Celta", "Prisma", "S10", "Blazer", "Astra", "Montana", "Meriva", "Zafira", "Monza", "Chevette", "Kadett", "Spin", "Onix", "Cruze", "Tracker", "Agile", "Cobalt", "Sonic", "Captiva", "Caravan", "Marajó",
    "Fit", "HR-V", "HRV", "Civic", "City", "WR-V", "CR-V", "Accord",
    "Etios", "Corolla", "Hilux", "Yaris", "SW4", "RAV4", "Bandeirante",
    "Golf", "Polo", "CrossFox", "Jetta", "Passat", "T-Cross", "Saveiro", "Fox", "Voyage", "Fusca", "Kombi", "Santana", "Bora", "Amarok", "Up", "Virtus", "Nivus", "Taos", "Quantum", "Parati", "Brasilia", "Variant", "Tiguan",
    "Clio", "Sandero", "Logan", "Duster", "Megane", "Captur", "Kwid", "Scenic", "Symbol", "Master",
    "206", "207", "208", "307", "308", "2008", "3008", "Partner", "Boxer",
    "C3", "C4", "Aircross", "C3 Aircross", "Berlingo", "Jumper", "Xsara",
    "HB20", "Creta", "Tucson", "i30", "Santa Fe", "HR",
    "Renegade", "Compass", "Commander", "Cherokee"
]


def normalize_box(text: str) -> str:
    """Extrai e normaliza o número da caixa."""
    m_suf = RE_CAIXA_SUFFIX.search(text)
    if m_suf:
        return m_suf.group(1).strip().replace(" ", "")

    m = RE_CAIXA.search(text)
    if m:
        box = m.group(1).strip()
        # Se contiver sufixo colado ex. 36GRADE
        return box.replace(" ", "")
    
    # Procura se tem apenas número no início ou fim após CAIXA
    m_simple = re.search(r'CAIXA[^\w]*([0-9]+[A-Za-z]*)', text, re.IGNORECASE)
    if m_simple:
        return m_simple.group(1).strip()

    return ""


def clean_text(t: str) -> str:
    """Remove caracteres especiais de controle do Word."""
    if not t:
        return ""
    t = t.replace('\x01', ' ').replace('\x07', ' ').replace('\r', ' ')
    lines = [line.strip() for line in t.split('\n') if line.strip()]
    return " ".join(lines)


def get_cell_image_blobs(cell, doc) -> List[Tuple[str, bytes]]:
    """Extrai todos os blobs de imagem de uma célula docx."""
    images = []
    # Itera sobre atributos xml da célula buscando relações de imagem
    r_ids = []
    for el in cell._element.iter():
        for k, v in el.attrib.items():
            if k.endswith('embed') or k.endswith('id'):
                if isinstance(v, str) and v.startswith('rId'):
                    if v not in r_ids:
                        r_ids.append(v)
    for rid in r_ids:
        part = doc.part.related_parts.get(rid)
        if part and hasattr(part, 'blob') and len(part.blob) > 200:
            # Verifica se é formato de imagem válido
            content_type = getattr(part, 'content_type', '')
            if 'image' in content_type or part.partname.endswith(('.png', '.jpeg', '.jpg', '.gif', '.bmp', '.wmf', '.emf')):
                images.append((part.partname, part.blob))
    return images


def parse_calota_line(line: str) -> Optional[Dict[str, str]]:
    """
    Parseia uma linha de variante de calota:
    Exemplo: '48mm – CAL 04 - CAIXA 93'
    """
    line = line.strip()
    if not line:
        return None
    
    # Diâmetro
    m_diam = re.search(r'(\d+[\.,]?\d*\s*mm|\d+[\.,]?\d*\s*MM)', line)
    diameter = m_diam.group(1).replace(" ", "").lower() if m_diam else ""

    # Caixa
    m_box = re.search(r'CAIXA\s*[-–—:]*\s*([0-9]+[A-Za-z]*)', line, re.IGNORECASE)
    box = m_box.group(1).strip() if m_box else ""

    # Código comercial (CAL xxx ou código numérico)
    m_cal = re.search(r'\b(CAL\s*[0-9]+[A-Za-z]?)\b', line, re.IGNORECASE)
    if m_cal:
        comm_code = m_cal.group(1).upper()
    else:
        # Tenta achar código numérico solto entre diâmetro e caixa
        m_num = re.search(r'[-–—]\s*([0-9A-Z]{4,7})\s*[-–—]', line)
        comm_code = m_num.group(1).strip() if m_num else ""

    if not diameter and not comm_code and not box:
        return None

    return {
        "diameterMm": diameter,
        "commercialCode": comm_code,
        "boxNumber": box,
        "rawLine": line
    }


def extract_calotas(docx_path: Path) -> List[Dict[str, Any]]:
    """Extrai todas as calotas e variantes de EMBLEMAS DE CALOTA.docx."""
    print(f"--> Extraindo Calotas de {docx_path.name}...")
    doc = docx.Document(str(docx_path))
    tbl = doc.tables[0]

    category_slug = "calotas"
    out_dir = PUBLIC_IMG_DIR / category_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    products = []
    item_counter = 0

    for r_idx, row in enumerate(tbl.rows):
        # Cada linha possui 2 slots: Slot 0 (col 0 + 1) e Slot 1 (col 2 + 3)
        slots = [
            (0, 1, "esq"),
            (2, 3, "dir")
        ]
        for img_col, text_col, side in slots:
            if img_col >= len(row.cells) or text_col >= len(row.cells):
                continue
            
            img_cell = row.cells[img_col]
            text_cell = row.cells[text_col]
            raw_text = text_cell.text.strip()
            image_blobs = get_cell_image_blobs(img_cell, doc)

            if not image_blobs and not raw_text:
                continue

            item_counter += 1
            item_id = f"calota_r{r_idx + 1:02d}_{side}_{item_counter:03d}"

            # Processa as variantes de medidas
            lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
            variants = []
            for l in lines:
                var = parse_calota_line(l)
                if var:
                    variants.append(var)

            # Define diâmetro principal e caixas
            diameters = [v["diameterMm"] for v in variants if v.get("diameterMm")]
            boxes = [v["boxNumber"] for v in variants if v.get("boxNumber")]
            cal_codes = [v["commercialCode"] for v in variants if v.get("commercialCode")]

            primary_diameter = diameters[0] if diameters else ""
            primary_box = boxes[0] if boxes else ""
            primary_code = cal_codes[0] if cal_codes else ""

            # Converte a imagem principal para WebP
            image_paths = []
            if image_blobs:
                for idx, (pname, blob) in enumerate(image_blobs[:3]):
                    suffix = "" if idx == 0 else f"_{idx + 1}"
                    webp_filename = f"{item_id}{suffix}.webp".lower()
                    webp_dest = out_dir / webp_filename
                    res = convert_bytes_to_studio_webp(blob, webp_dest)
                    if res.success and res.output_path:
                        rel_path = f"/catalog-images/{category_slug}/{webp_filename}"
                        image_paths.append(rel_path)

            # Se não conseguiu imagem direta da célula, tenta fallback
            if not image_paths:
                # Placeholder ou imagem padrão se necessário
                pass

            # Monta descrição e título amigáveis
            title_parts = ["Emblema de Calota"]
            if primary_code:
                title_parts.append(primary_code)
            if diameters:
                title_parts.append(f"({', '.join(diameters)})")
            name = " ".join(title_parts)

            product = {
                "id": item_id.lower(),
                "name": name,
                "catalogSource": docx_path.name,
                "category": "Emblemas de Calota",
                "categorySlug": category_slug,
                "brand": "Universal / Calota",
                "boxNumber": primary_box,
                "commercialCode": primary_code,
                "referenceCode": primary_code,
                "diameterMm": primary_diameter,
                "position": "Calota de Roda",
                "finish": "Resinado / Cromado",
                "vehicleApplication": "Universal / Calotas Esportivas e Originais",
                "description": raw_text,
                "needsDescriptionReview": False if raw_text else True,
                "images": image_paths,
                "variants": variants,
                "allBoxes": list(dict.fromkeys(boxes)),
                "allDiameters": list(dict.fromkeys(diameters)),
                "allCodes": list(dict.fromkeys(cal_codes)),
                "searchTokens": f"{item_id} calota {' '.join(cal_codes)} {' '.join(boxes)} {' '.join(diameters)} {raw_text}".lower()
            }
            products.append(product)

    print(f"✓ Calotas extraídas: {len(products)} modelos com total de {sum(len(p['variants']) for p in products)} variantes de medidas.")
    return products


def parse_vehicle_brands(text: str, default_brand: str) -> Tuple[str, List[str]]:
    """Identifica montadoras e veículos citados no texto."""
    found_vehicles = []
    text_lower = text.lower()
    for v in KNOWN_VEHICLES:
        if re.search(r'\b' + re.escape(v.lower()) + r'\b', text_lower):
            found_vehicles.append(v)
    
    brand = default_brand
    if "honda" in text_lower:
        brand = "Honda"
    elif "toyota" in text_lower:
        brand = "Toyota"
    elif "renault" in text_lower:
        brand = "Renault"
    elif "peugeot" in text_lower:
        brand = "Peugeot"
    elif "citroen" in text_lower or "citroën" in text_lower:
        brand = "Citroën"
    elif "hyundai" in text_lower:
        brand = "Hyundai"
    elif "nissan" in text_lower:
        brand = "Nissan"
    elif "mitsubishi" in text_lower:
        brand = "Mitsubishi"
    elif "jeep" in text_lower:
        brand = "Jeep"
    
    return brand, found_vehicles


def extract_doc_catalog(
    docx_path: Path,
    original_doc_name: str,
    category_name: str,
    category_slug: str,
    default_brand: str
) -> List[Dict[str, Any]]:
    """Extrai os produtos de uma montadora a partir do arquivo docx convertido."""
    print(f"--> Extraindo catálogo {original_doc_name} ({category_name})...")
    doc = docx.Document(str(docx_path))
    tbl = doc.tables[0]

    out_dir = PUBLIC_IMG_DIR / category_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    products = []
    item_counter = 0

    for r_idx, row in enumerate(tbl.rows):
        for c_idx, cell in enumerate(row.cells):
            raw_text = cell.text.strip()
            clean_t = clean_text(raw_text)
            image_blobs = get_cell_image_blobs(cell, doc)

            # Se célula totalmente vazia sem imagem e sem texto, ignora
            if not image_blobs and not clean_t:
                continue

            item_counter += 1
            box_num = normalize_box(clean_t)
            
            box_part = f"cx{box_num}" if box_num else "s_cx"
            item_id = f"{category_slug}_r{r_idx + 1:02d}_c{c_idx + 1:02d}_{box_part}_{item_counter:03d}".lower()

            # Processa e converte as imagens
            image_paths = []
            if image_blobs:
                for idx, (pname, blob) in enumerate(image_blobs[:3]):
                    suffix = "" if idx == 0 else f"_{idx + 1}"
                    webp_filename = f"{item_id}{suffix}.webp".lower()
                    webp_dest = out_dir / webp_filename
                    res = convert_bytes_to_studio_webp(blob, webp_dest)
                    if res.success and res.output_path:
                        rel_path = f"/catalog-images/{category_slug}/{webp_filename}"
                        image_paths.append(rel_path)

            # Identifica códigos de fabricantes
            m_marcon = RE_MARCON.search(clean_t)
            marcon_code = f"MARCON {m_marcon.group(1)}" if m_marcon else ""

            m_julijac = RE_JULIJAC.search(clean_t)
            julijac_code = f"JULIJAC {m_julijac.group(1)}" if m_julijac else ""

            m_cal = RE_CAL.search(clean_t)
            cal_code = m_cal.group(1).upper() if m_cal else ""

            commercial_code = marcon_code or cal_code or julijac_code or ""

            # Identifica medidas
            m_medida = RE_MEDIDA.search(clean_t)
            diameter_mm = m_medida.group(1).strip() if m_medida else ""

            # Identifica posições
            m_pos = RE_POSICAO.search(clean_t)
            if m_pos:
                pos_raw = m_pos.group(1).upper()
                position = "Grade Dianteira" if pos_raw == "GRADE" else (
                    "Mala / Traseira" if pos_raw == "MALA" else (
                        "Capô" if pos_raw in ("CAPÔ", "CAPO") else (
                            "Lateral / Paralama" if pos_raw == "LATERAL" else "Emblema"
                        )
                    )
                )
            else:
                if "grade" in box_num.lower():
                    position = "Grade Dianteira"
                elif "mala" in box_num.lower():
                    position = "Mala / Traseira"
                else:
                    position = "Emblema"

            # Identifica acabamento
            m_acab = RE_ACABAMENTO.search(clean_t)
            finish = m_acab.group(1).capitalize() if m_acab else "Cromado / Esmaltado"

            # Identifica montadora e veículos
            brand, vehicles = parse_vehicle_brands(clean_t, default_brand)
            vehicle_app = ", ".join(vehicles) if vehicles else default_brand

            # Se não tem descrição textual além da caixa, gera título claro
            has_only_box = bool(re.match(r'^(?:CAIXA\s*[-–—:]*\s*[0-9A-Z]+|\s*)$', clean_t, re.IGNORECASE))
            needs_review = has_only_box or (len(clean_t) < 5 and not commercial_code)

            if needs_review:
                box_label = f"Caixa {box_num}" if box_num else "S/ Caixa"
                name = f"Emblema {brand} — {box_label}"
            else:
                # Limpa prefixos de caixa do início se houver
                name = clean_t
                if marcon_code and not name.upper().startswith("EMBLEMA"):
                    name = f"Emblema {brand} {name}"

            product = {
                "id": item_id,
                "name": name,
                "catalogSource": original_doc_name,
                "category": category_name,
                "categorySlug": category_slug,
                "brand": brand,
                "boxNumber": box_num,
                "commercialCode": commercial_code,
                "referenceCode": marcon_code or julijac_code or "",
                "marconCode": marcon_code,
                "julijacCode": julijac_code,
                "diameterMm": diameter_mm,
                "position": position,
                "finish": finish,
                "vehicleApplication": vehicle_app,
                "description": clean_t,
                "needsDescriptionReview": needs_review,
                "images": image_paths,
                "variants": [],
                "searchTokens": f"{item_id} {brand} {box_num} {commercial_code} {diameter_mm} {position} {vehicle_app} {clean_t}".lower()
            }
            products.append(product)

    print(f"✓ {category_name} extraído: {len(products)} itens ({len([p for p in products if p['images']])} com fotos).")
    return products


def main():
    print("================================================================================")
    print("INICIANDO EXTRAÇÃO HÍBRIDA 100% DOS 6 CATÁLOGOS DE EMBLEMAS")
    print("================================================================================")

    SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_IMG_DIR.mkdir(parents=True, exist_ok=True)

    all_products = []

    # 1. EMBLEMAS DE CALOTA.docx
    calota_file = ROOT_DIR / "EMBLEMAS DE CALOTA.docx"
    if calota_file.exists():
        calotas = extract_calotas(calota_file)
        all_products.extend(calotas)
    else:
        print(f"ALERTA: {calota_file} não encontrado!")

    # 2. Arquivos .doc convertidos
    doc_configs = [
        ("EMBLEMAS FIAT.docx", "EMBLEMAS FIAT.doc", "Fiat", "fiat", "Fiat"),
        ("EMBLEMAS FORD.docx", "EMBLEMAS FORD.doc", "Ford", "ford", "Ford"),
        ("EMBLEMAS GM...docx", "EMBLEMAS GM...doc", "GM / Chevrolet", "gm", "Chevrolet"),
        ("EMBLEMAS IMPORTADOS.docx", "EMBLEMAS IMPORTADOS.doc", "Importados", "importados", "Importados"),
        ("EMBLEMAS VW.docx", "EMBLEMAS VW.doc", "Volkswagen", "vw", "Volkswagen"),
    ]

    for docx_stem, doc_orig, cat_name, cat_slug, default_brand in doc_configs:
        conv_path = TEMP_CONVERTED / docx_stem
        if conv_path.exists():
            prods = extract_doc_catalog(conv_path, doc_orig, cat_name, cat_slug, default_brand)
            all_products.extend(prods)
        else:
            print(f"ALERTA: Arquivo convertido {conv_path} não encontrado!")

    # Grava catálogo mestre
    master_seed_path = SRC_DATA_DIR / "catalog-master-seed.json"
    with open(master_seed_path, "w", encoding="utf-8") as f:
        json.dump(all_products, f, ensure_ascii=False, indent=2)

    print("================================================================================")
    print(f"RELATÓRIO DE EXTRAÇÃO CONCLUÍDO COM SUCESSO:")
    print(f"Total Geral de Itens Catalogados: {len(all_products)}")
    print(f"Total com Fotos WebP de Estúdio: {len([p for p in all_products if p['images']])}")
    print(f"Catálogo Mestre salvo em: {master_seed_path}")
    print("================================================================================")


if __name__ == "__main__":
    main()
