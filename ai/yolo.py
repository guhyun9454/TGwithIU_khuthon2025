#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import logging
import json
import sys
from ultralytics import YOLO

def parse_args():
    parser = argparse.ArgumentParser(description="Train YOLO with SGD for 1 epoch and save results")
    parser.add_argument('--data',        type=str,   default='animal.yaml', help='dataset yaml 파일 경로')
    parser.add_argument('--weights',     type=str,   default='yolo11m.pt',  help='가중치 파일 (medium)')
    parser.add_argument('--epochs',      type=int,   default=1,            help='학습 epoch 수 (1로 고정)')
    parser.add_argument('--imgsz',       type=int,   default=640,          help='이미지 사이즈')
    parser.add_argument('--batch',       type=int,   default=32,           help='배치 사이즈')
    parser.add_argument('--workers',     type=int,   default=8,            help='num_workers')
    parser.add_argument('--project',     type=str,   default='runs/train', help='출력 디렉터리')
    parser.add_argument('--name',        type=str,   default='sgd_run1',   help='실험 이름')
    parser.add_argument('--device',      type=str,   default='0',           help='학습 디바이스 (예: "0")')
    parser.add_argument('--log',         type=str,   default='train.log',  help='로그 파일 경로')
    parser.add_argument('--val_out',     type=str,   default='val.json',   help='평가 결과 JSON 경로')
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

    logger.info(f"==== TRAIN START (SGD, 1 epoch) ====")
    model = YOLO(args.weights)

    # 학습: 1 epoch, SGD, lr0=0.01, momentum=0.9
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device=args.device,
        project=args.project,
        name=args.name,
        optimizer='SGD',
        lr0=0.01,
        momentum=0.9,
        plots=True
    )
    logger.info("학습 완료")

    # train 셋 그대로 평가
    logger.info("==== VALIDATION ON TRAIN SET ====")
    val_results = model.val(
        data=args.data,
        imgsz=args.imgsz,
        device=args.device,
        split="train"
    )

    # 평가 지표 추출
    metrics = {
        'precision':   val_results.box.p,
        'recall':      val_results.box.r,
        'mAP50':       val_results.box.map50,
        'mAP50-95':    val_results.box.map50_95,
        'speed':       val_results.speed
    }
    with open(args.val_out, 'w', encoding='utf-8') as vf:
        json.dump(metrics, vf, ensure_ascii=False, indent=2)
    logger.info(f"평가 결과 저장: {args.val_out}")

if __name__ == "__main__":
    main()