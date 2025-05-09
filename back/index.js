const express = require('express')
const app = express()
const cors = require('cors');                           //서버간 통신 모듈
app.use(cors())
const { DateTime } = require('luxon');
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))  
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const PORT = 8081
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const database = require('./database/index')            //데이터베이스 파일 경로

// AI 서버 URL
const AI_SERVER_URL = 'http://localhost:9454'; // AI 서버 주소 (FastAPI)

// 상태 정의
const STATUS = {
    NORMAL: 'normal',               // 정상 상태
    ANIMAL_ALERT: 'animal_alert',   // 야생동물 출현 경보
    HUMAN_ALERT: 'human_alert',     // 사람 침입 경보
    WEATHER_ALERT: 'weather_alert'  // 악천후 경보
};

// 현재 시스템 상태 (기본값: 정상)
let currentStatus = STATUS.NORMAL;
// 현재 상태와 관련된 가장 최근 jobId
let currentStatusJobId = null;

// 이미지 저장 경로
const MEDIA_PATH = path.join(__dirname, 'media');

// 미디어 폴더가 없으면 생성
if (!fs.existsSync(MEDIA_PATH)) {
    fs.mkdirSync(MEDIA_PATH);
    fs.mkdirSync(path.join(MEDIA_PATH, 'animals')); // 동물 감지용 폴더
    fs.mkdirSync(path.join(MEDIA_PATH, 'face'));    // 사람 감지용 폴더
}




// 백엔드 시작 시 및 주기적으로 미디어 폴더 모니터링
function startMediaMonitoring() {
  // 초기 상태 설정
  currentStatus = STATUS.NORMAL;
  currentStatusJobId = `init_${Date.now()}`;
  
  // 초기 폴더 스캔
  //scanAndProcessNewMedia();
  setTimeout(() => {
    console.log('지연된 초기 폴더 스캔 시작...');
    scanAndProcessNewMedia();
  }, 5000);
  // 주기적 스캔 설정 (예: 30초마다)
  setInterval(scanAndProcessNewMedia, 30000);
  
  console.log('미디어 모니터링이 시작되었습니다.');
}

// 새 미디어 파일 스캔 및 폴더별 순서대로 처리
async function scanAndProcessNewMedia() {
  try {
    // 처리된 파일 목록
    const processedFiles = database.getProcessedMediaFiles();
    
    // 1. animals 폴더 처리 (먼저 처리)
    const animalsPath = path.join(MEDIA_PATH, 'animals');
    if (fs.existsSync(animalsPath)) {
      console.log('animals 폴더 이미지 처리 시작...');
      const animalFiles = fs.readdirSync(animalsPath);
      
      // 아직 처리되지 않은 새 파일만 필터링
      const newAnimalFiles = animalFiles.filter(file => !processedFiles.includes(`animals/${file}`));
      
      // animals 폴더의 각 이미지 처리
      for (const file of newAnimalFiles) {
        console.log(`새 동물 이미지 발견: ${file}`);
        await submitMediaToAI(`animals/${file}`, 'animal');
        
        // 데모를 위해 각 파일 처리 사이에 약간의 지연 추가 (선택사항)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // 2. face 폴더 처리 (나중에 처리)
    const facePath = path.join(MEDIA_PATH, 'face');
    if (fs.existsSync(facePath)) {
      console.log('face 폴더 이미지 처리 시작...');
      const faceFiles = fs.readdirSync(facePath);
      
      // 아직 처리되지 않은 새 파일만 필터링
      const newFaceFiles = faceFiles.filter(file => !processedFiles.includes(`face/${file}`));
      
      // face 폴더의 각 이미지 처리
      for (const file of newFaceFiles) {
        console.log(`새 사람 이미지 발견: ${file}`);
        await submitMediaToAI(`face/${file}`, 'human');
        
        // 데모를 위해 각 파일 처리 사이에 약간의 지연 추가 (선택사항)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('모든 폴더 처리 완료');
  } catch (error) {
    console.error('미디어 스캔 오류:', error);
  }
}

// AI 서버에 이미지 제출 함수 수정
async function submitMediaToAI(imagePath, category) {
  try {
    // 이미지 경로 분석 (폴더/파일명 구조)
    const [folderName, fileName] = imagePath.split('/');
    const fullImagePath = path.join(MEDIA_PATH, imagePath);
    
    if (!fs.existsSync(fullImagePath)) {
      console.error(`이미지를 찾을 수 없음: ${fullImagePath}`);
      return;
    }
    
    // 작업 ID 생성
    const jobId = Date.now().toString();
    
    // 작업 상태 초기화
    database.updateJobStatus(jobId, {
      status: 'processing',
      imageId: fileName,
      imagePath: imagePath,
      category: category,
      startTime: new Date().toISOString(),
      completed: false
    });
    
    // 처리된 파일 목록에 추가
    database.addProcessedMediaFile(imagePath);
    
    // AI 서버에 전송
    const formData = new FormData();
    formData.append('file', fs.createReadStream(fullImagePath));
    formData.append('job_id', jobId);
    formData.append('category', category);
    
    // AI 서버 엔드포인트 선택 (카테고리별 다른 엔드포인트 사용)
    const endpoint = category === 'animal' ? 'api/detect-animals' : 'api/detect-face';
    
    // 분석 요청
    const response = await axios.post(`${AI_SERVER_URL}/${endpoint}`, formData, {
      headers: formData.getHeaders()
    });
    
    // 상태 및 감지된 객체 처리
    let detectedStatus = STATUS.NORMAL;
    let detectedAnimals = [];
    let isOwner = false; // 주인 여부
    
    if (response.data) {
      // 동물 카테고리 처리
      if (category === 'animal' && response.data.objects) {
        // 동물 클래스 확인 (Gorani, Met-dwaeji, Neoguri, Met-tokki, Noru)
        const animalClasses = ['Gorani', 'Met-dwaeji', 'Neoguri', 'Met-tokki', 'Noru'];
        // 감지된 객체 목록
        const detectedObjects = response.data.objects;
        
        // 감지된 객체 중 지정된 동물 클래스가 있는지 확인
        detectedAnimals = detectedObjects.filter(obj => animalClasses.includes(obj));
        
        console.log('===== 동물 감지 결과 =====');
        console.log('파일:', imagePath);
        console.log('감지된 객체들:', detectedObjects);
        console.log('감지된 동물들:', detectedAnimals);
        console.log('========================');
        
        // 감지된 동물이 있으면 animal_alert 상태로 설정
        if (detectedAnimals.length > 0) {
          detectedStatus = STATUS.ANIMAL_ALERT;
        }
      } 
      // 사람 카테고리 처리 (새로운 로직으로 변경)
      else if (category === 'human') {
        // isOwner 값 확인
        isOwner = response.data.isOwner === true;
        
        console.log('===== 사람 감지 결과 =====');
        console.log('파일:', imagePath);
        console.log('주인 여부:', isOwner);
        console.log('========================');
        
