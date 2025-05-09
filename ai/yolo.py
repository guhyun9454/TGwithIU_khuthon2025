from ultralytics import YOLO

model = YOLO("yolo11n.pt")  # load a pretrained model (recommended for training)
results = model.train(data="animal.yaml", epochs=100, imgsz=640)

