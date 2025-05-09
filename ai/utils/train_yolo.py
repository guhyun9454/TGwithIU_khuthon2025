#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import logging
import json
import sys
from ultralytics import YOLO

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data',        type=str,   default='animal.yaml', help='dataset yaml 파일 경로')
    parser.add_argument('--weights',     type=str,   default='yolo11m.pt',  help='가중치 파일 (medium)')
    parser.add_argument('--epochs',      type=int,   default=1,            help='학습 epoch 수 (1로 고정)')
    parser.add_argument('--imgsz',       type=int,   default=640,          help='이미지 사이즈')
    parser.add_argument('--batch',       type=int,   default=32,           help='배치 사이즈')
    parser.add_argument('--workers',     type=int,   default=8,            help='num_workers')
    parser.add_argument('--name',        type=str,   default=None,         help='실험 이름')
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

    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device=args.device,
        name=args.name,
        optimizer='SGD',
        lr0=0.01,
        momentum=0.9,
        plots=True
    )
    logger.info("학습 완료")

    val_results = model.val(
        data=args.data,
        imgsz=args.imgsz,
        device=args.device,
    )

if __name__ == "__main__":
    main()