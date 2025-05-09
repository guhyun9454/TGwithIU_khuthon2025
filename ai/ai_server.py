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

app = FastAPI()

# ======================
# Args: Model Load
# ======================
parser = argparse.ArgumentParser()
parser.add_argument("--weights", type=str, required=True)
parser.add_argument("--device", type=str, default='mps')
parser.add_argument("--save_path", type=str, default="./output")
args = parser.parse_args()

model = YOLO(args.weights).to(args.device)
Path(args.save_path).mkdir(parents=True, exist_ok=True)

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
    uvicorn.run("ai_server:app", host="0.0.0.0", port=9454)