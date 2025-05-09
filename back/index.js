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
  scanAndProcessNewMedia();
  
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
    const endpoint = category === 'animal' ? 'api/detect-animals' : 'api/detect-human';
    
    // 분석 요청
    const response = await axios.post(`${AI_SERVER_URL}/${endpoint}`, formData, {
      headers: formData.getHeaders()
    });
    
    // 동물 클래스 확인 (Gorani, Met-dwaeji, Neoguri, Met-tokki, Noru)
    const animalClasses = ['Gorani', 'Met-dwaeji', 'Neoguri', 'Met-tokki', 'Noru'];
    
    // 상태 및 감지된 객체 처리
    let detectedStatus = STATUS.NORMAL;
    let detectedAnimals = [];
    
    if (response.data && response.data.objects) {
      // 감지된 객체 목록
      const detectedObjects = response.data.objects;
      // 동물 카테고리인 경우 동물 감지 확인
      if (category === 'animal') {
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
      // 사람 카테고리인 경우 사람 감지 확인
      else if (category === 'human') {
        // 사람이 감지되었는지 확인
        const detectedPersons = detectedObjects.filter(obj => obj === 'person');
        
        // 사람이 감지되면 human_alert 상태로 설정
        if (detectedPersons.length > 0) {
          detectedStatus = STATUS.HUMAN_ALERT;
        }
      }
    }
    
    // 작업 상태 업데이트
    database.updateJobStatus(jobId, {
      status: detectedStatus,
      completed: true,
      completedTime: new Date().toISOString(),
      detectedObjects: response.data.objects || [],
      detectedAnimals: detectedAnimals
    });
    
    // 전체 시스템 상태 업데이트 (NORMAL로도 업데이트 가능하도록 수정)
    if (detectedStatus === STATUS.NORMAL) {
      // 정상 상태로 변경
      currentStatus = STATUS.NORMAL;
      currentStatusJobId = jobId;
    } else {
      // 경보 상태로 변경
      currentStatus = detectedStatus;
      currentStatusJobId = jobId;
      
      // 알림 추가 (경보 상태에만 알림 생성)
      database.addAlert(detectedStatus, {
        jobId,
        imageId: fileName,
        imagePath: imagePath,
        category: category,
        detectedObjects: response.data.objects || [],
        detectedAnimals: detectedAnimals
      });
    }
    
    return jobId;
  } catch (error) {
    console.error('이미지 제출 오류:', error, imagePath);
    return null;
  }
}

// 작업 상태 확인 API
app.get('/api/job-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // database 함수로 작업 상태 조회
    const jobStatus = database.getJobStatus(jobId);
    
    if (!jobStatus) {
      // AI 서버에 상태 확인 (대체 방법)
      try {
        const response = await axios.get(`${AI_SERVER_URL}/job-status/${jobId}`);
        
        if (response.data && response.data.status) {
          if (response.data.completed) {
            currentStatus = response.data.status;
          }
          
          res.json({
            success: true,
            status: currentStatus,
            jobDetails: response.data
        });
        return;
    }
      } catch (aiError) {
        return res.status(404).json({ 
          success: false, 
          message: '해당 작업을 찾을 수 없습니다' 
        });
      }
    }
    
    res.json({
      success: true,
      systemStatus: currentStatus,
      jobDetails: jobStatus
    });
  } catch (error) {
    console.error('작업 상태 확인 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '작업 상태 확인 중 오류가 발생했습니다' 
    });
  }
});

// 현재 시스템 상태 확인하는 폴링용 API
app.get('/api/status', (req, res) => {
  const lastAlert = database.getLastAlert();
  
  // 감지된 동물 목록 (있는 경우)
  let detectedAnimals = [];
  let animalNames = []; // 한글 동물 이름 배열 추가
  
  if (currentStatusJobId) {
    const jobStatus = database.getJobStatus(currentStatusJobId);
    if (jobStatus && jobStatus.detectedAnimals) {
      detectedAnimals = jobStatus.detectedAnimals;
      
      // 동물 이름을 한글로 변환
      animalNames = detectedAnimals.map(animal => {
        return {
          code: animal,
          name: database.animal_types[animal] || animal
        };
      });
    }
  }
  
  res.json({ 
    status: currentStatus,
    jobId: currentStatusJobId,
    lastUpdated: lastAlert?.timestamp,
    detectedAnimals: detectedAnimals, // 원래 코드명
    animalInfo: animalNames // 한글 이름이 포함된 정보 추가
  });
});

