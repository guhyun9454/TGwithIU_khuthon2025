const fs = require('fs');
const path = require('path');
require('dotenv').config();//환경변수 설정
const serviceKey = process.env.API_KEY;
const xml2js2 = require('xml2js');
const JSEncrypt = require('node-jsencrypt');
const request = require('request');
const fs2 = require('fs').promises;
const { DateTime } = require('luxon');




// 알림 기록 저장
const alerts = [];

// 상태 목록
const STATUS_TYPES = {
    NORMAL: 'normal',               // 정상 상태
    ANIMAL_ALERT: 'animal_alert',   // 야생동물 출현 경보
    HUMAN_ALERT: 'human_alert',     // 사람 침입 경보
    WEATHER_ALERT: 'weather_alert'  // 악천후 경보
};

// 알림 저장하기
const addAlert = (type, details) => {
    const alert = {
        id: Date.now().toString(),
        timestamp: DateTime.now().toISO(),
        type,
        details,
    };
    
    alerts.push(alert);
    
    // 최대 100개만 저장 (메모리 부하 방지)
    if (alerts.length > 100) {
        alerts.shift();
    }
    
    return alert;
};

// 알림 조회
const getAlerts = (limit = 10) => {
    return alerts.slice(-limit).reverse();
};

// 마지막 알림 조회
const getLastAlert = () => {
    return alerts.length > 0 ? alerts[alerts.length - 1] : null;
};

// 미디어 파일 정보 저장
const mediaFiles = {
    images: []
};

// 미디어 파일 스캔하기
const scanMediaFiles = async () => {
    try {
        const baseDir = path.join(__dirname, '..', 'media');
        mediaFiles.images = [];
        
        // animals 폴더 스캔
        const animalsPath = path.join(baseDir, 'animals');
        if (fs.existsSync(animalsPath)) {
            const files = await fs2.readdir(animalsPath);
            const animalImages = files.map(file => ({
                id: `animals/${file}`,
                path: `animals/${file}`,
                type: 'image',
                category: 'animal',
                url: `/media/animals/${file}`
            }));
            mediaFiles.images.push(...animalImages);
        }
        
        // face 폴더 스캔
        const facePath = path.join(baseDir, 'face');
        if (fs.existsSync(facePath)) {
            const files = await fs2.readdir(facePath);
            const faceImages = files.map(file => ({
                id: `face/${file}`,
                path: `face/${file}`,
                type: 'image',
                category: 'human',
                url: `/media/face/${file}`
            }));
            mediaFiles.images.push(...faceImages);
        }
        
        return mediaFiles;
    } catch (error) {
        console.error('이미지 파일 스캔 오류:', error);
        return mediaFiles;
    }
};

// 작업 상태 저장소 (메모리 기반)
const jobStatusMap = new Map();

// 작업 상태 추가/업데이트
const updateJobStatus = (jobId, statusData) => {
    const currentStatus = jobStatusMap.get(jobId) || {};
    jobStatusMap.set(jobId, {
        ...currentStatus,
        ...statusData,
        lastUpdated: DateTime.now().toISO()
    });
    return jobStatusMap.get(jobId);
};

// 작업 상태 조회
const getJobStatus = (jobId) => {
    return jobStatusMap.get(jobId) || null;
};

// 모든 작업 상태 조회 (최신순)
const getAllJobStatuses = (limit = 10) => {
    return Array.from(jobStatusMap.entries())
        .sort((a, b) => {
            const timeA = a[1].lastUpdated || a[1].startTime || '';
            const timeB = b[1].lastUpdated || b[1].startTime || '';
            return timeB.localeCompare(timeA);
        })
        .slice(0, limit)
        .map(([jobId, status]) => ({
            jobId,
            ...status
        }));
};

const processedMediaFiles = new Set();

const addProcessedMediaFile = (mediaId) => {
    processedMediaFiles.add(mediaId);
    return true;
};

const getProcessedMediaFiles = () => {
    return Array.from(processedMediaFiles);
};

module.exports = {
    STATUS_TYPES,
    addAlert,
    getAlerts,
    getLastAlert,
    scanMediaFiles,
    getMediaFiles: () => mediaFiles,
    updateJobStatus,
    getJobStatus,
    getAllJobStatuses,
    addProcessedMediaFile,
    getProcessedMediaFiles
};


