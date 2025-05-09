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
const AI_SERVER_URL = 'http://localhost:8000'; // AI 서버 주소 (FastAPI)

// 상태 정의
const STATUS = {
    NORMAL: 'normal',               // 정상 상태
    ANIMAL_ALERT: 'animal_alert',   // 야생동물 출현 경보
    HUMAN_ALERT: 'human_alert',     // 사람 침입 경보
    WEATHER_ALERT: 'weather_alert'  // 악천후 경보
};

// 현재 시스템 상태 (기본값: 정상)
let currentStatus = STATUS.NORMAL;

// 이미지/비디오 저장 경로
const MEDIA_PATH = path.join(__dirname, 'media');

// 미디어 폴더가 없으면 생성
if (!fs.existsSync(MEDIA_PATH)) {
    fs.mkdirSync(MEDIA_PATH);
    fs.mkdirSync(path.join(MEDIA_PATH, 'images'));
    fs.mkdirSync(path.join(MEDIA_PATH, 'videos'));
}

// 상태 업데이트 API
app.post('/api/update-status', async (req, res) => {
    const { status } = req.body;
    
    if (Object.values(STATUS).includes(status)) {
        currentStatus = status;
        console.log(`상태 업데이트: ${status}`);
        res.json({ success: true, status: currentStatus });
    } else {
        res.status(400).json({ success: false, message: '잘못된 상태값입니다' });
    }
});

// 백엔드 시작 시 및 주기적으로 미디어 폴더 모니터링
function startMediaMonitoring() {
  // 초기 폴더 스캔
  scanAndProcessNewMedia();
  
  // 주기적 스캔 설정 (예: 30초마다)
  setInterval(scanAndProcessNewMedia, 30000);
  
  console.log('미디어 모니터링이 시작되었습니다.');
}

// 새 미디어 파일 스캔 및 처리
async function scanAndProcessNewMedia() {
  try {
    // 처리된 파일 목록 (이미 분석 요청한 파일들)
    const processedFiles = database.getProcessedMediaFiles();
    
    // 현재 폴더 내 모든 파일 스캔
    await database.scanMediaFiles();
    const allFiles = database.getMediaFiles();
    
    // 새 파일 찾기
    const newImageFiles = allFiles.images.filter(img => !processedFiles.includes(img.id));
    const newVideoFiles = allFiles.videos.filter(vid => !processedFiles.includes(vid.id));
    
    // 새 이미지 파일 처리
    for (const img of newImageFiles) {
      console.log(`새 이미지 발견: ${img.id}`);
      await submitMediaToAI(img.id, 'image');
    }
    
    // 새 비디오 파일 처리
    for (const vid of newVideoFiles) {
      console.log(`새 비디오 발견: ${vid.id}`);
      await submitMediaToAI(vid.id, 'video');
    }
  } catch (error) {
    console.error('미디어 스캔 오류:', error);
  }
}

// AI 서버에 미디어 제출 함수
async function submitMediaToAI(mediaId, mediaType) {
  try {
    const mediaPath = path.join(MEDIA_PATH, mediaType === 'video' ? 'videos' : 'images', mediaId);
    
    if (!fs.existsSync(mediaPath)) {
      console.error(`파일을 찾을 수 없음: ${mediaPath}`);
      return;
    }
    
    // 작업 ID 생성
    const jobId = Date.now().toString();
    
    // 작업 상태 초기화
    database.updateJobStatus(jobId, {
      status: 'processing',
      mediaId,
      mediaType,
      startTime: new Date().toISOString(),
      completed: false
    });
    
    // 처리된 파일 목록에 추가
    database.addProcessedMediaFile(mediaId);
    
    // AI 서버에 전송
    const formData = new FormData();
    formData.append('file', fs.createReadStream(mediaPath));
    formData.append('type', mediaType);
    formData.append('job_id', jobId);
    
    // 분석 요청
    const response = await axios.post(`${AI_SERVER_URL}/submit-job`, formData, {
      headers: formData.getHeaders()
    });
    
    // 응답 처리
    database.updateJobStatus(jobId, {
      ...response.data,
      completed: true,
      completedTime: new Date().toISOString()
    });
    
    // 상태 업데이트
    if (response.data && response.data.status && response.data.status !== STATUS.NORMAL) {
      currentStatus = response.data.status;
      database.addAlert(currentStatus, {
        ...response.data,
        jobId,
        mediaId,
        mediaType
      });
    }
    
    return jobId;
  } catch (error) {
    console.error('미디어 제출 오류:', error, mediaId, mediaType);
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

// 현재 시스템 상태만 확인하는 폴링용 API (기존)
app.get('/api/status', (req, res) => {
  res.json({ 
    status: currentStatus,
    lastUpdated: database.getLastAlert()?.timestamp
  });
});

// 샘플 미디어 목록 조회 API
app.get('/api/media/list', (req, res) => {
    try {
        const type = req.query.type || 'all'; // 이미지/비디오/모두
        
        let files = {};
        
        if (type === 'all' || type === 'images') {
            const imagesPath = path.join(MEDIA_PATH, 'images');
            if (fs.existsSync(imagesPath)) {
                files.images = fs.readdirSync(imagesPath);
            } else {
                files.images = [];
            }
        }
        
        if (type === 'all' || type === 'videos') {
            const videosPath = path.join(MEDIA_PATH, 'videos');
            if (fs.existsSync(videosPath)) {
                files.videos = fs.readdirSync(videosPath);
            } else {
                files.videos = [];
            }
        }
        
        res.json({ success: true, files });
    } catch (error) {
        console.error('미디어 목록 조회 오류:', error);
        res.status(500).json({ success: false, message: '미디어 목록 조회 중 오류가 발생했습니다' });
    }
});

// 샘플 미디어 업로드 API (데모용)
app.post('/api/media/upload', (req, res) => {
    // 실제 구현에서는 multer 같은 라이브러리로 파일 업로드 처리
    // 여기서는 데모용이므로 API만 정의
    res.json({ success: true, message: '파일이 성공적으로 업로드되었습니다' });
});

// 시뮬레이션을 위한 상태 변경 API (데모 테스트용)
app.post('/api/simulate', (req, res) => {
    const { event } = req.body;
    
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
    
    res.json({ success: true, status: currentStatus });
});

// 서버 시작 시 모니터링 시작
startMediaMonitoring();



