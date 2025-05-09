

import os
import json
import shutil
from tqdm import tqdm

# -------------------------------------------------------------------------
# 설정: 경로 및 클래스·영문명 매핑
# -------------------------------------------------------------------------
BASE_DIR    = "/data/dlarlgus0619/g/khuthon/dataset"
SOURCE_BASE = os.path.join(BASE_DIR, "175.야생동물_활동_영상_데이터", "01._데이터", "2.Validation")
LABEL_BASE  = os.path.join(SOURCE_BASE, "라벨링데이터")
IMAGE_BASE  = os.path.join(SOURCE_BASE, "원천데이터")

TARGET_IMAGES = os.path.join(BASE_DIR, "images", "train")
TARGET_LABELS = os.path.join(BASE_DIR, "labels", "train")

CLASS_MAP = {"고라니":0, "멧돼지":1, "너구리":2, "멧토끼":3, "노루":4}
ID_TO_ENG = {0:"Gorani", 1:"Maet-dwaeji", 2:"Neoguri", 3:"Meet-ttokki", 4:"Noru"}

os.makedirs(TARGET_IMAGES, exist_ok=True)
os.makedirs(TARGET_LABELS, exist_ok=True)

# -------------------------------------------------------------------------
# 처리 루프: 종별 JSON → 이미지 복사 & 라벨 생성
# -------------------------------------------------------------------------
for species, cls_id in CLASS_MAP.items():
    counter = 0
    eng_name = ID_TO_ENG[cls_id]

    # 해당 종의 라벨링 폴더 찾기
    for vl in os.listdir(LABEL_BASE):
        if species not in vl:
            continue
        label_dir = os.path.join(LABEL_BASE, vl)
        image_dir = os.path.join(IMAGE_BASE, vl.replace("VL_", "VS_"))
        if not os.path.isdir(label_dir) or not os.path.isdir(image_dir):
            continue

        # JSON 파일별 진행바 표시
        for fname in tqdm(os.listdir(label_dir), desc=f"[{species}]", unit="file"):
            if not fname.endswith(".json"):
                continue
            data = json.load(open(os.path.join(label_dir, fname), encoding="utf-8"))

            # day="day"인 이미지에 한해 처리
            for img in data.get("images", []):
                if img.get("day") != "day":
                    continue
                src_img = os.path.join(image_dir, img["file_name"])
                if not os.path.exists(src_img):
                    continue

                # 새 파일명: 클래스ID_영문명+순번
                counter += 1
                new_base = f"{cls_id}_{eng_name}{counter}"
                dst_img  = os.path.join(TARGET_IMAGES, new_base + ".jpg")
                dst_lbl  = os.path.join(TARGET_LABELS, new_base + ".txt")

                # 이미지 복사 & 이름 변경
                shutil.copy2(src_img, dst_img)

                # YOLO 라벨 생성
                w, h   = img["width"], img["height"]
                img_id = img.get("id", img.get("image_id"))
                anns   = [
                    a for a in data.get("annotations", [])
                    if a.get("image_id", a.get("id")) == img_id
                ]
                lines = []
                for ann in anns:
                    (x1, y1), (x2, y2) = ann["bbox"]
                    cx = ((x1 + x2) / 2) / w
                    cy = ((y1 + y2) / 2) / h
                    bw = (x2 - x1) / w
                    bh = (y2 - y1) / h
                    lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

                # 빈 라벨 파일 방지
                if lines:
                    with open(dst_lbl, "w", encoding="utf-8") as lf:
                        lf.write("\n".join(lines))
                else:
                    # 혹시 이전 실행에서 남은 빈 파일이 있으면 삭제
                    if os.path.exists(dst_lbl):
                        os.remove(dst_lbl)