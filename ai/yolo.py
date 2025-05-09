import argparse
import logging
import json
import sys
from ultralytics import YOLO

def parse_args():
    parser = argparse.ArgumentParser(description="Train YOLO and save results to files")
    parser.add_argument('--data',        type=str, default='animal.yaml',    help='dataset yaml 파일 경로')
    parser.add_argument('--weights',     type=str, default='yolo11n.pt',     help='초기 가중치 파일')
    parser.add_argument('--epochs',      type=int, default=100,              help='학습 epoch 수')
    parser.add_argument('--imgsz',       type=int, default=640,              help='이미지 사이즈')
    parser.add_argument('--project',     type=str, default='runs/train',     help='출력 디렉터리')
    parser.add_argument('--name',        type=str, default='animal_run',     help='실험 이름')
    parser.add_argument('--device',      type=str, default='0',              help='학습 디바이스 (예: "0" or "cpu")')
    parser.add_argument('--log',         type=str, default='train.log',      help='로그 파일 경로')
    parser.add_argument('--val_out',     type=str, default='val_results.json', help='평가 결과 JSON 경로')
    parser.add_argument('--predict_src', type=str, default='images/train',   help='추론할 이미지 폴더')
    parser.add_argument('--predict_save',type=str, default='runs/predict',  help='추론 결과 저장 폴더')
    parser.add_argument('--conf',        type=float, default=0.25,          help='추론 confidence threshold')
    return parser.parse_args()

def setup_logging(log_path):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    fh = logging.FileHandler(log_path, mode='w')
    fh.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s'))
    logger.addHandler(fh)
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
    logger.addHandler(ch)
    return logger

def main():
    args = parse_args()
    logger = setup_logging(args.log)

    logger.info(f"==== TRAIN START (device={args.device}) ====")
    model = YOLO(args.weights)

    # 1) 학습 (validation 건너뛰기: val=False)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        project=args.project,
        name=args.name,
        device=args.device,
        val=False,      # 이전의 noval=True 대신
        plots=True
    )
    logger.info("학습 완료")

    # 2) 학습 데이터로 평가
    logger.info("==== VALIDATION ON TRAIN SET ====")
    val_results = model.val(
        data=args.data,
        imgsz=args.imgsz,
        device=args.device,
        split="train"
    )
    with open(args.val_out, 'w', encoding='utf-8') as vf:
        json.dump({'results': str(val_results)}, vf, ensure_ascii=False, indent=2)
    logger.info(f"평가 결과 저장: {args.val_out}")

    # 3) 추론 및 저장
    logger.info("==== PREDICTION ON TRAIN SET ====")
    preds = model.predict(
        source=args.predict_src,
        conf=args.conf,
        save=True,
        save_dir=args.predict_save,
        show=False
    )
    logger.info(f"추론 결과 이미지 저장: {args.predict_save}")

    logger.info("==== ALL DONE ====")

if __name__ == "__main__":
    main()