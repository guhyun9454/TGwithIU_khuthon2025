import os
import numpy as np
from deepface import DeepFace

# ✅ 주인 얼굴 이미지 디렉토리 설정
owner_image_dir = os.path.abspath('./data/owners/')  # 주인 얼굴 이미지 디렉토리
print(f"✅ 주인 얼굴 이미지 디렉토리: {owner_image_dir}")

# ✅ 주인 얼굴 이미지 파일 로드 (3개 이상)
owner_images = [os.path.join(owner_image_dir, f) for f in os.listdir(owner_image_dir) 
                if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

if len(owner_images) < 3:
    print("❌ 주인 얼굴 이미지가 3개 이상 필요합니다.")
    exit()

print(f"✅ 주인 얼굴 이미지 {len(owner_images)}개 로드 완료.")

# ✅ 주인 얼굴 임베딩 생성 (3개 이상)
owner_embeddings = []
for img_path in owner_images:
    try:
        embedding = DeepFace.represent(
            img_path=img_path,
            model_name='ArcFace',
            detector_backend='retinaface',
            enforce_detection=True
        )[0]["embedding"]  # 임베딩 값만 저장
        owner_embeddings.append(np.array(embedding))
        print(f"✅ 주인 얼굴 임베딩 생성 완료: {img_path}")
    except Exception as e:
        print(f"❌ 주인 얼굴 임베딩 생성 중 오류 발생: {img_path} - {str(e)}")

# ✅ 임베딩 저장
embedding_file = './data/owner_embeddings.npy'
np.save(embedding_file, owner_embeddings)
print(f"✅ 주인 임베딩 저장 완료: {embedding_file}")
