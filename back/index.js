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

// 이미지 전송 API - 비동기 처리
app.post('/api/submit-media', async (req, res) => {
  try {
    const { mediaId, mediaType } = req.body;
    const mediaPath = path.join(MEDIA_PATH, mediaType === 'video' ? 'videos' : 'images', mediaId);
    
    if (!fs.existsSync(mediaPath)) {
      return res.status(404).json({ 
        success: false, 
        message: `${mediaType === 'video' ? '비디오' : '이미지'}를 찾을 수 없습니다` 
      });
    }
    
    // 작업 ID 생성 (AI 서버와의 트래킹용)
    const jobId = Date.now().toString();
    
    // 비동기적으로 AI 서버에 전송 (응답 대기 없이 즉시 반환)
    const formData = new FormData();
    formData.append('file', fs.createReadStream(mediaPath));
    formData.append('type', mediaType);
    formData.append('job_id', jobId);
    
    // 분석 요청을 비동기로 처리 (결과를 기다리지 않음)
    axios.post(`${AI_SERVER_URL}/submit-job`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(response => {
      if (response.data && response.data.status) {
        // 백그라운드에서 상태 업데이트
        currentStatus = response.data.status;
        database.addAlert(currentStatus, {
          ...response.data,
          jobId,
          mediaId,
          mediaType
        });
      }
    }).catch(error => {
      console.error('비동기 분석 오류:', error);
    });
    
    // 클라이언트에 작업 ID만 즉시 반환
    res.json({
      success: true,
      jobId,
      message: '분석 작업이 시작되었습니다'
    });
  } catch (error) {
    console.error('미디어 제출 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '미디어 제출 중 오류가 발생했습니다' 
    });
  }
});

// 작업 상태 확인 API
app.get('/api/job-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // AI 서버에 작업 상태 확인
    const response = await axios.get(`${AI_SERVER_URL}/job-status/${jobId}`);
    
    if (response.data && response.data.status) {
      // 상태 업데이트가 완료된 경우에만 현재 상태를 변경
      if (response.data.completed) {
        currentStatus = response.data.status;
      }
    }
    
    res.json({
      success: true,
      status: currentStatus,
      jobDetails: response.data
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



