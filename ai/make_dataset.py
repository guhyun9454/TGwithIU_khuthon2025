

import os
import json
import shutil

# -------------------------------------------------------------------------
# 설정: 경로 및 클래스 매핑
# -------------------------------------------------------------------------
BASE_DIR = "/data/dlarlgus0619/g/khuthon/dataset"
SOURCE_BASE = os.path.join(
    BASE_DIR,
    "175.야생동물_활동_영상_데이터",
    "01._데이터",
    "2.Validation"
)
LABEL_BASE = os.path.join(SOURCE_BASE, "라벨링데이터")
IMAGE_BASE = os.path.join(SOURCE_BASE, "원천데이터")

TARGET_IMAGES = os.path.join(BASE_DIR, "images", "train")
TARGET_LABELS = os.path.join(BASE_DIR, "labels", "train")

CLASS_MAP = {
    "고라니": 0,
    "멧돼지": 1,
    "너구리": 2,
    "멧토끼": 3,
    "노루": 4
}

# -------------------------------------------------------------------------
# 디렉터리 생성
# -------------------------------------------------------------------------
os.makedirs(TARGET_IMAGES, exist_ok=True)
os.makedirs(TARGET_LABELS, exist_ok=True)

# -------------------------------------------------------------------------
# 처리 루프: 종별 폴더 순회
# -------------------------------------------------------------------------
for species, cls_id in CLASS_MAP.items():
    # VL_xx.{species} 폴더 찾기
    for vl_folder in os.listdir(LABEL_BASE):
        if species in vl_folder:
            label_dir = os.path.join(LABEL_BASE, vl_folder)
            # VL → VS 매핑으로 이미지 폴더 지정
            vs_folder = vl_folder.replace("VL_", "VS_")
            image_dir = os.path.join(IMAGE_BASE, vs_folder)
            if not os.path.isdir(label_dir) or not os.path.isdir(image_dir):
                continue

            # JSON 파일 순회
            for fname in os.listdir(label_dir):
                if not fname.endswith(".json"):
                    continue
                json_path = os.path.join(label_dir, fname)
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # 낮 사진(day) 필터링
                for img in data.get("images", []):
                    if img.get("day") != "day":
                        continue
                    img_name = img["file_name"]
                    src_img = os.path.join(image_dir, img_name)
                    dst_img = os.path.join(TARGET_IMAGES, img_name)
                    if os.path.exists(src_img):
                        shutil.copy2(src_img, dst_img)

                    # YOLO 라벨(.txt) 생성
                    img_w, img_h = img["width"], img["height"]
                    img_id = img.get("id", img.get("image_id"))
                    anns = [
                        a for a in data.get("annotations", [])
                        if a.get("image_id", a.get("id")) == img_id
                    ]
                    label_lines = []
                    for ann in anns:
                        x1, y1 = ann["bbox"][0]
                        x2, y2 = ann["bbox"][1]
                        cx = ((x1 + x2) / 2) / img_w
                        cy = ((y1 + y2) / 2) / img_h
                        w  = (x2 - x1) / img_w
                        h  = (y2 - y1) / img_h
                        label_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")

                    label_file = os.path.splitext(img_name)[0] + ".txt"
                    with open(os.path.join(TARGET_LABELS, label_file), "w", encoding="utf-8") as lf:
                        lf.write("\n".join(label_lines))