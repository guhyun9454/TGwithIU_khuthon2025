import cv2
from deepface import DeepFace
import os
import numpy as np

# ✅ 주인 임베딩 로드
embedding_file = './data/owner_embeddings.npy'
if not os.path.exists(embedding_file):
    print("❌ 주인 임베딩 파일이 존재하지 않습니다. 먼저 주인 임베딩을 생성하세요.")
    exit()

owner_embeddings = np.load(embedding_file, allow_pickle=True)
print(f"✅ 주인 임베딩 로드 완료: {embedding_file}")

# ✅ 사용자 입력으로 비교할 이미지 지정
comparison_image_path = input("\n비교할 얼굴 이미지 경로를 입력하세요: ").strip()
comparison_image_path = os.path.abspath(comparison_image_path)

# ✅ 파일 형식 확인 (jpg, jpeg, png)
supported_formats = ('.jpg', '.jpeg', '.png')
if not comparison_image_path.lower().endswith(supported_formats):
    print(f"❌ 지원하지 않는 이미지 형식입니다. (지원 형식: {supported_formats})")
    exit()

# ✅ 비교할 얼굴 이미지 파일 확인
if not os.path.exists(comparison_image_path):
    print("❌ 비교할 얼굴 이미지 파일이 존재하지 않습니다.")
    exit()

# ✅ 비교할 얼굴 이미지 임베딩 생성
try:
    comparison_embedding = DeepFace.represent(
        img_path=comparison_image_path,
        model_name='ArcFace',
        detector_backend='retinaface',
        enforce_detection=True
    )[0]["embedding"]
    comparison_embedding = np.array(comparison_embedding)
except Exception as e:
    print(f"❌ 비교할 얼굴 임베딩 생성 중 오류 발생: {str(e)}")
    exit()

# ✅ 얼굴 검증 (임베딩 간 거리 계산) - 최소 2개 이상 통과해야 주인으로 인정
try:
    success_count = 0  # 주인 얼굴과 유사한 이미지 개수
    threshold = 0.4  # 유사도 임계값 (0 ~ 1, 낮을수록 더 엄격)
    
    for owner_embedding in owner_embeddings:
        # ✅ 코사인 유사도 계산 (1 - cosine distance)
        distance = np.dot(owner_embedding, comparison_embedding) / (np.linalg.norm(owner_embedding) * np.linalg.norm(comparison_embedding))
        
        if distance >= threshold:  # 유사도 기준 통과
            success_count += 1
    
    # ✅ 최소 2개 이상 통과해야 주인으로 인정
    if success_count >= 2:
        print("✅ True (주인으로 판별됨)")
    else:
        print("❌ False (주인이 아님)")
    
except Exception as e:
    print(f"❌ 얼굴 검증 중 오류 발생: {str(e)}")
