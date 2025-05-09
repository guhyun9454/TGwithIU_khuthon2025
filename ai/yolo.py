#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import logging
import json
import sys
from ultralytics import YOLO

def parse_args():
    parser = argparse.ArgumentParser(description="Train YOLO with larger model, bigger batch and 8 workers")
    parser.add_argument('--data',    type=str,   default='animal.yaml', help='dataset yaml 파일 경로')
    parser.add_argument('--weights', type=str,   default='yolo11m.pt',  help='초기 가중치 파일 (yolo11n → yolo11m)')
    parser.add_argument('--epochs',  type=int,   default=100,           help='학습 epoch 수')
    parser.add_argument('--imgsz',   type=int,   default=640,           help='이미지 사이즈')
    parser.add_argument('--batch',   type=int,   default=32,            help='배치 사이즈 (기본 16→32)')
    parser.add_argument('--workers', type=int,   default=8,             help='num_workers (데이터로더 워커 수)')
    parser.add_argument('--project', type=str,   default='runs/train',  help='출력 디렉터리')
    parser.add_argument('--name',    type=str,   default='animal_big',  help='실험 이름')
    parser.add_argument('--device',  type=str,   default='0',           help='학습 디바이스 (예: "0" 또는 "cpu")')
    parser.add_argument('--log',     type=str,   default='train.log',   help='로그 파일 경로')
    parser.add_argument('--val_out', type=str,   default='val.json',    help='평가 결과 JSON 경로')
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
    logger.info(f"==== TRAIN START (model={args.weights}, batch={args.batch}, workers={args.workers}) ====")

    model = YOLO(args.weights)

    # 1) 학습
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,       # 배치 사이즈
        workers=args.workers,   # num_workers
        device=args.device,
        project=args.project,
        name=args.name,
        plots=True              # 학습 곡선 자동 생성
    )
    logger.info("학습 완료")

    # 2) train 데이터를 그대로 검증
    val_results = model.val(
        data=args.data,
        imgsz=args.imgsz,
        device=args.device,
        split="train"
    )
    with open(args.val_out, 'w', encoding='utf-8') as vf:
        json.dump(val_results.metrics, vf, ensure_ascii=False, indent=2)
    logger.info(f"평가 결과 저장: {args.val_out}")

if __name__ == "__main__":
    main()