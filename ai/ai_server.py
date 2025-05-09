from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import FileResponse, JSONResponse
from typing import Literal
import uvicorn
import shutil
import os
import argparse
from pathlib import Path
from ultralytics import YOLO  # YOLOv8 기준
from PIL import Image, ImageDraw
import numpy as np
from deepface import DeepFace

app = FastAPI()

# ======================
# Args: Model Load
# ======================
parser = argparse.ArgumentParser()
parser.add_argument("--weights", type=str, required=True)
parser.add_argument("--device", type=str, default='mps')
parser.add_argument("--save_path", type=str, default="./output")
parser.add_argument("--threshold", type=float, default=0.4, help="얼굴 인식 유사도 임계값 (0~1, 낮을수록 엄격)")
args = parser.parse_args()

model = YOLO(args.weights).to(args.device)
Path(args.save_path).mkdir(parents=True, exist_ok=True)
print(f"모델 로드 완료: {args.weights}")

# ======================
# 얼굴 인식: 주인 임베딩 로드
# ======================
embedding_file = './face/owner_embeddings.npy'
if os.path.exists(embedding_file):
    owner_embeddings = np.load(embedding_file, allow_pickle=True)
    print(f"주인 임베딩 로드 완료: {embedding_file}")
else:
    print("주인 임베딩 파일이 존재하지 않습니다.")
    owner_embeddings = None

# ======================
# Utility: Draw boxes
# ======================
def draw_boxes(image_path, results, save_path):
    image = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(image)

    for box in results[0].boxes:
        xyxy = box.xyxy[0].tolist()
        cls = int(box.cls[0])
        draw.rectangle(xyxy, outline="red", width=2)

    image.save(save_path)

# ======================
# Route: Detect objects
# ======================
@app.post("/api/detect-animals")
async def detect_objects(
    file: UploadFile = File(...),
    job_id: str = Form(...)
):

    temp_path = f"./temp_{job_id}.jpg"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Inference
    results = model(temp_path)

    # List detected class names
    detected_classes = []
    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        if cls_name not in detected_classes:
            detected_classes.append(cls_name)

    # Save image with boxes
    final_path = os.path.join(args.save_path, f"{job_id}.jpg")
    draw_boxes(temp_path, results, final_path)

    os.remove(temp_path)

    return {
        "objects": detected_classes
    }

# ======================
# Route: Detect face
# ======================
@app.post("/api/detect-face")
async def detect_face(
    file: UploadFile = File(...),
    job_id: str = Form(...)
):
    if owner_embeddings is None:
        return JSONResponse(content={"error": "주인 임베딩 파일이 존재하지 않습니다"}, status_code=500)
        
    temp_path = f"./temp_face_{job_id}.jpg"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # 이미지 로드
        img = np.array(Image.open(temp_path).convert("RGB"))

        # 얼굴 검출 및 임베딩 추출
        faces = DeepFace.represent(
            img_path=img,
            model_name='ArcFace',
            detector_backend='retinaface',
            enforce_detection=True,
            align=True,
            normalization='base'
        )

        if len(faces) == 0:
            os.remove(temp_path)
            return JSONResponse(content={"error": "얼굴이 감지되지 않았습니다"}, status_code=400)

        image = Image.fromarray(img)
        draw = ImageDraw.Draw(image)
        success_count = 0

        for face in faces:
            embedding = np.array(face["embedding"])
            region = face["facial_area"]
            x, y, w, h = region["x"], region["y"], region["w"], region["h"]

            for owner_embedding in owner_embeddings:
                distance = np.dot(owner_embedding, embedding) / (np.linalg.norm(owner_embedding) * np.linalg.norm(embedding))
                if distance >= args.threshold:
                    success_count += 1

            draw.rectangle([x, y, x + w, y + h], outline="red", width=3)

        is_owner = success_count >= 2
        output_path = os.path.join(args.save_path, f"{job_id}.jpg")
        image.save(output_path)
        os.remove(temp_path)

        return {
            "isOwner": is_owner
        }
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return JSONResponse(content={"error": f"얼굴 인식 중 오류 발생: {str(e)}"}, status_code=500)
    

# ======================
# Route: Return image with boxes
# ======================
@app.get("/api/image-result/{job_id}")
def get_image(job_id: str):
    image_path = os.path.join(args.save_path, f"{job_id}.jpg")
    if not os.path.exists(image_path):
        return JSONResponse(content={"error": "Image not found"}, status_code=404)
    return FileResponse(image_path, media_type="image/jpeg")


# ======================
# Run server (for script)
# ======================
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9454)