// 이미지 목록 조회 API
app.get('/api/media/list', (req, res) => {
    try {
        const category = req.query.category || 'all'; // 'all', 'animals', 'face'
        let result = {};
        
        if (category === 'all' || category === 'animals') {
            const animalsPath = path.join(MEDIA_PATH, 'animals');
            if (fs.existsSync(animalsPath)) {
                result.animals = fs.readdirSync(animalsPath).map(file => ({
                    id: file,
                    path: `animals/${file}`,
                    category: 'animal'
                }));
            } else {
                result.animals = [];
            }
        }
        
        if (category === 'all' || category === 'face') {
            const facePath = path.join(MEDIA_PATH, 'face');
            if (fs.existsSync(facePath)) {
                result.face = fs.readdirSync(facePath).map(file => ({
                    id: file,
                    path: `face/${file}`,
                    category: 'human'
                }));
            } else {
                result.face = [];
            }
        }
        
        res.json({ success: true, files: result });
    } catch (error) {
        console.error('이미지 목록 조회 오류:', error);
        res.status(500).json({ success: false, message: '이미지 목록 조회 중 오류가 발생했습니다' });
    }
});

// 샘플 미디어 업로드 API (데모용)
app.post('/api/media/upload', (req, res) => {
    // 실제 구현에서는 multer 같은 라이브러리로 파일 업로드 처리
    // 여기서는 데모용이므로 API만 정의
    res.json({ success: true, message: '파일이 성공적으로 업로드되었습니다' });
});

// 상태 업데이트 API
app.post('/api/update-status', async (req, res) => {
    const { status, jobId } = req.body;
    
    if (Object.values(STATUS).includes(status)) {
        currentStatus = status;
        
        // jobId가 제공되면 사용, 아니면 생성
        currentStatusJobId = jobId || `manual_${Date.now()}`;
        
        // 작업 상태 저장 (선택 사항)
        database.updateJobStatus(currentStatusJobId, {
          status: currentStatus,
          startTime: new Date().toISOString(),
          completedTime: new Date().toISOString(),
          completed: true,
          isManualUpdate: true
        });
        
        console.log(`상태 업데이트: ${status}, jobId: ${currentStatusJobId}`);
        res.json({ 
          success: true, 
          status: currentStatus,
          jobId: currentStatusJobId
        });
    } else {
        res.status(400).json({ success: false, message: '잘못된 상태값입니다' });
    }
});


// 시뮬레이션을 위한 상태 변경 API (데모 테스트용)
app.post('/api/simulate', (req, res) => {
    const { event, simulationJobId } = req.body;
    
    // 시뮬레이션용 jobId 생성 또는 사용
    const jobId = simulationJobId || `simulation_${Date.now()}`;
    
    switch (event) {
        case 'animal':
            currentStatus = STATUS.ANIMAL_ALERT;
            break;
        case 'human':
            currentStatus = STATUS.HUMAN_ALERT;
            break;
        case 'weather':
            currentStatus = STATUS.WEATHER_ALERT;
            break;
        case 'normal':
        default:
            currentStatus = STATUS.NORMAL;
    }
    
    // 현재 상태의 jobId 업데이트
    currentStatusJobId = jobId;
    
    // 시뮬레이션 작업 상태 저장 (선택 사항)
    database.updateJobStatus(jobId, {
      status: currentStatus,
      startTime: new Date().toISOString(),
      completedTime: new Date().toISOString(),
      completed: true,
      isSimulation: true
    });
    
    res.json({
      success: true, 
      status: currentStatus,
      jobId: currentStatusJobId
    });
});

// 서버 시작 시 모니터링 시작
startMediaMonitoring();



